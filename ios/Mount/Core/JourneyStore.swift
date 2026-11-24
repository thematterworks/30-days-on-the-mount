import Foundation
import Observation
import OSLog
import WidgetKit

/// A day's reflection and the Curious Inspector's question back — what the
/// back of a completed day's card shows.
struct SavedReflection: Codable, Hashable, Sendable {
    let text: String
    let question: String
}

@MainActor
@Observable
final class JourneyStore {
    private(set) var days: [JourneyDay] = []
    private(set) var progress: JourneyProgress
    private(set) var loadError: String?
    private(set) var reflections: [Int: SavedReflection]

    private let source: any CurriculumSource
    private let service: (any JourneyService)?
    private let liveActivity: LiveActivityController
    private let settings: SettingsStore
    private static let progressKey = "journey.progress.v1"
    private static let reflectionsKey = "journey.reflections.v1"
    private static let dawnKey = "journey.lastDawnSeen.v1"

    init(source: any CurriculumSource, service: (any JourneyService)?, liveActivity: LiveActivityController, settings: SettingsStore) {
        self.source = source
        self.service = service
        self.liveActivity = liveActivity
        self.settings = settings
        progress = SharedStore.defaults.data(forKey: Self.progressKey)
            .flatMap { try? JSONDecoder().decode(JourneyProgress.self, from: $0) }
            ?? JourneyProgress(currentDay: 1)
        reflections = SharedStore.defaults.data(forKey: Self.reflectionsKey)
            .flatMap { try? JSONDecoder().decode([Int: SavedReflection].self, from: $0) } ?? [:]
    }

    var totalDays: Int { days.count }
    var today: JourneyDay? { day(progress.currentDay) }

    func day(_ number: Int) -> JourneyDay? {
        days.first { $0.dayNumber == number }
    }

    func state(of number: Int) -> DayState { progress.state(of: number) }
    func canOpen(_ number: Int) -> Bool { progress.canOpen(number) && day(number) != nil }
    func hasFinished(_ number: Int) -> Bool { progress.finishedStories.contains(number) }

    func load() async {
        do {
            days = try await source.loadDays()
            loadError = nil
            publishSnapshot()
        } catch {
            loadError = error.localizedDescription
            Logger.app.error("Curriculum failed to load: \(error.localizedDescription, privacy: .public)")
            return
        }
        await sync()
    }

    /// Takes the server's word on where the participant is and on each open
    /// day's content. The bundled curriculum stays the base — it is what
    /// opens instantly and offline — and anything edited in the admin since
    /// this build shipped is laid over it.
    func sync() async {
        guard let service else { return }
        let remote: JourneyRemoteState
        do {
            remote = try await service.fetch()
        } catch {
            Logger.app.error("Journey sync failed: \(error.localizedDescription, privacy: .public)")
            return
        }

        let updates = Dictionary(remote.days.map { ($0.dayNumber, $0) }, uniquingKeysWith: { _, last in last })
        days = days.map { day in updates[day.dayNumber].map(day.overlaid) ?? day }

        let currentDay = min(max(remote.currentDay, 1), max(totalDays, 1))
        if currentDay != progress.currentDay {
            // A new morning: yesterday's Live Activity has done its work.
            if currentDay > progress.currentDay { await liveActivity.endAll() }
            progress.currentDay = currentDay
        }
        persist()
    }

    /// The participant finished the day's guided story and carried the
    /// practice out with them. Only today's story starts a Live Activity —
    /// revisiting an earlier day is reading, not carrying.
    func finishStory(of day: JourneyDay) async {
        progress.finishedStories.insert(day.dayNumber)
        persist()
        if day.dayNumber == progress.currentDay, settings.liveActivities {
            await liveActivity.startCarrying(day, totalDays: totalDays)
        }
    }

    func saveReflection(_ text: String, question: String, for dayNumber: Int) {
        reflections[dayNumber] = SavedReflection(text: text, question: question)
        if let data = try? JSONEncoder().encode(reflections) {
            SharedStore.defaults.set(data, forKey: Self.reflectionsKey)
        }
    }

    /// True exactly once per day: the first time today's card is seen after
    /// the morning unlocks it. Drives the dawn animation, which should mark
    /// the day turning over — not replay on every visit.
    func claimDawn(for dayNumber: Int) -> Bool {
        guard dayNumber == progress.currentDay,
              dayNumber > SharedStore.defaults.integer(forKey: Self.dawnKey) else { return false }
        SharedStore.defaults.set(dayNumber, forKey: Self.dawnKey)
        return true
    }

    func clearLocalData() {
        progress = JourneyProgress(currentDay: 1)
        reflections = [:]
        for key in [Self.progressKey, Self.reflectionsKey, Self.dawnKey] {
            SharedStore.defaults.removeObject(forKey: key)
        }
        publishSnapshot()
    }

    #if DEBUG
    /// `-previewDay N`: starts a walkthrough partway through the journey.
    func setCurrentDayForPreview(_ day: Int) {
        progress.currentDay = max(1, day)
        persist()
    }

    /// Stands in for the morning push in preview builds, which have no server
    /// to advance current_day.
    func advanceDayForPreview() async {
        guard progress.currentDay < totalDays else { return }
        progress.currentDay += 1
        persist()
        await liveActivity.endAll()
    }
    #endif

    private func persist() {
        if let data = try? JSONEncoder().encode(progress) {
            SharedStore.defaults.set(data, forKey: Self.progressKey)
        }
        publishSnapshot()
    }

    /// Hands the widgets just what they render, then asks them to redraw.
    private func publishSnapshot() {
        guard let today else { return }
        SharedStore.saveSnapshot(JourneySnapshot(
            dayNumber: today.dayNumber,
            totalDays: totalDays,
            title: today.title,
            practiceTitle: today.practiceTitle,
            hookText: today.hookText,
            finishedToday: progress.hasFinishedToday,
            updatedAt: .now
        ))
        WidgetCenter.shared.reloadAllTimelines()
    }
}
