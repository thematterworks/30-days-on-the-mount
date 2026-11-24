import SwiftUI

/// The hub: four places, one header. On iOS 26 the glass tab bar tucks away
/// while reading so the full-screen pages stay full-screen.
///
/// Each tab carries its own atmosphere: a TabView paints an opaque system
/// background behind every tab, which would otherwise hide the gradient set
/// at the root.
struct MainTabView: View {
    let zoomNamespace: Namespace.ID

    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            Tab("Journey", systemImage: "mountain.2", value: AppModel.HubTab.journey) {
                JourneyView(zoomNamespace: zoomNamespace)
                    .zoeAtmosphere(glow: 0.6)
            }
            Tab("Bible", systemImage: "book.closed", value: AppModel.HubTab.bible) {
                BibleView()
                    .zoeAtmosphere(glow: 0.3)
            }
            Tab("Companion", systemImage: "text.bubble", value: AppModel.HubTab.companion) {
                CompanionView()
                    .zoeAtmosphere(glow: 0.3)
            }
            Tab("Library", systemImage: "books.vertical", value: AppModel.HubTab.library) {
                LibraryView()
                    .zoeAtmosphere(glow: 0.3)
            }
        }
        .tint(Zoe.peach)
        .modifier(MinimizingTabBar())
        .sheet(isPresented: $model.isProfilePresented) {
            ProfileView()
        }
    }
}

private struct MinimizingTabBar: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}
