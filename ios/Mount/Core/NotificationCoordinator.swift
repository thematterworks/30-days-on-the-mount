import Foundation
import OSLog
import UIKit
import UserNotifications

/// Notification permission, categories, and responses.
///
/// The evening check-in is the app's equivalent of the SMS reply: its
/// notification carries an inline text field, so a participant answers from
/// the Lock Screen exactly as they would answer a text, and the answer goes to
/// the same companion conversation.
@MainActor
final class NotificationCoordinator: NSObject, UNUserNotificationCenterDelegate {
    static let checkInCategory = "EVENING_CHECK_IN"
    static let replyAction = "REPLY"

    var onReply: (@MainActor (_ text: String, _ dayNumber: Int?) -> Void)?
    var onOpen: (@MainActor (DeepLink) -> Void)?

    func configure() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let reply = UNTextInputNotificationAction(
            identifier: Self.replyAction,
            title: "Reply",
            options: [],
            textInputButtonTitle: "Send",
            textInputPlaceholder: "How did it go?"
        )
        center.setNotificationCategories([
            UNNotificationCategory(identifier: Self.checkInCategory, actions: [reply], intentIdentifiers: [], options: []),
        ])
    }

    /// Asks once, at a moment that explains itself (right after sign-in), and
    /// registers for remote notifications if allowed.
    @discardableResult
    func requestAuthorization() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            if granted { UIApplication.shared.registerForRemoteNotifications() }
            return granted
        } catch {
            Logger.notifications.error("Authorization failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    #if DEBUG
    /// Schedules a local evening check-in, so the reply-from-Lock-Screen flow
    /// can be exercised before the server sends real pushes.
    func scheduleCheckInPreview(dayNumber: Int, prompt: String, after seconds: TimeInterval = 5) async {
        let content = UNMutableNotificationContent()
        content.title = "Day \(dayNumber) · Evening"
        content.body = prompt
        content.sound = .default
        content.categoryIdentifier = Self.checkInCategory
        content.userInfo = ["dayNumber": dayNumber, "link": DeepLink.companion.url.absoluteString]
        let request = UNNotificationRequest(
            identifier: "preview-checkin-\(dayNumber)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }
    #endif

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        // Pull out plain values before hopping to the main actor; the
        // response object itself is not Sendable.
        let action = response.actionIdentifier
        let replyText = (response as? UNTextInputNotificationResponse)?.userText
        let userInfo = response.notification.request.content.userInfo
        let dayNumber = userInfo["dayNumber"] as? Int
        let link = (userInfo["link"] as? String).flatMap(URL.init(string:)).flatMap(DeepLink.init(url:))

        await MainActor.run {
            if action == Self.replyAction, let replyText {
                onReply?(replyText, dayNumber)
            } else if action == UNNotificationDefaultActionIdentifier, let link {
                onOpen?(link)
            }
        }
    }
}
