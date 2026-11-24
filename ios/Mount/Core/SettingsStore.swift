import Foundation
import Observation

/// The participant's preferences. Each one here changes something real in the
/// app today; the rhythm settings are also sent to the server once the mobile
/// API exists (ios/ARCHITECTURE.md, Phase 2), which is what moves the actual
/// delivery time.
@MainActor
@Observable
final class SettingsStore {
    /// Scales scripture and story reading text, 85%–140%.
    var readingScale: Double { didSet { save("readingScale", readingScale) } }
    /// Local hour for the morning invitation.
    var morningHour: Int { didSet { save("morningHour", morningHour) } }
    var eveningCheckIn: Bool { didSet { save("eveningCheckIn", eveningCheckIn) } }
    /// Whether finishing a day's story starts its Live Activity.
    var liveActivities: Bool { didSet { save("liveActivities", liveActivities) } }
    /// Whether today's story opens at the threshold — the three breaths.
    var thresholdBreaths: Bool { didSet { save("thresholdBreaths", thresholdBreaths) } }

    private let defaults = SharedStore.defaults

    init() {
        let d = SharedStore.defaults
        readingScale = d.object(forKey: "settings.readingScale") as? Double ?? 1
        morningHour = d.object(forKey: "settings.morningHour") as? Int ?? 8
        eveningCheckIn = d.object(forKey: "settings.eveningCheckIn") as? Bool ?? true
        liveActivities = d.object(forKey: "settings.liveActivities") as? Bool ?? true
        thresholdBreaths = d.object(forKey: "settings.thresholdBreaths") as? Bool ?? true
    }

    private func save(_ key: String, _ value: Any) {
        defaults.set(value, forKey: "settings.\(key)")
    }
}
