import Foundation

enum DayState: Sendable, Equatable {
    case completed, active, locked
}

/// Where a participant is in the journey.
///
/// Mirrors the web's rule in components/journey/JourneyStack.tsx exactly:
/// days before `currentDay` are completed, `currentDay` is active, later days
/// are locked. No skipping ahead — the server enforces the same rule.
struct JourneyProgress: Codable, Equatable, Sendable {
    /// Advanced by the server's daily push, never by the app on its own.
    var currentDay: Int
    /// Days whose guided story the participant finished in the app. Kept
    /// apart from `currentDay` because finishing a story does not unlock
    /// tomorrow — the morning does.
    var finishedStories: Set<Int> = []

    func state(of dayNumber: Int) -> DayState {
        if dayNumber < currentDay { return .completed }
        if dayNumber == currentDay { return .active }
        return .locked
    }

    func canOpen(_ dayNumber: Int) -> Bool {
        dayNumber >= 1 && state(of: dayNumber) != .locked
    }

    var hasFinishedToday: Bool {
        finishedStories.contains(currentDay)
    }
}
