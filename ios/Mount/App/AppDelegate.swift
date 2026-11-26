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
    /// Set by MountApp: catches up with the server when a notification
    /// wakes the app in the background (a new day's morning invitation).
    var onBackgroundRefresh: (() async -> Void)?

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Logger.notifications.info("APNs device token: \(token, privacy: .private)")
        pendingToken = token
        onDeviceToken?(token)
    }

    /// A notification about a day arrives with content-available: the app
    /// gets a few seconds in the background to sync, so the widgets, the
    /// watch and the Live Activity move to the new day without it opening.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
        guard let onBackgroundRefresh else { return .noData }
        await onBackgroundRefresh()
        return .newData
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Logger.notifications.error("APNs registration failed: \(error.localizedDescription, privacy: .public)")
    }
}
