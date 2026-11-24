import SwiftUI

/// The app's backdrop: the hour-tuned Zoe gradient under a soft gold "first
/// light" that breathes slowly at the top of the screen — about one breath
/// every twelve seconds, slow enough to settle into rather than notice.
///
/// Still under Reduce Motion. Widgets keep the plain static gradient.
struct ZoeAtmosphere: View {
    /// 0…1 — how present the first light is. Screens that ask for focus
    /// (the threshold, the surrender) turn it up; reading screens keep it low.
    var glow: Double = 0.6

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var inhale = false

    var body: some View {
        TimelineView(.everyMinute) { context in
            ZStack {
                Zoe.gradient(at: context.date)
                RadialGradient(
                    colors: [Zoe.peach.opacity(0.22 * glow), Zoe.peach.opacity(0.06 * glow), .clear],
                    center: .top,
                    startRadius: 0,
                    endRadius: 460
                )
                .scaleEffect(inhale ? 1.18 : 0.92, anchor: .top)
                .opacity(inhale ? 1 : 0.65)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 6).repeatForever(autoreverses: true)) { inhale = true }
        }
    }
}

extension View {
    func zoeAtmosphere(glow: Double = 0.6) -> some View {
        background(ZoeAtmosphere(glow: glow))
    }

    /// Liquid Glass on iOS 26, a quiet translucent fill before it. Reserved for
    /// the few controls that float over content; content itself stays flat.
    @ViewBuilder
    func zoeGlass<S: Shape>(in shape: S) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(.regular.tint(Zoe.deep.opacity(0.25)), in: shape)
        } else {
            background(Zoe.ink.opacity(0.08), in: shape)
        }
    }
}

/// Content that rises gently into place when its screen arrives — a few
/// points and a fade, staggered by `order` so a screen reads top to bottom.
struct Arrival: ViewModifier {
    let isActive: Bool
    let order: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(isActive ? 1 : 0)
            .offset(y: isActive || reduceMotion ? 0 : 14)
            .animation(
                reduceMotion ? .easeOut(duration: 0.2) : .easeOut(duration: 0.7).delay(isActive ? 0.12 * Double(order) : 0),
                value: isActive
            )
    }
}

extension View {
    func arrival(_ isActive: Bool, order: Int) -> some View {
        modifier(Arrival(isActive: isActive, order: order))
    }
}

extension View {
    /// On iOS 26, content dissolves softly as it scrolls under the floating
    /// header and tab bar instead of colliding with them.
    @ViewBuilder
    func softScrollEdges() -> some View {
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
        } else {
            self
        }
    }
}
