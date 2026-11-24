import Foundation
import Observation
import OSLog
import SwiftUI
import UIKit
import UserNotifications

/// Composition root and coordinator. Builds the services, owns the stores,
/// and is the single place navigation requests arrive — from tabs, widgets,
/// Live Activities and notifications — so every surface opens the app the
/// same way.
@MainActor
@Observable
final class AppModel {
    enum HubTab: Hashable { case journey, bible, companion, library }

    struct StoryRoute: Identifiable, Hashable {
        let dayNumber: Int
        var id: Int { dayNumber }
    }

    let session: SessionStore
    let journey: JourneyStore
    let companion: CompanionStore
    let bible: BibleStore
    let settings: SettingsStore
    let notifications: NotificationCoordinator
    let liveActivity: LiveActivityController
    let audio: AudioDirector
    let avatar = AvatarStore()
    /// The server can read aloud; listen buttons appear only when it can.
    private(set) var voiceAvailable = false

    var selectedTab: HubTab = .journey
    var storyRoute: StoryRoute?
    var isProfilePresented = false
    /// Whether this person has been through the welcome on this phone.
    private(set) var hasBeenWelcomed = SharedStore.defaults.bool(forKey: AppModel.welcomedKey)
    private static let welcomedKey = "welcome.completed.v1"

    /// True only for DEBUG launches running entirely on-device.
    let usesPreviewServices: Bool
    private let account: any AccountService
    private static let deviceTokenKey = "push.apnsToken.v1"

    init() {
        let liveActivity = LiveActivityController()
        let settings = SettingsStore()
        let token = SessionToken()
        self.liveActivity = liveActivity
        self.settings = settings
        bible = BibleStore()
        notifications = NotificationCoordinator()

        // The mobile API (app/api/mobile/*) everywhere, except DEBUG launches
        // that ask for the on-device preview services — UI tests and
        // simulator walkthroughs, which shouldn't text anyone or need a server.
        var usePreviewServices = false
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        usePreviewServices = arguments.contains("-previewServices") || arguments.contains("-previewSignedIn")
        #endif
        usesPreviewServices = usePreviewServices

        if usePreviewServices {
            session = SessionStore(auth: PreviewAuthService(), token: token)
            journey = JourneyStore(source: BundledCurriculumSource(), service: nil, liveActivity: liveActivity, settings: settings)
            companion = CompanionStore(service: PreviewCompanionService())
            account = PreviewAccountService()
            audio = AudioDirector(media: PreviewMediaService())
        } else {
            // A 401 means the session can't be trusted any more; sign-in is
            // the only useful place to be.
            let client = APIClient(token: token) { @Sendable in
                Task { @MainActor in AppModel.current?.signOut(notifyServer: false) }
            }
            session = SessionStore(auth: RemoteAuthService(client: client), token: token)
            journey = JourneyStore(source: BundledCurriculumSource(), service: RemoteJourneyService(client: client), liveActivity: liveActivity, settings: settings)
            companion = CompanionStore(service: RemoteCompanionService(client: client))
            account = RemoteAccountService(client: client)
            audio = AudioDirector(media: RemoteMediaService(client: client))
            // Sessions issued by earlier preview builds were never known to
            // the server.
            if session.session?.isPreview == true { session.signOut() }
        }

        #if DEBUG
        if arguments.contains("-previewSignedIn"), session.session == nil {
            session.signInForPreview()
        }
        // Walkthroughs land in the hub unless they ask for the welcome.
        if arguments.contains("-previewSignedIn") { hasBeenWelcomed = !arguments.contains("-previewWelcome") }
        // `-previewTab bible|companion|library` and `-previewProfile` open a
        // screen directly, for UI tests and simulator walkthroughs.
        if let index = arguments.firstIndex(of: "-previewTab"), arguments.indices.contains(index + 1) {
            selectedTab = switch arguments[index + 1] {
            case "bible": .bible
            case "companion": .companion
            case "library": .library
            default: .journey
            }
        }
        isProfilePresented = arguments.contains("-previewProfile")
        if let index = arguments.firstIndex(of: "-previewDay"), arguments.indices.contains(index + 1),
           let day = Int(arguments[index + 1]) {
            journey.setCurrentDayForPreview(day)
        }
        #endif

        Self.current = self
        notifications.configure()
        notifications.onOpen = { [weak self] link in self?.open(link) }
        notifications.onReply = { [weak self] text, dayNumber in
            guard let self else { return }
            let day = dayNumber ?? journey.progress.currentDay
            Task { await self.companion.send(text, dayNumber: day) }
        }
    }

