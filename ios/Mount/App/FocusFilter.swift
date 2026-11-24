import AppIntents
import Foundation

/// "On the Mount" as a Focus filter. Someone adds it to a Focus of their
/// own (Settings → Focus → a Focus → Focus Filters → On the Mount) — a
/// Sabbath or morning Focus, say — and that Focus does the silencing of
/// other apps, which an app can't do for itself. While it's on, this app
/// leans in: it opens to today and keeps the ambient music playing.
struct MountFocusFilter: SetFocusFilterIntent {
    static let title: LocalizedStringResource = "On the Mount"
    static let description: IntentDescription? = IntentDescription(
        "While this Focus is on, 30 Days on the Mount opens to today and keeps its quiet music playing."
    )

    // Optional, as Focus filters' parameters are: when the Focus turns off
    // the system performs the filter again with every value cleared.
    @Parameter(title: "Open to today's day", default: true)
    var openToToday: Bool?

    @Parameter(title: "Play ambient music", default: true)
    var playAmbient: Bool?

    var displayRepresentation: DisplayRepresentation {
        var parts: [String] = []
        if openToToday == true { parts.append("Opens to today") }
        if playAmbient == true { parts.append("Ambient music") }
        return DisplayRepresentation(
            title: "On the Mount",
            subtitle: LocalizedStringResource(stringLiteral: parts.isEmpty ? "Quiet" : parts.joined(separator: " · "))
        )
    }

    func perform() async throws -> some IntentResult {
        let state = MountFocusState(openToToday: openToToday ?? false, playAmbient: playAmbient ?? false)
        state.save()
        await MainActor.run { AppModel.current?.applyFocus(state) }
        return .result()
    }
}

/// What the Focus filter asked for, kept where the app reads it on
/// returning to the foreground.
struct MountFocusState: Codable, Equatable, Sendable {
    var openToToday: Bool
    var playAmbient: Bool

    var isActive: Bool { openToToday || playAmbient }

    private static let key = "focus.state.v1"

    func save() {
        if let data = try? JSONEncoder().encode(self) { SharedStore.defaults.set(data, forKey: Self.key) }
    }

    static func load() -> MountFocusState {
        SharedStore.defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(MountFocusState.self, from: $0) }
            ?? MountFocusState(openToToday: false, playAmbient: false)
    }
}
