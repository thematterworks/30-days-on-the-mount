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

    static let placeholder = JourneySnapshot(
        dayNumber: 1,
        totalDays: 31,
        title: "Poor in Spirit",
        practiceTitle: "Relinquishing the Right to be Right",
        hookText: "Go the entire day without defending yourself, explaining your actions, or justifying your opinions.",
        finishedToday: false,
        updatedAt: .distantPast
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
