import SwiftUI

/// A day's guided story: the same six screens, in the same order, as
/// components/journey/GuidedStory.tsx — Hook, Scripture, Teaching, Exegesis,
/// Reflection, Surrender — swiped through vertically, a card at a time, like
/// the welcome tour (and YouVersion's guided scripture). A long card — the
/// teaching — scrolls through its full text, its mark on the edge filling as
/// it's read, and swipes on to the next card at its end (StorySnapping.swift).
///
/// Entering *today's* story for the first time begins at the threshold: a few
/// breaths before the reading, which can be stepped past at any moment.
struct GuidedStoryView: View {
    let day: JourneyDay
    /// Opened from the midday notification: straight to "Going deeper".
    var startsAtTeaching = false

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var scroll = ScrollPosition(idType: Int.self)
    @State private var heights: [Int: CGFloat] = [:]
    @State private var viewport: CGFloat = 0
    @State private var offset: CGFloat = 0
    @State private var dragStart: CGFloat = 0
    @State private var hasCrossed = false

    var body: some View {
        let screens = StoryScreen.screens(for: day)
        ZStack {
            if hasCrossed || !showsThreshold {
                story(screens)
                    .transition(.opacity)
            } else {
                ThresholdView(day: day) {
                    withAnimation(.easeInOut(duration: 0.8)) { hasCrossed = true }
                }
                .transition(.opacity)
            }
        }
        .background(ZoeAtmosphere(glow: glow(for: screens)))
        .animation(.easeInOut(duration: 0.6), value: index)
        .onDisappear { model.audio.stopSpeaking() }
    }

    private func layout(_ count: Int) -> StoryLayout {
        StoryLayout(heights: (0..<count).map { heights[$0] ?? viewport }, viewport: viewport)
    }

    /// The card filling most of the screen — judged from a little above the
    /// middle, so a card begins arriving as it snaps in, not after.
    private var index: Int { layout(StoryScreen.screens(for: day).count).card(at: offset + viewport * 0.4) }

    /// `-previewStoryCard N` opens at a card, for walkthroughs.
    private static var startingCard: Int {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-previewStoryCard"), arguments.indices.contains(index + 1) {
            return Int(arguments[index + 1]) ?? 0
        }
        #endif
        return 0
    }

    /// Only the first entry into today's story pauses at the threshold.
    /// Returning to a finished day, or an earlier one, goes straight in.
    private var showsThreshold: Bool {
        model.settings.thresholdBreaths
            && !startsAtTeaching
            && day.dayNumber == model.journey.progress.currentDay
            && !model.journey.hasFinished(day.dayNumber)
    }

    /// The first light gathers on the screens that ask for stillness.
    private func glow(for screens: [StoryScreen]) -> Double {
        guard hasCrossed || !showsThreshold else { return 1 }
        switch screens.indices.contains(index) ? screens[index] : .hook {
        case .hook, .surrender: return 0.9
        case .scripture: return 0.7
        default: return 0.35
        }
    }

    private func story(_ screens: [StoryScreen]) -> some View {
        // The buttons sit in their own row above the cards, not on the
        // scroll view: attached to it (as an overlay or a safe-area bar),
        // their taps went to the scroll view instead.
        VStack(spacing: 0) {
            topBar
            cards(screens)
        }
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            SoundToggle()
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Zoe.ink)
                    .frame(width: 34, height: 34)
                    .zoeGlass(in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    private func cards(_ screens: [StoryScreen]) -> some View {
        let layout = layout(screens.count)
        return ScrollView(.vertical) {
            VStack(spacing: 0) {
                ForEach(Array(screens.enumerated()), id: \.element) { position, screen in
                    content(for: screen, isActive: index == position)
                        // Clear of the home indicator.
                        .padding(.top, 16)
                        .padding(.bottom, 40)
                        .frame(maxWidth: .infinity)
                        // At least a screen tall; a long card is as tall as
                        // its text.
                        .frame(minHeight: viewport)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { heights[position] = $0 }
                        .id(position)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(StorySnapping(layout: layout, dragStart: dragStart))
        .onScrollPhaseChange { _, phase in
            if phase == .interacting { dragStart = offset }
        }
        .scrollPosition($scroll)
        .onScrollGeometryChange(for: CGFloat.self) { $0.containerSize.height } action: { _, height in viewport = height }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y + $0.contentInsets.top } action: { _, y in offset = y }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .ignoresSafeArea(edges: .bottom)
        // A long card's text fades away beneath the buttons rather than
        // running under them.
        .mask {
            VStack(spacing: 0) {
                LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: 56)
                Color.black
            }
            // Text fades as it scrolls up beneath the buttons.
            .padding(.top, 0)
        }
        .environment(\.briskArrivals, true)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.75), trigger: index)
        .task {
            var start = startsAtTeaching ? screens.firstIndex(of: .exegesis) ?? 0 : 0
            #if DEBUG
            if Self.startingCard > 0 { start = Self.startingCard }
            #endif
            guard start > 0 else { return }
            // Once the cards have been measured.
            try? await Task.sleep(for: .milliseconds(250))
            scroll.scrollTo(id: start, anchor: .top)
        }
        .overlay(alignment: .trailing) {
            SceneMarks(count: screens.count, index: index, progress: layout.progress(of: index, at: offset))
                .padding(.trailing, 14)
                .accessibilityElement()
                .accessibilityLabel("Card \(index + 1) of \(screens.count)")
        }
    }

    @ViewBuilder
    private func content(for screen: StoryScreen, isActive: Bool) -> some View {
        switch screen {
        case .hook: HookScreen(day: day, isActive: isActive)
        case .scripture: ScriptureScreen(day: day, isActive: isActive)
        case .teaching: TeachingScreen(day: day, isActive: isActive)
        case .exegesis: ExegesisScreen(day: day, isActive: isActive)
        case .reflection: ReflectionScreen(day: day, isActive: isActive)
        case .together: WalkingWithOthersScreen(day: day, isActive: isActive)
        case .surrender: SurrenderScreen(day: day, isActive: isActive)
        }
    }
}