    /// The one AppModel, for callbacks that arrive outside SwiftUI (the API
    /// client's 401 handler).
    private static weak var current: AppModel?

    /// Runs once the participant is signed in, and again each time the app
    /// returns to the foreground: the server's current day, the
    /// conversation, and the morning hour.
    func refresh() async {
        guard session.session != nil else { return }
        async let journeySync: Void = journey.sync()
        async let companionSync: Void = companion.refresh()
        if let participant = try? await account.participant() {
            voiceAvailable = participant.features?.voice ?? false
            if let hour = participant.preferredHour, (5..<12).contains(hour) {
                settings.morningHour = hour
            }
        }
        _ = await (journeySync, companionSync)
        await registerForPushIfAllowed()
    }

    /// The morning hour is where the server sends the day, so a change
    /// here moves delivery itself.
    func morningHourChanged(to hour: Int) {
        // The evening widget moves with it.
        journey.refreshWidgets()
        Task {
            do {
                try await account.updateMorningHour(hour, timezone: TimeZone.current.identifier)
            } catch {
                Logger.app.error("Morning hour didn't save: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    // MARK: Push

    private func registerForPushIfAllowed() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func didReceiveDeviceToken(_ token: String) {
        SharedStore.defaults.set(token, forKey: Self.deviceTokenKey)
        guard session.session != nil else { return }
        Task {
            do {
                try await account.registerDevice(apnsToken: token)
            } catch {
                Logger.notifications.error("Device registration failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    /// The welcome ends on Day 1 — or wherever someone already is.
    func finishWelcome() {
        SharedStore.defaults.set(true, forKey: Self.welcomedKey)
        audio.stopSpeaking()
        selectedTab = .journey
        withAnimation(.easeInOut(duration: 1.2)) { hasBeenWelcomed = true }
    }

    // MARK: Leaving

    /// Signs out and clears what this phone holds of the journey, so the
    /// next person to sign in on it starts clean. The server keeps
    /// everything; signing back in restores it.
    func signOut(notifyServer: Bool = true) {
        let deviceToken = SharedStore.defaults.string(forKey: Self.deviceTokenKey)
        if notifyServer, let deviceToken, session.session != nil {
            // Before the token is cleared, so the request is still signed.
            let account = account
            Task { try? await account.unregisterDevice(apnsToken: deviceToken) }
        }
        Task { await liveActivity.endAll() }
        audio.stopSpeaking()
        isProfilePresented = false
        storyRoute = nil
        journey.clearLocalData()
        companion.clearLocalData()
        avatar.clearLocalData()
        // The next person to sign in here deserves the welcome too.
        SharedStore.defaults.removeObject(forKey: Self.welcomedKey)
        hasBeenWelcomed = false
        session.signOut()
    }

    /// Two letters for the avatar until profiles carry a name and photo.
    var profileInitials: String {
        guard let phone = session.session?.phoneNumber else { return "·" }
        return String(phone.suffix(2))
    }

    func open(_ link: DeepLink) {
        switch link {
        case .day(let number):
            guard journey.canOpen(number) else { return }
            selectedTab = .journey
            storyRoute = StoryRoute(dayNumber: number)
        case .companion:
            // The story is a full-screen cover; it closes so the companion
            // tab is what the participant lands on.
            storyRoute = nil
            selectedTab = .companion
        }
    }

    /// Opens a passage in the Bible tab — "read it in context" from a day's
    /// scripture, or a verse the companion cites.
    func openScripture(_ reference: String) {
        guard let (ref, verse) = ChapterRef.from(reference: reference, books: bible.books) else { return }
        storyRoute = nil
        selectedTab = .bible
        Task { await bible.open(ref, focus: verse) }
    }

    /// Hands a passage to the companion as the start of a message.
    func askCompanion(about passage: String, label: String) {
        selectedTab = .companion
        Task { await companion.send("\(label) — “\(passage)”\n\nWhat is this inviting me into?", dayNumber: journey.progress.currentDay) }
    }

    /// Deletes the account on the server (App Store 5.1.1(v)), then
    /// everything this device holds. Throws, leaving the account intact, if
    /// the server couldn't do it.
    func deleteAccount() async throws {
        try await account.deleteAccount()
        bible.clearLocalData()
        signOut(notifyServer: false)
    }
}
