import Foundation
import OSLog
import SQLite3

struct BibleBook: Identifiable, Hashable, Sendable {
    enum Testament: String, Sendable { case old = "OT", new = "NT" }
    let id: Int
    let name: String
    let testament: Testament
    let chapters: Int
}

struct BibleVerse: Identifiable, Hashable, Sendable {
    let book: Int
    let chapter: Int
    let number: Int
    let text: String
    var id: VerseID { VerseID(book: book, chapter: chapter, verse: number) }
}

/// A verse coordinate. Encodes compactly as BBCCCVVV, the same scheme Qara
/// uses for its verse_id, so highlights and notes can sync between the two.
struct VerseID: Hashable, Codable, Sendable, Comparable {
    let book: Int
    let chapter: Int
    let verse: Int

    var code: Int { book * 1_000_000 + chapter * 1_000 + verse }

    static func < (lhs: VerseID, rhs: VerseID) -> Bool { lhs.code < rhs.code }
}

struct ChapterRef: Hashable, Codable, Sendable {
    let book: Int
    let chapter: Int
    /// Where the Sermon on the Mount begins.
    static let sermonOnTheMount = ChapterRef(book: 40, chapter: 5)
}

struct SearchHit: Identifiable, Hashable, Sendable {
    let verse: BibleVerse
    let bookName: String
    var id: VerseID { verse.id }
}

/// The bundled Berean Standard Bible (ios/Mount/Resources/BSB.sqlite, built by
/// scripts/build-ios-bible.mjs). Read-only, opened `immutable` straight from
/// the app bundle, so it needs no copying, no network and no migrations.
///
/// An actor because a SQLite connection must not be used from two threads at
/// once; every query funnels through this one serial executor.
actor BibleDatabase {
    enum Failure: LocalizedError {
        case missing, open(String), query(String)
        var errorDescription: String? {
            switch self {
            case .missing: "The Bible is missing from this build."
            case .open(let message), .query(let message): "The Bible couldn't be read: \(message)"
            }
        }
    }

    /// Owns the SQLite handle and closes it when the actor goes away. A
    /// separate class because an actor's deinit is nonisolated and may not
    /// touch a non-Sendable pointer. `@unchecked Sendable` is sound here: the
    /// pointer is only ever used from inside this actor.
    private final class Connection: @unchecked Sendable {
        let handle: OpaquePointer
        init(_ handle: OpaquePointer) { self.handle = handle }
        deinit { sqlite3_close(handle) }
    }

    private let connection: Connection
    private var handle: OpaquePointer { connection.handle }
    private var bookCache: [BibleBook]?

    init(bundle: Bundle = .main) throws {
        guard let url = bundle.url(forResource: "BSB", withExtension: "sqlite") else { throw Failure.missing }
        var db: OpaquePointer?
        let uri = "file:\(url.path(percentEncoded: true))?immutable=1"
        guard sqlite3_open_v2(uri, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_URI, nil) == SQLITE_OK, let db else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            sqlite3_close(db)
            throw Failure.open(message)
        }
        connection = Connection(db)
    }

    func books() throws -> [BibleBook] {
        if let bookCache { return bookCache }
        let rows = try query("SELECT id, name, testament, chapters FROM books ORDER BY id") { statement in
            BibleBook(
                id: Int(sqlite3_column_int(statement, 0)),
                name: Self.string(statement, 1),
                testament: Self.string(statement, 2) == "NT" ? .new : .old,
                chapters: Int(sqlite3_column_int(statement, 3))
            )
        }
        bookCache = rows
        return rows
    }

    func chapter(_ ref: ChapterRef) throws -> [BibleVerse] {
        try query(
            "SELECT book, chapter, verse, text FROM verses WHERE book = ?1 AND chapter = ?2 ORDER BY verse",
            bind: { statement in
                sqlite3_bind_int(statement, 1, Int32(ref.book))
                sqlite3_bind_int(statement, 2, Int32(ref.chapter))
            },
            row: Self.verse
        )
    }

    func verses(_ ids: [VerseID]) throws -> [BibleVerse] {
        guard !ids.isEmpty else { return [] }
        let list = ids.map { "(\($0.book),\($0.chapter),\($0.verse))" }.joined(separator: ",")
        return try query(
            "SELECT book, chapter, verse, text FROM verses WHERE (book, chapter, verse) IN (VALUES \(list)) ORDER BY book, chapter, verse",
            row: Self.verse
        )
    }

    /// Full-text search, best matches first. Each word must appear (as a
    /// prefix, so "bless" finds "blessed"); punctuation in the query is
    /// stripped so nothing typed can break the FTS syntax.
    func search(_ text: String, limit: Int = 60) throws -> [SearchHit] {
        let terms = text
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .map { "\"\($0)\"*" }
        guard !terms.isEmpty else { return [] }
        let books = try books()
        let names = Dictionary(uniqueKeysWithValues: books.map { ($0.id, $0.name) })
        return try query(
            """
            SELECT v.book, v.chapter, v.verse, v.text
            FROM verses_fts f JOIN verses v ON v.rowid = f.rowid
            WHERE verses_fts MATCH ?1 ORDER BY rank LIMIT ?2
            """,
            bind: { statement in
                sqlite3_bind_text(statement, 1, terms.joined(separator: " "), -1, Self.transient)
                sqlite3_bind_int(statement, 2, Int32(limit))
            },
            row: { statement in
                let verse = Self.verse(statement)
                return SearchHit(verse: verse, bookName: names[verse.book] ?? "")
            }
        )
    }

    // MARK: - SQLite plumbing

    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private static func string(_ statement: OpaquePointer, _ column: Int32) -> String {
        sqlite3_column_text(statement, column).map { String(cString: $0) } ?? ""
    }

    private static func verse(_ statement: OpaquePointer) -> BibleVerse {
        BibleVerse(
            book: Int(sqlite3_column_int(statement, 0)),
            chapter: Int(sqlite3_column_int(statement, 1)),
            number: Int(sqlite3_column_int(statement, 2)),
            text: string(statement, 3)
        )
    }

    private func query<T>(
        _ sql: String,
        bind: (OpaquePointer) -> Void = { _ in },
        row: (OpaquePointer) -> T
    ) throws -> [T] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw Failure.query(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(statement) }
        bind(statement)
        var results: [T] = []
        while true {
            switch sqlite3_step(statement) {
            case SQLITE_ROW: results.append(row(statement))
            case SQLITE_DONE: return results
            default: throw Failure.query(String(cString: sqlite3_errmsg(handle)))
            }
        }
    }
}

