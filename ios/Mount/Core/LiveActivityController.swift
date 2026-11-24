import ActivityKit
import Foundation
import OSLog

/// Owns the day's Live Activity — at most one at a time.
///
/// Deliberately not main-actor isolated: `Activity` is not Sendable, so every
/// lookup, update and end happens inside one nonisolated call rather than
/// handing an activity across actors.
///
/// iOS ends a Live Activity after eight hours active (it lingers on the Lock
/// Screen up to four more), so a morning activity cannot carry through to the
/// evening check-in on its own. Phase 3 has the server start the evening one
/// with a push-to-start token; until then `beginEveningCheckIn` updates or
/// starts one locally.
struct LiveActivityController: Sendable {
    var isAvailable: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    func startCarrying(_ day: JourneyDay, totalDays: Int) async {
        await show(day: day, totalDays: totalDays, state: .init(phase: .carrying, prompt: nil))
    }

    func beginEveningCheckIn(_ day: JourneyDay, totalDays: Int, prompt: String) async {
        await show(day: day, totalDays: totalDays, state: .init(phase: .eveningCheckIn, prompt: prompt))
    }

    func endAll() async {
        for activity in Activity<DayActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private func show(day: JourneyDay, totalDays: Int, state: DayActivityAttributes.ContentState) async {
        guard isAvailable else {
            Logger.liveActivity.info("Live Activities are disabled; skipping")
            return
        }
        let content = ActivityContent(state: state, staleDate: Calendar.current.startOfDay(for: .now).addingTimeInterval(86_400))

        if let existing = Activity<DayActivityAttributes>.activities.first(where: { $0.attributes.dayNumber == day.dayNumber }) {
            await existing.update(content)
            return
        }
        // A different day's activity is still up — yesterday's. Replace it.
        await endAll()

        let attributes = DayActivityAttributes(
            dayNumber: day.dayNumber,
            totalDays: totalDays,
            title: day.title,
            practiceTitle: day.practiceTitle
        )
        do {
            // pushType becomes .token in Phase 3, when the server updates it.
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            Logger.liveActivity.error("Could not start Live Activity: \(error.localizedDescription, privacy: .public)")
        }
    }
}