enum StoryScreen: Hashable {
    case hook, scripture, teaching, exegesis, reflection, together, surrender

    /// Screens with nothing to show are left out rather than rendered empty —
    /// today that is the teaching video, which only some days have.
    static func screens(for day: JourneyDay) -> [StoryScreen] {
        [.hook, .scripture, .teaching, .exegesis, .reflection, .together, .surrender]
            .filter { $0 != .teaching || day.teachingVideoURL != nil }
    }
}

/// The shared stage every story screen sits on: centered, generous margins.
struct StoryStage<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 24) { content }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 32)
    }
}

/// "The Secret Room awaits" — the web's words for crossing into the day.
/// A gold ring breathes three times; enter whenever you are ready.
private struct ThresholdView: View {
    let day: JourneyDay
    let onEnter: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breath = 0
    @State private var expanded = false
    @State private var cue = "Breathe in"

    private let breaths = 3
    private let halfBreath: Duration = .seconds(4)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Zoe.ink)
                        .frame(width: 34, height: 34)
                        .zoeGlass(in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            Spacer()

            Text("Day \(day.dayNumber)").zoeLabelStyle(Zoe.peach)
                .padding(.bottom, 14)
            Text("The Secret Room awaits")
                .font(.zoeDisplay(40))
                .multilineTextAlignment(.center)

            ZStack {
                Circle().stroke(Zoe.peach.opacity(0.15), lineWidth: 1)
                Circle()
                    .stroke(Zoe.peach.opacity(0.7), lineWidth: 1.5)
                    .scaleEffect(expanded ? 1 : 0.45)
                    .blur(radius: expanded ? 0 : 1)
                Circle()
                    .fill(RadialGradient(colors: [Zoe.peach.opacity(0.25), .clear], center: .center, startRadius: 0, endRadius: 90))
                    .scaleEffect(expanded ? 1 : 0.45)
                Text(cue)
                    .font(.zoeSerif(.callout).italic())
                    .foregroundStyle(Zoe.inkMuted)
                    .contentTransition(.opacity)
            }
            .frame(width: 200, height: 200)
            .padding(.vertical, 48)
            .accessibilityHidden(true)

            Spacer()

            Button(action: onEnter) {
                Text(breath >= breaths ? "Enter" : "Enter now")
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(breath >= breaths ? Zoe.peach : Zoe.peach.opacity(0), in: Capsule())
                    .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.6)))
                    .foregroundStyle(breath >= breaths ? Zoe.deep : Zoe.peach)
                    .animation(.easeInOut(duration: 0.6), value: breath)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.4), trigger: expanded)
        .task { await breathe() }
    }

    private func breathe() async {
        guard !reduceMotion else {
            breath = breaths
            cue = "When you're ready"
            return
        }
        for count in 1...breaths {
            withAnimation(.easeInOut(duration: 4)) { cue = "Breathe in"; expanded = true }
            try? await Task.sleep(for: halfBreath)
            withAnimation(.easeInOut(duration: 4)) { cue = "Breathe out"; expanded = false }
            try? await Task.sleep(for: halfBreath)
            breath = count
        }
        withAnimation { cue = "When you're ready" }
    }
}
