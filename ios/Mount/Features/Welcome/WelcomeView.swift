import AVKit
import SwiftUI

/// The first thing someone sees after signing in. For some people this is
/// their first time opening scripture at all, so it assumes nothing and
/// hurries nothing: what this is, where it comes from, how the days work,
/// how to take part, and what they may find. It ends with an invitation to
/// begin, then the welcome film, then Day 1.
///
/// Twelve scenes, swiped through vertically like the journey itself. Each is
/// composed natively from the brand's own language — the mountain line, the
/// peach light, serif words on the gradient — and moves quietly.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @State private var scene: Int? = WelcomeView.startingScene
    @State private var isShowingFilm = false

    /// `-previewWelcomeScene N` opens at a scene, for walkthroughs.
    private static var startingScene: Int {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-previewWelcomeScene"), arguments.indices.contains(index + 1) {
            return Int(arguments[index + 1]) ?? 0
        }
        #endif
        return 0
    }

    var body: some View {
        ScrollView(.vertical) {
            LazyVStack(spacing: 0) {
                ForEach(WelcomeScene.allCases, id: \.self) { item in
                    WelcomeSceneView(scene: item, isActive: scene == item.rawValue) {
                        isShowingFilm = true
                    }
                    .containerRelativeFrame([.horizontal, .vertical])
                    .scrollTransition(.interactive, axis: .vertical) { view, phase in
                        view
                            .opacity(phase.isIdentity ? 1 : 0.15)
                            .blur(radius: phase.isIdentity ? 0 : 5)
                    }
                    .id(item.rawValue)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $scene)
        .scrollIndicators(.hidden)
        .ignoresSafeArea()
        .sensoryFeedback(.selection, trigger: scene)
        .overlay(alignment: .top) { topBar }
        .overlay(alignment: .trailing) {
            SceneMarks(count: WelcomeScene.allCases.count, index: scene ?? 0).padding(.trailing, 14)
        }
        .zoeAtmosphere(glow: 0.7)
        .onChange(of: scene) { model.audio.stopSpeaking() }
        .fullScreenCover(isPresented: $isShowingFilm) {
            WelcomeFilm { model.finishWelcome() }
        }
    }

    private var topBar: some View {
        HStack {
            SoundToggle()
            Spacer()
            // Someone already partway through (who began by text, say) may
            // step past it.
            if model.journey.progress.currentDay > 1 {
                Button("Skip") { model.finishWelcome() }
                    .font(.footnote)
                    .foregroundStyle(Zoe.inkMuted)
            }
        }
        .padding(.horizontal, 20)
    }
}

// MARK: - The scenes

enum WelcomeScene: Int, CaseIterable {
    case breathe, hillside, firstWord, voices, path, rhythm, liveIt, companion, grace, notReady, life, begin

    var eyebrow: String {
        switch self {
        case .breathe: "Welcome"
        case .hillside: "Where this begins"
        case .firstWord: "Matthew 5:3"
        case .voices: "Why these words"
        case .path: "How it works"
        case .rhythm: "Each day"
        case .liveIt: "Taking part"
        case .companion: "Your companion"
        case .grace: "Grace over streaks"
        case .notReady: "If this is all new"
        case .life: "What you may find"
        case .begin: "Day 1"
        }
    }

    var title: String {
        switch self {
        case .breathe: "Before anything else, take a breath."
        case .hillside: "A hillside in Galilee"
        case .firstWord: "Blessed are the poor in spirit, for theirs is the kingdom of heaven."
        case .voices: "Words that wouldn't stay on the hill"
        case .path: "Thirty days, one step at a time"
        case .rhythm: "Every day moves like a breath"
        case .liveIt: "Then go and live it"
        case .companion: "Someone to walk with"
        case .grace: "The mountain is still here"
        case .notReady: "You don't have to be ready"
        case .life: "Life, to the full"
        case .begin: "Your journey on the mount begins"
        }
    }

    var body: String {
        switch self {
        case .breathe:
            "You've arrived somewhere quiet. There's no rush here."
        case .hillside:
            "Two thousand years ago, Jesus climbed a hill above the Sea of Galilee, sat down, and began to teach. The crowd was ordinary — fishermen, farmers, the sick, the curious. What he said that day became known as the Sermon on the Mount. You'll find it in Matthew, chapters 5 to 7."
        case .firstWord:
            "The very first word he spoke was \u{201C}blessed\u{201D} — said over people who didn't feel blessed at all."
        case .voices:
            "For two thousand years these three chapters have unsettled and rebuilt people, inside the church and far beyond it."
        case .path:
            "Each morning one new day opens: a small piece of the Sermon, about fifteen minutes long. There's nothing to catch up on and nothing to master. You only ever take the next step."
        case .rhythm:
            "Six short movements, always in the same order, so the shape becomes familiar and the words can do their work."
        case .liveIt:
            "Each day ends with one simple practice to carry with you. It waits quietly on your Lock Screen, and in the evening you'll be asked how it went. This is where the change happens — not in what you read, but in what you try."
        case .companion:
            "Throughout the journey you'll have a companion to talk with. Bring it whatever the day stirs up: questions, doubts, the parts that don't make sense yet. It won't lecture you. It listens, asks good questions, and helps you notice what God might be doing."
        case .grace:
            "There are no streaks to keep and nothing to fail. If you miss a day, it simply waits for you. Come back whenever you're ready and pick up where you left off."
        case .notReady:
            "Maybe you've never opened a Bible. Maybe you've opened it so often you no longer feel anything. Either way, you're welcome here. You don't need the background or the right beliefs first. Bring your questions — they're part of the way."
        case .life:
            "Jesus spoke of a life that is full. The first Christians called it zoe — the very life of God. Less hurry, more presence. Less keeping score, more grace. Thirty days won't make you someone else, but they may show you another way to live."
        case .begin:
            "Take one more breath. When you're ready, step onto the mountain."
        }
    }

    /// What the voice reads for this scene.
    var spoken: String {
        let lead = self == .firstWord ? "\(title) Matthew, chapter five, verse three." : title
        return "\(lead) \(body)"
    }
}

private struct WelcomeSceneView: View {
    let scene: WelcomeScene
    let isActive: Bool
    let begin: () -> Void

    var body: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 80)
            visual
                .arrival(isActive, order: 0)
            words
            Spacer(minLength: 40)
            footer
                .arrival(isActive, order: 5)
        }
        .padding(.horizontal, 32)
        .padding(.bottom, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var visual: some View {
        switch scene {
        case .breathe: BreathingRings(isActive: isActive).frame(width: 220, height: 220)
        case .hillside: DrawnMountain(isActive: isActive, width: 230)
        case .voices: VoicesCarousel(isActive: isActive)
        case .path: PathOfDays(isActive: isActive).frame(height: 140)
        case .liveIt: LockScreenGlimpse()
        case .companion: JournalGlimpse()
        case .grace: DrawnMountain(isActive: isActive, width: 170)
        case .life:
            Text("ζωή")
                .font(.zoeDisplay(84))
                .foregroundStyle(Zoe.peach.opacity(0.9))
                .accessibilityLabel("Zoe, the Greek word for life")
        case .begin: DawnOverMountain(isActive: isActive)
        case .firstWord, .rhythm, .notReady: EmptyView()
        }
    }

    @ViewBuilder
    private var words: some View {
        Text(scene.eyebrow).zoeLabelStyle(Zoe.peach)
            .arrival(isActive, order: 1)
        if scene == .firstWord {
            // On this scene the verse is the image.
            Text("\u{201C}\(scene.title)\u{201D}")
                .font(.zoeDisplay(40, relativeTo: .title))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .minimumScaleFactor(0.7)
                .arrival(isActive, order: 2)
        } else {
            Text(scene.title)
                .font(.zoeDisplay(scene == .breathe ? 34 : 38))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.7)
                .arrival(isActive, order: 2)
        }
        Text(scene.body)
            .font(scene == .firstWord ? .zoeSerif(.callout).italic() : .zoeSerif(.body))
            .foregroundStyle(Zoe.ink.opacity(scene == .firstWord ? 0.75 : 0.9))
            .multilineTextAlignment(.center)
            .lineSpacing(6)
            .minimumScaleFactor(0.85)
            .arrival(isActive, order: 3)
        if scene == .rhythm {
            Movements().arrival(isActive, order: 4)
        }
    }

    @ViewBuilder
    private var footer: some View {
        switch scene {
        case .breathe:
            Label("Swipe up", systemImage: "chevron.up").zoeLabelStyle()
        case .begin:
            Button(action: begin) {
                Text("Begin")
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.navy)
            }
            .buttonStyle(.plain)
        default:
            ListenButton(text: scene.spoken, id: "welcome-\(scene.rawValue)")
        }
    }
}

