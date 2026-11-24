import OSLog
import UIKit

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    /// Set by MountApp. A token that arrives first is held and handed over
    /// when it is.
    var onDeviceToken: ((String) -> Void)? {
        didSet { if let pendingToken { onDeviceToken?(pendingToken) } }
    }
    private var pendingToken: String?

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Logger.notifications.info("APNs device token: \(token, privacy: .private)")
        pendingToken = token
        onDeviceToken?(token)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Logger.notifications.error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }
}
