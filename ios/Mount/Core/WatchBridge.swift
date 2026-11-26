import Foundation
import WatchConnectivity

/// Sends today's day to the Apple Watch app whenever the widgets' snapshot
/// changes. Application context keeps only the latest, and arrives even if
/// the watch app isn't running.
@MainActor
final class WatchBridge: NSObject, WCSessionDelegate {
    static let shared = WatchBridge()
    private var pending: JourneySnapshot?

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func send(_ snapshot: JourneySnapshot) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else {
            pending = snapshot
            return
        }
        guard session.isPaired, session.isWatchAppInstalled,
              let data = try? JSONEncoder().encode(snapshot) else { return }
        try? session.updateApplicationContext(["snapshot": data])
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
        Task { @MainActor in
            if let pending = self.pending {
                self.pending = nil
                self.send(pending)
            }
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        // A different watch was chosen: start again with it.
        session.activate()
    }
}