// MARK: - Compositions

/// Three rings breathing in and out: the app's first gesture is a breath.
private struct BreathingRings: View {
    let isActive: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !isActive || reduceMotion)) { context in
            // Four seconds in, four out — the threshold's rhythm.
            let t = context.date.timeIntervalSinceReferenceDate
            let breath = reduceMotion ? 0.5 : 0.5 - 0.5 * cos(t * .pi / 4)
            ZStack {
                Circle()
                    .fill(RadialGradient(colors: [Zoe.peach.opacity(0.3), .clear], center: .center, startRadius: 0, endRadius: 110))
                    .scaleEffect(0.6 + 0.4 * breath)
                ForEach(0..<3, id: \.self) { ring in
                    Circle()
                        .stroke(Zoe.ink.opacity(0.55 - Double(ring) * 0.15), lineWidth: 1)
                        .scaleEffect(0.42 + Double(ring) * 0.2 + 0.12 * breath)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

/// The mountain mark drawing itself, left to right, as the scene arrives.
private struct DrawnMountain: View {
    let isActive: Bool
    let width: CGFloat
    @State private var reveal = 0.0

    var body: some View {
        Image("MountainLine")
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .frame(width: width)
            .foregroundStyle(Zoe.ink.opacity(0.9))
            .mask(alignment: .leading) { Rectangle().frame(width: width * reveal) }
            .onChange(of: isActive, initial: true) { _, active in
                guard active else { return }
                reveal = 0
                withAnimation(.easeInOut(duration: 2.6).delay(0.3)) { reveal = 1 }
            }
            .accessibilityHidden(true)
    }
}

/// The last scene: light rising behind the mountain.
private struct DawnOverMountain: View {
    let isActive: Bool
    @State private var risen = false

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Zoe.peach.opacity(0.55), Zoe.peach.opacity(0)], center: .center, startRadius: 0, endRadius: 120))
                .frame(width: 240, height: 240)
                .offset(y: risen ? -30 : 50)
                .opacity(risen ? 1 : 0)
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 220)
                .foregroundStyle(Zoe.ink)
        }
        .frame(height: 190)
        .onChange(of: isActive, initial: true) { _, active in
            guard active else { return }
            risen = false
            withAnimation(.easeOut(duration: 3).delay(0.4)) { risen = true }
        }
        .accessibilityHidden(true)
    }
}

