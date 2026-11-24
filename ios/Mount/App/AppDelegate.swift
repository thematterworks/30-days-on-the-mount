import OSLog
import UIKit

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        // Phase 3 sends this to POST /api/mobile/devices so the server can push.
        Logger.notifications.info("APNs device token: \(token, privacy: .private)")
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Logger.notifications.error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }
}
