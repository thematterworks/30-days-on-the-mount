import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Namespace private var zoom

    var body: some View {
        @Bindable var model = model
        Group {
            if model.session.session == nil {
                OnboardingView()
            } else if let error = model.journey.loadError {
                ContentUnavailableView("The journey couldn't open", systemImage: "mountain.2", description: Text(error))
            } else {
                MainTabView(zoomNamespace: zoom)
            }
        }
        .zoeAtmosphere()
        .task { await model.journey.load() }
        .task { await model.bible.load() }
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
