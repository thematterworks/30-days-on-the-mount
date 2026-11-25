import Foundation
import Testing
@testable import Mount

@Suite("Journey progress")
struct JourneyProgressTests {
    @Test func daysBeforeCurrentAreCompletedCurrentIsActiveLaterAreLocked() {
        let progress = JourneyProgress(currentDay: 4)
        #expect(progress.state(of: 3) == .completed)
        #expect(progress.state(of: 4) == .active)
        #expect(progress.state(of: 5) == .locked)
    }

    @Test func noSkippingAhead() {
        let progress = JourneyProgress(currentDay: 4)
        #expect(progress.canOpen(1))
        #expect(progress.canOpen(4))
        #expect(!progress.canOpen(5))
        #expect(!progress.canOpen(0), "Day 0 is the welcome and has no story")
    }

    @Test func finishingAStoryDoesNotUnlockTomorrow() {
        var progress = JourneyProgress(currentDay: 4)
        progress.finishedStories.insert(4)
        #expect(progress.hasFinishedToday)
        #expect(progress.state(of: 5) == .locked)
    }
}

@Suite("Deep links")
struct DeepLinkTests {
    @Test(arguments: [DeepLink.day(1), .day(31), .companion])
    func roundTrips(_ link: DeepLink) {
        #expect(DeepLink(url: link.url) == link)
    }

    @Test(arguments: ["https://evil.com/day/3", "mount://day/0", "mount://day/abc", "mount://admin", "other://companion"])
    func rejectsAnythingElse(_ raw: String) {
        #expect(DeepLink(url: URL(string: raw)!) == nil)
    }
}

@Suite("Phone numbers")
struct PhoneNumberTests {
    @Test(arguments: [
        ("(310) 902-8045", "13109028045"),
        ("310.902.8045", "13109028045"),
        ("+1 310 902 8045", "13109028045"),
        ("13109028045", "13109028045"),
        ("+44 20 7946 0958", "442079460958"),
    ])
    func canonicalizesToTheServersFormat(_ input: String, _ expected: String) {
        #expect(PhoneNumber.canonical(input) == expected)
    }

    @Test(arguments: ["", "12345", "23109028045", "442079460958", "call me"])
    func rejectsInvalidInput(_ input: String) {
        #expect(PhoneNumber.canonical(input) == nil)
    }
}

@Suite("Bundled curriculum")
struct CurriculumTests {
    @Test func containsAllThirtyOneDaysInOrderWithContent() async throws {
        let days = try await BundledCurriculumSource().loadDays()
        #expect(days.map(\.dayNumber) == Array(1...31))
        for day in days {
            #expect(!day.title.isEmpty, "Day \(day.dayNumber) title")
            #expect(!day.hookText.isEmpty, "Day \(day.dayNumber) hook")
            #expect(!day.scriptureReference.isEmpty, "Day \(day.dayNumber) reference")
            #expect(!day.scriptureText.isEmpty, "Day \(day.dayNumber) scripture")
            #expect(!day.exegesisParagraphs.isEmpty, "Day \(day.dayNumber) exegesis")
            #expect(!day.practiceTitle.isEmpty, "Day \(day.dayNumber) practice")
        }
    }

    @Test func omitsTheTeachingScreenWhenThereIsNoVideo() async throws {
        let day = try #require(try await BundledCurriculumSource().loadDays().first)
        #expect(day.teachingVideoURL == nil)
        #expect(StoryScreen.screens(for: day) == [.hook, .scripture, .exegesis, .reflection, .surrender])
    }
}

@Suite("Story scrolling")
struct StoryLayoutTests {
    // Three cards on an 800-point screen: short, a 2,000-point article, short.
    let layout = StoryLayout(heights: [800, 2000, 800], viewport: 800)

    @Test func shortCardsSnapOneAtATime() {
        #expect(layout.rest(from: 0, proposed: 300) == 800)
        #expect(layout.rest(from: 0, proposed: 60) == 0)
    }

    @Test func anArticleScrollsFreely() {
        #expect(layout.rest(from: 800, proposed: 1500) == 1500)
    }

    @Test func aFlickStopsAtTheArticlesEndThenMovesOn() {
        #expect(layout.rest(from: 1500, proposed: 2600) == 2000)
        #expect(layout.rest(from: 2000, proposed: 2300) == 2800)
    }

    @Test func comingBackUpLandsAtTheArticlesEnd() {
        #expect(layout.rest(from: 2800, proposed: 2500) == 2000)
    }

    @Test func progressFillsThroughTheArticle() {
        #expect(layout.card(at: 1400) == 1)
        #expect(layout.progress(of: 1, at: 1400) == 0.5)
        #expect(layout.progress(of: 0, at: 0) == 1)
    }
}

@Suite("Bundled Bible")
struct BibleTests {
    @Test func hasTheWholeCanonInOrder() async throws {
        let books = try await BibleDatabase().books()
        #expect(books.count == 66)
        #expect(books.first?.name == "Genesis")
        #expect(books.last?.name == "Revelation")
        #expect(books.first { $0.name == "Psalms" }?.chapters == 150)
        #expect(books.filter { $0.testament == .new }.count == 27)
    }

    @Test func readsTheSermonCleanly() async throws {
        let verses = try await BibleDatabase().chapter(.sermonOnTheMount)
        let three = try #require(verses.first { $0.number == 3 })
        #expect(three.text.contains("Blessed are the poor in spirit, for theirs is the kingdom of heaven."))
        for verse in verses {
            #expect(!verse.text.contains("["), "Matthew 5:\(verse.number) still has an editorial bracket")
            #expect(!verse.text.contains(" - "), "Matthew 5:\(verse.number) still has a placeholder dash")
            #expect(!verse.text.lowercased().contains("vvv"), "Matthew 5:\(verse.number) still has a vvv marker")
        }
    }