/// Reads "John 3:16", "jn 3", "1 cor 13", "Matthew 5:3-12" into a location.
/// Matches a book by unique prefix (ignoring spaces and case) so short forms
/// work without an alias table.
enum ScriptureReference {
    struct Parsed: Equatable, Sendable {
        let book: Int
        let chapter: Int
        let verse: Int?
    }

    static func parse(_ text: String, books: [BibleBook]) -> Parsed? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let match = trimmed.wholeMatch(of: /^(?<book>[1-3]?\s*[A-Za-z][A-Za-z\s]*?)\.?\s+(?<chapter>\d{1,3})(?::(?<verse>\d{1,3})(?:\s*-\s*\d{1,3})?)?$/) else {
            return nil
        }
        let key = normalize(String(match.output.book))
        guard !key.isEmpty else { return nil }
        let exact = books.first { normalize($0.name) == key }
        let prefixed = books.filter { normalize($0.name).hasPrefix(key) }
        guard let book = exact ?? (prefixed.count == 1 ? prefixed.first : nil) ?? alias(key, books) else { return nil }
        guard let chapter = Int(match.output.chapter), (1...book.chapters).contains(chapter) else { return nil }
        return Parsed(book: book.id, chapter: chapter, verse: match.output.verse.flatMap { Int($0) })
    }

    private static func normalize(_ value: String) -> String {
        value.lowercased().filter { !$0.isWhitespace }
    }

    /// The few abbreviations that are not prefixes of their book's name.
    private static func alias(_ key: String, _ books: [BibleBook]) -> BibleBook? {
        let aliases = ["jn": "John", "mt": "Matthew", "mk": "Mark", "lk": "Luke", "ps": "Psalms", "psalm": "Psalms",
                       "song": "Song of Solomon", "songofsongs": "Song of Solomon", "jas": "James", "phil": "Philippians"]
        guard let name = aliases[key] else { return nil }
        return books.first { $0.name == name }
    }
}