/// Thirty marks climbing a slope, lighting one after another: the journey
/// as a path, each day one step.
private struct PathOfDays: View {
    let isActive: Bool
    @State private var lit = 0

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack {
                ForEach(0..<30, id: \.self) { day in
                    let point = Self.point(day, in: size)
                    Circle()
                        .fill(day < lit ? Zoe.peach : Zoe.ink.opacity(0.22))
                        .frame(width: day == 29 ? 9 : 5, height: day == 29 ? 9 : 5)
                        .position(point)
                }
            }
        }
        .task(id: isActive) {
            guard isActive else { return }
            lit = 0
            for day in 1...30 {
                try? await Task.sleep(for: .milliseconds(90))
                withAnimation(.easeOut(duration: 0.3)) { lit = day }
            }
        }
        .accessibilityHidden(true)
    }

    /// A gentle climb with a shoulder before the summit.
    static func point(_ day: Int, in size: CGSize) -> CGPoint {
        let x = Double(day) / 29
        let height = min(1, 0.78 * x + 0.1 * sin(x * .pi * 3))
        return CGPoint(x: 8 + x * (size.width - 16), y: 8 + (1 - height) * (size.height - 16))
    }
}

/// A few of the people the Sermon shaped, in their own words, turning
/// slowly. Quoted as the Library quotes them.
private struct VoicesCarousel: View {
    let isActive: Bool
    @State private var index = 0

    private let voices: [(quote: String, name: String)] = [
        ("When I read the Sermon on the Mount, all that had been dark became clear to me; all that had seemed impossible became possible, and all that had seemed complex became simple.", "Leo Tolstoy"),
        ("If we could erase all the rest of the Bible and leave only the Sermon on the Mount, we would still have all we need to know about how to live.", "Mahatma Gandhi"),
        ("It was the Sermon on the Mount, rather than a doctrine of passive resistance, that initially inspired the Negroes of Montgomery to dignified social action.", "Dr. Martin Luther King Jr."),
    ]

    var body: some View {
        VStack(spacing: 12) {
            Text(voices[index].quote)
                .font(.zoeSerif(.callout).italic())
                .foregroundStyle(Zoe.ink.opacity(0.85))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
            Text("— \(voices[index].name)").zoeLabelStyle()
        }
        .id(index)
        .transition(.opacity)
        .frame(minHeight: 150)
        .task(id: isActive) {
            guard isActive else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(7))
                if Task.isCancelled { return }
                withAnimation(.easeInOut(duration: 1)) { index = (index + 1) % voices.count }
            }
        }
    }
}

