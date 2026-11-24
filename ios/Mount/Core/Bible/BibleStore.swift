import Foundation
import Observation
import OSLog

@MainActor
@Observable
final class BibleStore {
    private(set) var books: [BibleBook] = []
    private(set) var location: ChapterRef
    private(set) var verses: [BibleVerse] = []
    private(set) var highlights: Set<VerseID>
    private(set) var loadError: String?
    /// A verse to scroll to and briefly mark after a jump from search or a
    /// "read in context" link.
    var focusVerse: VerseID?

    private let database: BibleDatabase?
    private static let locationKey = "bible.location.v1"
    private static let highlightsKey = "bible.highlights.v1"

    init() {
        do {
            database = try BibleDatabase()
        } catch {
            database = nil
            loadError = error.localizedDescription
        }
        location = SharedStore.defaults.data(forKey: Self.locationKey)
            .flatMap { try? JSONDecoder().decode(ChapterRef.self, from: $0) } ?? .sermonOnTheMount
        highlights = SharedStore.defaults.data(forKey: Self.highlightsKey)
            .flatMap { try? JSONDecoder().decode(Set<VerseID>.self, from: $0) } ?? []
    }

    var currentBook: BibleBook? { books.first { $0.id == location.book } }

    var title: String {
        guard let currentBook else { return "" }
        return "\(currentBook.name) \(location.chapter)"
    }

    func load() async {
        guard let database else { return }
        do {
            if books.isEmpty { books = try await database.books() }
            verses = try await database.chapter(location)
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
    }

    func open(_ ref: ChapterRef, focus verse: Int? = nil) async {
        location = ref
        focusVerse = verse.map { VerseID(book: ref.book, chapter: ref.chapter, verse: $0) }
        if let data = try? JSONEncoder().encode(ref) { SharedStore.defaults.set(data, forKey: Self.locationKey) }
        await load()
    }

    var previous: ChapterRef? {
        if location.chapter > 1 { return ChapterRef(book: location.book, chapter: location.chapter - 1) }
        guard let book = books.first(where: { $0.id == location.book - 1 }) else { return nil }
        return ChapterRef(book: book.id, chapter: book.chapters)
    }

    var next: ChapterRef? {
        if let book = currentBook, location.chapter < book.chapters {
            return ChapterRef(book: location.book, chapter: location.chapter + 1)
        }
        guard books.contains(where: { $0.id == location.book + 1 }) else { return nil }
        return ChapterRef(book: location.book + 1, chapter: 1)
    }

    func toggleHighlight(_ ids: Set<VerseID>) {
        if ids.isSubset(of: highlights) { highlights.subtract(ids) } else { highlights.formUnion(ids) }
        if let data = try? JSONEncoder().encode(highlights) { SharedStore.defaults.set(data, forKey: Self.highlightsKey) }
    }

    func search(_ text: String) async -> [SearchHit] {
        guard let database else { return [] }
        do { return try await database.search(text) } catch {
            Logger.app.error("Bible search failed: \(error.localizedDescription, privacy: .public)")
            return []
        }
    }

    func reference(for text: String) -> ScriptureReference.Parsed? {
        ScriptureReference.parse(text, books: books)
    }

    func label(for id: VerseID) -> String {
        "\(books.first { $0.id == id.book }?.name ?? "") \(id.chapter):\(id.verse)"
    }

    /// Readable label for a contiguous or scattered selection: "Matthew 5:3–5".
    func label(for ids: Set<VerseID>) -> String {
        let sorted = ids.sorted()
        guard let first = sorted.first, let last = sorted.last else { return "" }
        let name = books.first { $0.id == first.book }?.name ?? ""
        if first == last { return "\(name) \(first.chapter):\(first.verse)" }
        let contiguous = last.verse - first.verse + 1 == sorted.count && first.chapter == last.chapter
        return contiguous
            ? "\(name) \(first.chapter):\(first.verse)–\(last.verse)"
            : "\(name) \(first.chapter):" + sorted.map { String($0.verse) }.joined(separator: ", ")
    }

    func clearLocalData() {
        highlights = []
        SharedStore.defaults.removeObject(forKey: Self.highlightsKey)
        SharedStore.defaults.removeObject(forKey: Self.locationKey)
    }
}

extension ChapterRef {
    /// Parses the reference strings the curriculum carries ("Matthew 5:3",
    /// "Matthew 5:21-22") against the bundled book list.
    static func from(reference: String, books: [BibleBook]) -> (ChapterRef, Int?)? {
        guard let parsed = ScriptureReference.parse(reference, books: books) else { return nil }
        return (ChapterRef(book: parsed.book, chapter: parsed.chapter), parsed.verse)
    }
}
