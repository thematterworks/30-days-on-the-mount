import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @Namespace private var zoom
    @State private var isShowingSplash = true

    var body: some View {
        @Bindable var model = model
        Group {
            if model.session.session == nil {
                OnboardingView()
            } else if !model.hasBeenWelcomed {
                WelcomeView()
                    .transition(.opacity)
            } else if let error = model.journey.loadError {
                ContentUnavailableView("The journey couldn't open", systemImage: "mountain.2", description: Text(error))
            } else {
                MainTabView(zoomNamespace: zoom)
            }
        }
        .zoeAtmosphere()
        .overlay {
            if isShowingSplash {
                SplashView { withAnimation(.easeInOut(duration: 1.4)) { isShowingSplash = false } }
                    .transition(.opacity)
            }
        }
        .task { await model.journey.load() }
        .task { await model.bible.load() }
        // On sign-in, and whenever the app comes back: the morning may have
        // turned over, or a reply arrived by text.
        .task(id: model.session.session?.token) { await model.refresh() }
        .task(id: model.session.session != nil) {
            if model.session.session != nil { await model.audio.begin() }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                model.audio.enterForeground()
                model.applyFocus()
                Task { await model.refresh() }
            case .background:
                model.audio.enterBackground()
            default:
                break
            }
        }
        .fullScreenCover(item: $model.storyRoute) { route in
            if let day = model.journey.day(route.dayNumber) {
                // The day's title grows into its story, and the story shrinks
                // back into the day when closed.
                GuidedStoryView(day: day)
                    .navigationTransition(.zoom(sourceID: route.dayNumber, in: zoom))
            }
        }
    }
}
