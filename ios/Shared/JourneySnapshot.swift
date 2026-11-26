import Foundation

/// The little the widgets need, written by the app into the shared App Group
/// so the extension never has to load or decode the curriculum itself.
struct JourneySnapshot: Codable, Equatable, Sendable {
    var dayNumber: Int
    var totalDays: Int
    var title: String
    var practiceTitle: String
    var hookText: String
    var finishedToday: Bool
    var updatedAt: Date
    /// The day's scripture, for the Lock Screen. Optional so snapshots saved
    /// by earlier builds still decode.
    var verse: String?
    var verseReference: String?
    var eveningPrompt: String?
    /// Local hour the evening check-in arrives: the morning hour plus 11, as
    /// the server's evening cron computes it.
    var eveningHour: Int?
    /// Tomorrow, and when it begins (the morning hour). The widgets and the
    /// watch switch to it on their own at that time, even if the app isn't
    /// opened. An array only because a struct can't hold itself directly;
    /// it has at most one element.
    var following: [JourneySnapshot]?
    var turnsAt: Date?

    /// The day as it should show at `date`: tomorrow once its morning has come.
    func current(at date: Date) -> JourneySnapshot {
        if let next = following?.first, let turnsAt, date >= turnsAt { return next }
        return self
    }

    static let fallbackEveningPrompt = "How did today's practice meet you?"

    /// The first sentence of the passage — what fits on a Lock Screen.
    static func lockScreenVerse(from text: String) -> String {
        var first = text
        text.enumerateSubstrings(in: text.startIndex..., options: .bySentences) { sentence, _, _, stop in
            if let sentence { first = sentence.trimmingCharacters(in: .whitespacesAndNewlines) }
            stop = true
        }
        return first
    }

    static let placeholder = JourneySnapshot(
        dayNumber: 1,
        totalDays: 31,
        title: "Poor in Spirit",
        practiceTitle: "Relinquishing the Right to be Right",
        hookText: "Go the entire day without defending yourself, explaining your actions, or justifying your opinions.",
        finishedToday: false,
        updatedAt: .distantPast,
        verse: "Blessed are the poor in spirit, for theirs is the kingdom of heaven.",
        verseReference: "Matthew 5:3",
        eveningPrompt: fallbackEveningPrompt,
        eveningHour: 19
    )
}

enum SharedStore {
    static let appGroupID = "group.com.thematterworks.mount"
    private static let snapshotKey = "journey.snapshot.v1"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    static func saveSnapshot(_ snapshot: JourneySnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: snapshotKey)
    }

    static func loadSnapshot() -> JourneySnapshot? {
        guard let data = defaults.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(JourneySnapshot.self, from: data)
    }
}
