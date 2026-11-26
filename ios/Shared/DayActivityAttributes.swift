import ActivityKit
import Foundation

/// The Live Activity for a day in progress: on the Lock Screen and in the
/// Dynamic Island once the participant carries the day's practice out with
/// them, and again in the evening as the check-in.
struct DayActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable, Sendable {
        enum Phase: String, Codable, Hashable, Sendable {
            /// The practice was accepted and is being lived out.
            case carrying
            /// The evening check-in is open — the same prompt SMS users get.
            case eveningCheckIn
            /// The day is closed.
            case rested
        }

        var phase: Phase
        var prompt: String?
    }

    var dayNumber: Int
    var totalDays: Int
    var title: String
    var practiceTitle: String
    /// The day's scripture, e.g. "Matthew 5:4". Optional so activities
    /// started before it existed still decode.
    var scriptureReference: String?

    /// The reference short enough for the Dynamic Island: "Matt 5:4".
    var shortReference: String? {
        scriptureReference?
            .replacingOccurrences(of: "Matthew", with: "Matt")
            .replacingOccurrences(of: "Corinthians", with: "Cor")
            .replacingOccurrences(of: "-", with: "\u{2013}")
    }
}
