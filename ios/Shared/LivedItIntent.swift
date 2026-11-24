import ActivityKit
import AppIntents
import Foundation

/// "I lived it" — closes the day's practice straight from the Lock Screen or
/// the Dynamic Island, without opening the app. The Live Activity moves to its
/// rested state. Compiled into both targets because a LiveActivityIntent's
/// button lives in the widget extension while it performs in the app process.
struct LivedItIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "I lived it"
    static let description = IntentDescription("Marks today's practice as lived.")

    @Parameter(title: "Day")
    var dayNumber: Int

    init() {}

    init(dayNumber: Int) {
        self.dayNumber = dayNumber
    }

    func perform() async throws -> some IntentResult {
        for activity in Activity<DayActivityAttributes>.activities where activity.attributes.dayNumber == dayNumber {
            await activity.update(ActivityContent(state: .init(phase: .rested, prompt: nil), staleDate: nil))
        }
        return .result()
    }
}
