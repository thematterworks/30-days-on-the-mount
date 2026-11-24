import SwiftUI

/// A day's guided story: the same six screens, in the same order, as
/// components/journey/GuidedStory.tsx — Hook, Scripture, Teaching, Exegesis,
/// Reflection, Surrender — paged horizontally under a segmented progress bar.
///
/// Entering *today's* story for the first time begins at the threshold: a few
/// breaths before the reading, which can be stepped past at any moment.
struct GuidedStoryView: View {
    let day: JourneyDay

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
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

    /// Only the first entry into today's story pauses at the threshold.
    /// Returning to a finished day, or an earlier one, goes straight in.
    private var showsThreshold: Bool {
        model.settings.thresholdBreaths
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
        TabView(selection: $index) {
            ForEach(Array(screens.enumerated()), id: \.element) { position, screen in
                content(for: screen, isActive: index == position)
                    .tag(position)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: index)
        .safeAreaInset(edge: .top) {
            HStack(spacing: 12) {
                StoryProgressBar(count: screens.count, index: index)
                SoundToggle()
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
            .padding(.top, 8)
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
        case .surrender: SurrenderScreen(day: day, isActive: isActive)
        }
    }
}

enum StoryScreen: Hashable, CaseIterable {
    case hook, scripture, teaching, exegesis, reflection, surrender

    /// Screens with nothing to show are left out rather than rendered empty —
    /// today that is the teaching video, which only some days have.
    static func screens(for day: JourneyDay) -> [StoryScreen] {
        allCases.filter { $0 != .teaching || day.teachingVideoURL != nil }
    }
}

struct StoryProgressBar: View {
    let count: Int
    let index: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { segment in
                Capsule()
                    .fill(Zoe.locked)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(Zoe.peach)
                            .frame(maxWidth: segment <= index ? .infinity : 0)
                    }
                    .frame(height: 3)
                    .clipShape(Capsule())
            }
        }
        .animation(.easeInOut(duration: 0.5), value: index)
        .accessibilityElement()
        .accessibilityLabel("Step \(index + 1) of \(count)")
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
