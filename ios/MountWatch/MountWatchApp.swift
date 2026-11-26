import SwiftUI
import WatchConnectivity
import WidgetKit

/// On the Mount, on the wrist: the day you're on, its words, and a few
/// breaths. The iPhone sends the day over (WatchBridge), so the watch never
/// needs its own sign-in.
@main
struct MountWatchApp: App {
    @State private var receiver = WatchReceiver()

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environment(receiver)
        }
    }
}

/// Keeps the latest day the iPhone sent, in the watch's App Group so the
/// complication can read it too.
@MainActor
@Observable
final class WatchReceiver: NSObject, WCSessionDelegate {
    private(set) var snapshot: JourneySnapshot?

    override init() {
        snapshot = SharedStore.loadSnapshot()
        #if DEBUG
        // `-previewSnapshot`: a sample day, for walkthroughs and screenshots.
        if ProcessInfo.processInfo.arguments.contains("-previewSnapshot") { snapshot = .placeholder }
        #endif
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    private func receive(_ data: Data?) {
        guard let data, let snapshot = try? JSONDecoder().decode(JourneySnapshot.self, from: data) else { return }
        self.snapshot = snapshot
        SharedStore.saveSnapshot(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
        let data = session.receivedApplicationContext["snapshot"] as? Data
        Task { @MainActor in self.receive(data) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let data = applicationContext["snapshot"] as? Data
        Task { @MainActor in self.receive(data) }
    }
}
