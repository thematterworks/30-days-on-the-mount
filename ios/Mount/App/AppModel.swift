import Foundation
import Observation

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

    var selectedTab: HubTab = .journey
    var storyRoute: StoryRoute?
    var isProfilePresented = false

    init() {
        // Preview services until the mobile API exists (ios/ARCHITECTURE.md,
        // Phase 2). The Remote* implementations replace these here and
        // nowhere else.
        let liveActivity = LiveActivityController()
        let settings = SettingsStore()
        self.liveActivity = liveActivity
        self.settings = settings
        session = SessionStore(auth: PreviewAuthService())
        journey = JourneyStore(source: BundledCurriculumSource(), liveActivity: liveActivity, settings: settings)
        companion = CompanionStore(service: PreviewCompanionService())
        bible = BibleStore()
        notifications = NotificationCoordinator()

        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-previewSignedIn"), session.session == nil {
            session.signInForPreview()
        }
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
        #endif

        notifications.configure()
        notifications.onOpen = { [weak self] link in self?.open(link) }
        notifications.onReply = { [weak self] text, dayNumber in
            guard let self else { return }
            let day = dayNumber ?? journey.progress.currentDay
            Task { await self.companion.send(text, dayNumber: day) }
        }
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

    /// Preview-build account deletion: clears everything this device holds.
    /// Phase 2 also calls DELETE /api/mobile/account (App Store 5.1.1(v)).
    func deleteAccountLocally() async {
        await liveActivity.endAll()
        journey.clearLocalData()
        companion.clearLocalData()
        bible.clearLocalData()
        isProfilePresented = false
        session.signOut()
    }
}