/// The six movements of a day, as one quiet list.
private struct Movements: View {
    private let movements = [
        ("Arrive", "a word to open the day"),
        ("Hear", "the passage, read slowly"),
        ("Understand", "a short teaching"),
        ("Go deeper", "the world behind the words"),
        ("Respond", "write or speak your answer"),
        ("Release", "a practice to carry with you"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            ForEach(Array(movements.enumerated()), id: \.offset) { index, movement in
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text("\(index + 1)").font(.zoeDisplay(19)).foregroundStyle(Zoe.peach).frame(width: 16)
                    Text("\(Text(movement.0).fontWeight(.semibold).foregroundStyle(Zoe.ink)) — \(movement.1)")
                        .font(.zoeSerif(.callout))
                        .foregroundStyle(Zoe.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

/// How the practice travels with you: the day as it sits on the Lock
/// Screen, and the evening question.
private struct LockScreenGlimpse: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let day = model.journey.day(1)
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                Image("MountainLine").resizable().renderingMode(.template).scaledToFit()
                    .frame(width: 30).foregroundStyle(Zoe.peach)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Day 1 · \(day?.title ?? "Poor in Spirit")").zoeLabelStyle(Zoe.peach)
                    Text(day?.practiceTitle ?? "Today's practice")
                        .font(.zoeSerif(.subheadline))
                        .foregroundStyle(Zoe.ink)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            HStack {
                Image(systemName: "moon.stars").foregroundStyle(Zoe.peach)
                Text("How did today's practice meet you?")
                    .font(.zoeSerif(.footnote).italic())
                    .foregroundStyle(Zoe.ink.opacity(0.85))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .frame(maxWidth: 320)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Your day's practice on the Lock Screen, and an evening question")
    }
}

/// What the companion conversation feels like: a journal, not a chat.
private struct JournalGlimpse: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("I don't think I'm very spiritual. Does this still work for me?")
                .font(.callout)
                .foregroundStyle(Zoe.inkMuted)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, 40)
            Text("The first people Jesus called blessed were the ones who felt they had nothing to bring. What makes you feel you're not spiritual enough?")
                .font(.zoeSerif(.callout))
                .foregroundStyle(Zoe.ink)
                .lineSpacing(4)
        }
        .padding(18)
        .background(Zoe.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .frame(maxWidth: 340)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("An example conversation with the companion")
    }
}

/// Where you are in the welcome, as a column of small marks.
private struct SceneMarks: View {
    let count: Int
    let index: Int

    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { mark in
                Capsule()
                    .fill(mark == index ? Zoe.peach : Zoe.ink.opacity(0.25))
                    .frame(width: 3, height: mark == index ? 18 : 6)
            }
        }
        .animation(.smooth, value: index)
        .accessibilityHidden(true)
    }
}

// MARK: - The film

/// The short film that opens the journey, then gives way to Day 1.
///
/// Plays `WelcomeFilm.mp4` from the app bundle. Until the ministry's film is
/// added, a quiet title sequence stands in: the mountain draws itself and
/// Day 1 appears.
private struct WelcomeFilm: View {
    let onFinish: () -> Void

    @Environment(AppModel.self) private var model
    @State private var player: AVPlayer?
    @State private var reveal = 0.0
    @State private var showsTitle = false

    private static let filmURL = Bundle.main.url(forResource: "WelcomeFilm", withExtension: "mp4")

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
            } else {
                standIn
            }
        }
        .overlay(alignment: .topTrailing) {
            Button("Skip", action: finish)
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.7))
                .padding(20)
        }
        .task {
            model.audio.duck("film")
            if let url = Self.filmURL {
                let player = AVPlayer(url: url)
                self.player = player
                player.play()
                for await _ in NotificationCenter.default.notifications(named: AVPlayerItem.didPlayToEndTimeNotification, object: player.currentItem) {
                    finish()
                    return
                }
            } else {
                await playStandIn()
            }
        }
        .onDisappear { model.audio.unduck("film") }
    }

    private var standIn: some View {
        VStack(spacing: 28) {
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 220)
                .foregroundStyle(.white.opacity(0.9))
                .mask(alignment: .leading) {
                    Rectangle().frame(width: 220 * reveal)
                }
            VStack(spacing: 8) {
                Text("Day 1").font(.zoeDisplay(30)).foregroundStyle(Zoe.peach)
                Text("The journey begins").font(.zoeSerif(.title3).italic()).foregroundStyle(.white.opacity(0.85))
            }
            .opacity(showsTitle ? 1 : 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background { ZoeAtmosphere(glow: 0.4).ignoresSafeArea() }
    }

    private func playStandIn() async {
        withAnimation(.easeInOut(duration: 3.5)) { reveal = 1 }
        try? await Task.sleep(for: .seconds(3))
        withAnimation(.easeIn(duration: 1.4)) { showsTitle = true }
        try? await Task.sleep(for: .seconds(3.4))
        finish()
    }

    private func finish() {
        player?.pause()
        onFinish()
    }
}
