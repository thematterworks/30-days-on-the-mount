import SwiftUI

/// A day's guided story: the same six screens, in the same order, as
/// components/journey/GuidedStory.tsx — Hook, Scripture, Teaching, Exegesis,
/// Reflection, Surrender — swiped through vertically, a card at a time, like
/// the welcome tour (and YouVersion's guided scripture), with the very same
/// paging. A long card — the teaching — scrolls through its full text within
/// itself, its mark on the edge filling as it's read; pulling on past its end
/// turns to the next card (StoryPage).
///
/// Entering *today's* story for the first time begins at the threshold: a few
/// breaths before the reading, which can be stepped past at any moment.
struct GuidedStoryView: View {
    let day: JourneyDay
    /// Opened from the midday notification: straight to "Going deeper".
    var startsAtTeaching = false

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var page: Int? = 0
    /// How far through the current card the reader is — kept apart so a
    /// scroll redraws only the marks, not every card.
    @State private var reading = StoryReading()
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

    /// The card on screen.
    private var index: Int { page ?? 0 }

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
        // The welcome's paging exactly: a card a screen, native paging, the
        // same fade between cards.
        ScrollView(.vertical) {
            LazyVStack(spacing: 0) {
                ForEach(Array(screens.enumerated()), id: \.element) { position, screen in
                    StoryPage(isActive: index == position, reading: reading) { direction in
                        turn(by: direction, count: screens.count)
                    } content: {
                        content(for: screen, isActive: index == position)
                            // Clear of the home indicator.
                            .padding(.top, 16)
                            .padding(.bottom, 40)
                            .readableWidth()
                    }
                    .containerRelativeFrame([.horizontal, .vertical])
                    .scrollTransition(.interactive, axis: .vertical) { view, phase in
                        view
                            .opacity(phase.isIdentity ? 1 : 0.15)
                            .blur(radius: phase.isIdentity ? 0 : 5)
                    }
                    .id(position)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $page)
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
        }
        .environment(\.briskArrivals, true)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.75), trigger: index)
        .task {
            var start = startsAtTeaching ? screens.firstIndex(of: .exegesis) ?? 0 : 0
            #if DEBUG
            if Self.startingCard > 0 { start = Self.startingCard }
            #endif
            guard start > 0 else { return }
            await Task.yield()
            page = start
        }
        .overlay(alignment: .trailing) {
            StoryMarks(count: screens.count, index: index, reading: reading)
                .padding(.trailing, 14)
                .accessibilityElement()
                .accessibilityLabel("Card \(index + 1) of \(screens.count)")
        }
    }

    /// Turns from a long card read to its end (or pulled back past its top).
    private func turn(by direction: Int, count: Int) {
        let next = min(max(index + direction, 0), count - 1)
        guard next != index else { return }
        withAnimation(.smooth(duration: 0.45)) { page = next }
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

/// How far the reader is through the card on screen, 0 to 1.
@MainActor
@Observable
final class StoryReading {
    var progress: Double = 1
}

/// The marks on the edge, reading the progress themselves so a scroll
/// redraws only them.
private struct StoryMarks: View {
    let count: Int
    let index: Int
    let reading: StoryReading

    var body: some View {
        SceneMarks(count: count, index: index, progress: reading.progress)
    }
}

/// One card, a screen tall. A card that fits sits still, and a swipe turns
/// it like a page of the welcome. A card longer than the screen scrolls
/// within itself; pulling past its end turns to the next card, and past its
/// top, back to the one before.
private struct StoryPage<Content: View>: View {
    let isActive: Bool
    let reading: StoryReading
    let onTurn: (Int) -> Void
    @ViewBuilder let content: Content

    @State private var position = Position()
    @State private var pullAtRelease: CGFloat = 0

    /// How far past an end the reader pulls before the card turns.
    private static var turnDistance: CGFloat { 64 }

    struct Position: Equatable {
        var offset: CGFloat = 0
        var maxOffset: CGFloat = 0
        /// Past the end (positive) or the top (negative).
        var pull: CGFloat { offset < 0 ? offset : max(offset - maxOffset, 0) }
        var progress: Double { maxOffset > 0 ? Double(min(max(offset / maxOffset, 0), 1)) : 1 }
    }

    var body: some View {
        ViewThatFits(in: .vertical) {
            content
                .frame(maxHeight: .infinity)
                .onChange(of: isActive, initial: true) { _, active in
                    if active { reading.progress = 1 }
                }
            ScrollView(.vertical) { content }
                .scrollIndicators(.hidden)
                .onScrollGeometryChange(for: Position.self) { geometry in
                    Position(
                        offset: geometry.contentOffset.y + geometry.contentInsets.top,
                        maxOffset: max(geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom - geometry.containerSize.height, 0)
                    )
                } action: { _, new in
                    position = new
                    pullAtRelease = abs(new.pull) > abs(pullAtRelease) ? new.pull : pullAtRelease
                    if isActive { reading.progress = new.progress }
                }
                .onScrollPhaseChange { old, new in
                    if new == .interacting { pullAtRelease = 0 }
                    if old == .interacting, new != .interacting {
                        if pullAtRelease > Self.turnDistance { onTurn(1) } else if pullAtRelease < -Self.turnDistance { onTurn(-1) }
                    }
                }
                .onChange(of: isActive, initial: true) { _, active in
                    if active { reading.progress = position.progress }
                }
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

/// The threshold before today's story: the day's own invitation to slow
/// down and be present with God (curriculum_days.threshold_title and
/// threshold_line, edited in the admin), and a ring that breathes three
/// times. Enter whenever you are ready.
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
            Text(day.thresholdTitle ?? "Pause here")
                .font(.zoeDisplay(40))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 32)
            Text(day.thresholdLine ?? "Take three slow breaths. God is here with you.")
                .font(.zoeSerif(.body).italic())
                .foregroundStyle(Zoe.ink.opacity(0.82))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 40)
                .padding(.top, 14)

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
            .padding(.vertical, 40)
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
            .readableWidth(460)
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
