import SwiftUI

@main
struct MountApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(Zoe.peach)
                .onOpenURL { url in
                    if let link = DeepLink(url: url) { model.open(link) }
                }
        }
    }
}