    @Test func searchFindsWordsByPrefixAndSurvivesPunctuation() async throws {
        let database = try BibleDatabase()
        let hits = try await database.search("blessed meek")
        #expect(hits.contains { $0.verse.book == 40 && $0.verse.chapter == 5 && $0.verse.number == 5 })
        #expect(try await database.search("bless").isEmpty == false)
        #expect(try await database.search("\"(*:)\"").isEmpty, "punctuation-only input must not throw")
    }

    @Test(arguments: [
        ("John 3:16", 43, 3, 16),
        ("jn 3", 43, 3, nil),
        ("1 cor 13", 46, 13, nil),
        ("Matthew 5:21-22", 40, 5, 21),
        ("ps 23", 19, 23, nil),
    ] as [(String, Int, Int, Int?)])
    func parsesReferences(_ text: String, _ book: Int, _ chapter: Int, _ verse: Int?) async throws {
        let books = try await BibleDatabase().books()
        #expect(ScriptureReference.parse(text, books: books) == .init(book: book, chapter: chapter, verse: verse))
    }

    @Test(arguments: ["blessed are the meek", "John 99", "Hezekiah 1", "j 3"])
    func rejectsNonReferences(_ text: String) async throws {
        let books = try await BibleDatabase().books()
        #expect(ScriptureReference.parse(text, books: books) == nil)
    }
}

@Suite("Mobile API")
struct MobileAPITests {
    @Test func decodesPostgresTimestamps() throws {
        struct Stamp: Decodable { let at: Date }
        for raw in ["2026-11-24T07:52:17.774+00:00", "2026-11-24T07:52:17+00:00", "2026-11-24T07:52:17Z"] {
            let stamp = try APIClient.decoder.decode(Stamp.self, from: Data(#"{"at":"\#(raw)"}"#.utf8))
            #expect(Calendar(identifier: .gregorian).component(.year, from: stamp.at) == 2026)
        }
    }

    @Test func serverContentOverlaysButNeverBlanksADay() throws {
        let bundled = try #require(try BundledCurriculumSource().loadDaysSync().first)
        let remote = JourneyRemoteState.Day(
            dayNumber: bundled.dayNumber, title: "Edited title", hook: "", scriptureReference: "",
            scriptureText: "", scriptureAudioURL: nil, teachingVideoURL: "https://example.com/v.mp4",
            exegesis: "  ", surrender: "", eveningPrompt: "Where did you notice mercy today?"
        )
        let merged = bundled.overlaid(remote)
        #expect(merged.title == "Edited title")
        #expect(merged.hookText == bundled.hookText)
        #expect(merged.exegesisText == bundled.exegesisText)
        #expect(merged.practiceTitle == bundled.practiceTitle)
        #expect(merged.teachingVideoURL?.absoluteString == "https://example.com/v.mp4")
    }
}

private extension BundledCurriculumSource {
    func loadDaysSync() throws -> [JourneyDay] {
        let url = try #require(Bundle.main.url(forResource: "SampleCurriculum", withExtension: "json"))
        return try JSONDecoder().decode([JourneyDay].self, from: Data(contentsOf: url))
    }
}

@Suite("Widgets")
struct WidgetTimelineTests {
    @Test func lockScreenTakesTheFirstSentence() {
        let verse = JourneySnapshot.lockScreenVerse(from: "Blessed are the meek, for they will inherit the earth. Blessed are those who hunger.")
        #expect(verse == "Blessed are the meek, for they will inherit the earth.")
    }

    @Test func eveningPromptFallsBackWhenTheServerHasNone() throws {
        let bundled = try #require(try BundledCurriculumSource().loadDaysSync().first)
        #expect(bundled.eveningPrompt == nil)
    }
}

@Suite("Companion")
struct CompanionDividerTests {
    @Test func marksTheFirstMessageOfEachDay() {
        let messages = [
            CompanionMessage(author: .participant, text: "before", dayNumber: nil),
            CompanionMessage(author: .participant, text: "a", dayNumber: 1),
            CompanionMessage(author: .companion, text: "b", dayNumber: 1),
            CompanionMessage(author: .participant, text: "c", dayNumber: 3),
        ]
        let starts = messages.indices.map { CompanionView.dayBeginning(at: $0, in: messages) }
        #expect(starts == [nil, 1, nil, 3])
    }
}

@Suite("Day titles")
struct DayTitleTests {
    @Test(arguments: [
        ("Day 31: The Ongoing Zoe", "The Ongoing Zoe"),
        ("Day 4 – Hunger for Truth", "Hunger for Truth"),
        ("Poor in Spirit", "Poor in Spirit"),
        ("Day 7:", "Day 7:"),
    ])
    func serverTitlesDropTheDayNumber(raw: String, expected: String) {
        #expect(JourneyDay.bareTitle(raw) == expected)
    }
}

@Suite("Voice transcript")
struct VoiceTranscriptTests {
    @Test func deliveryCuesAreRemoved() {
        #expect(VoiceConversation.spokenText("[warmly] That is such a deep question.") == "That is such a deep question.")
        #expect(VoiceConversation.spokenText("You know [pause] it's beautiful.") == "You know it's beautiful.")
        #expect(VoiceConversation.spokenText("[softly]") == "")
    }
}
