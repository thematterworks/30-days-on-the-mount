import SwiftUI

/// The moment the app opens: the mountain line draws itself across the
/// gradient, the name comes up beneath it, a breath of stillness, and it all
/// dissolves into the app. Unhurried on purpose: it's the threshold into a
/// quiet place, not a loading screen.
struct SplashView: View {
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var reveal = 0.0
    @State private var showsName = false

    var body: some View {
        VStack(spacing: 14) {
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 150)
                .foregroundStyle(Zoe.ink)
                .mask(alignment: .leading) {
                    GeometryReader { proxy in Rectangle().frame(width: proxy.size.width * reveal) }
                }
            Text("30 Days on the Mount")
                .font(.system(size: 11, weight: .regular))
                .tracking(2.6)
                .textCase(.uppercase)
                .foregroundStyle(Zoe.peach)
                .opacity(showsName ? 1 : 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ZoeAtmosphere(glow: 0.8))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("30 Days on the Mount")
        .task {
            if reduceMotion {
                reveal = 1
                showsName = true
                try? await Task.sleep(for: .milliseconds(2000))
            } else {
                withAnimation(.easeInOut(duration: 2.4).delay(0.3)) { reveal = 1 }
                withAnimation(.easeInOut(duration: 1.4).delay(1.9)) { showsName = true }
                try? await Task.sleep(for: .milliseconds(4000))
            }
            onFinish()
        }
    }
}
