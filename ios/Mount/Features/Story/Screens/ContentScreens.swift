import AVKit
import SwiftUI

struct HookScreen: View {
    let day: JourneyDay
    let isActive: Bool

    var body: some View {
        StoryStage {
            Text("Day \(day.dayNumber)").zoeLabelStyle(Zoe.peach)
                .arrival(isActive, order: 0)
            Text(day.title)
                .font(.zoeDisplay(52))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
                .arrival(isActive, order: 1)
            Rectangle().fill(Zoe.peach.opacity(0.6)).frame(width: 32, height: 1)
                .arrival(isActive, order: 2)
            VStack(spacing: 16) {
                Text("Today's invitation").zoeLabelStyle()
                Text(day.hookText)
                    .font(.zoeSerif(.title3))
                    .foregroundStyle(Zoe.ink.opacity(0.92))
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
            }
            .arrival(isActive, order: 3)
        }
    }
}

struct ScriptureScreen: View {
    let day: JourneyDay
    let isActive: Bool
    @Environment(AppModel.self) private var model
    @State private var player: AVPlayer?

    var body: some View {
        StoryStage {
            Text(day.scriptureReference).zoeLabelStyle(Zoe.peach)
                .arrival(isActive, order: 0)
            // Set like a page of scripture: large italic serif, hung quotes,
            // generous leading — the one screen where the type is the image.
            Text("\u{201C}\(day.scriptureText)\u{201D}")
                .font(.zoeSerif(.title).italic())
                .multilineTextAlignment(.center)
                .lineSpacing(8)
                .arrival(isActive, order: 1)
            ReadInContextButton(reference: day.scriptureReference)
                .arrival(isActive, order: 2)
            // A recording made for the day wins; otherwise the app's voice
            // reads it.
            if let audio = day.scriptureAudioURL {
                Button {
                    if player == nil { player = AVPlayer(url: audio) }
                    player?.play()
                    model.audio.duck("scripture-recording")
                } label: {
                    Label("Listen", systemImage: "play.fill")
                        .zoeLabelStyle(Zoe.ink)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .zoeGlass(in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
                .arrival(isActive, order: 2)
            } else {
                ListenButton(text: "\(day.scriptureReference). \(day.scriptureText)", id: "day-\(day.dayNumber)-scripture")
                    .arrival(isActive, order: 2)
            }
        }
        .onChange(of: isActive) { _, active in
            guard !active else { return }
            player?.pause()
            model.audio.unduck("scripture-recording")
            if model.audio.speakingID == "day-\(day.dayNumber)-scripture" { model.audio.stopSpeaking() }
        }
    }
}

/// Opens the day's passage in the Bible tab, in its chapter — the Sermon read
/// as a whole, not a verse at a time.
private struct ReadInContextButton: View {
    let reference: String
    @Environment(AppModel.self) private var model

    var body: some View {
        Button {
            model.openScripture(reference)
        } label: {
            Label("Read in context", systemImage: "book.closed")
                .zoeLabelStyle(Zoe.ink)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .zoeGlass(in: Capsule())
        }
        .buttonStyle(.plain)
        .padding(.top, 8)
    }
}

struct TeachingScreen: View {
    let day: JourneyDay
    let isActive: Bool
    @Environment(AppModel.self) private var model
    @State private var player: AVPlayer?

    var body: some View {
        StoryStage {
            Text("The teaching").zoeLabelStyle()
            if let player {
                VideoPlayer(player: player)
                    .aspectRatio(9 / 16, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .arrival(isActive, order: 1)
            }
        }
        .onAppear {
            if player == nil, let url = day.teachingVideoURL { player = AVPlayer(url: url) }
        }
        // The music steps back for the teacher, and swiping away pauses, as
        // VideoScreen.tsx does on the web.
        .onChange(of: isActive, initial: true) { _, active in
            if active {
                model.audio.duck("teaching")
            } else {
                player?.pause()
                model.audio.unduck("teaching")
            }
        }
        .onDisappear { model.audio.unduck("teaching") }
    }
}

/// The teaching, whole: a card as long as its text, read by scrolling, the
/// way an article is.
struct ExegesisScreen: View {
    let day: JourneyDay
    let isActive: Bool
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                Text("Going deeper").zoeLabelStyle()
                Spacer()
                ListenButton(text: day.exegesisText, id: "day-\(day.dayNumber)-exegesis", compact: true)
            }
            .arrival(isActive, order: 0)
            ForEach(Array(day.exegesisParagraphs.enumerated()), id: \.offset) { position, paragraph in
                Text(paragraph)
                    .font(.system(size: 19 * model.settings.readingScale, design: .serif))
                    .foregroundStyle(Zoe.ink.opacity(0.92))
                    .lineSpacing(8)
                    .fixedSize(horizontal: false, vertical: true)
                    .arrival(isActive, order: min(position + 1, 4))
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The close of the day. "Carry this into my day" sends the participant out:
/// the words give way to a blessing, the button fills, and the story closes
/// on its own — leaving the Live Activity behind as the thread to the day.
struct SurrenderScreen: View {
    let day: JourneyDay
    let isActive: Bool

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var isSendingOut = false

    var body: some View {
        let isToday = day.dayNumber == model.journey.progress.currentDay
        let finished = model.journey.hasFinished(day.dayNumber)
        StoryStage {
            if isSendingOut {
                VStack(spacing: 18) {
                    Image(systemName: "mountain.2")
                        .font(.system(size: 34, weight: .light))
                        .foregroundStyle(Zoe.peach)
                        .symbolEffect(.bounce, options: .nonRepeating)
                    Text("Go in peace")
                        .font(.zoeSerif(.largeTitle))
                    Text(isToday ? "Day \(day.dayNumber) goes with you." : "Day \(day.dayNumber) is closed.")
                        .font(.zoeSerif(.body).italic())
                        .foregroundStyle(Zoe.inkMuted)
                }
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
            } else {
                Text("Surrender").zoeLabelStyle(Zoe.peach)
                    .arrival(isActive, order: 0)
                Group {
                    if let surrender = day.surrenderText {
                        Text(surrender)
                            .font(.zoeSerif(.title3))
                            .multilineTextAlignment(.center)
                            .lineSpacing(6)
                    } else {
                        VStack(spacing: 14) {
                            Text("Today's practice").zoeLabelStyle()
                            Text(day.practiceTitle)
                                .font(.zoeSerif(.title))
                                .multilineTextAlignment(.center)
                        }
                    }
                }
                .arrival(isActive, order: 1)

                Button(action: sendOut) {
                    Text(finished ? "Carried into today" : (isToday ? "Carry this into my day" : "Close the day"))
                        .font(.zoeSerif(.title3))
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(finished ? Zoe.locked : Zoe.peach, in: Capsule())
                        .foregroundStyle(finished ? Zoe.inkMuted : Zoe.deep)
                        .shadow(color: finished ? .clear : Zoe.peach.opacity(0.35), radius: 18, y: 6)
                }
                .buttonStyle(.plain)
                .disabled(finished)
                .padding(.top, 24)
                .arrival(isActive, order: 2)
            }
        }
        .animation(.easeInOut(duration: 0.7), value: isSendingOut)
        .sensoryFeedback(.success, trigger: isSendingOut)
    }

    private func sendOut() {
        isSendingOut = true
        Task {
            await model.journey.finishStory(of: day)
            try? await Task.sleep(for: .seconds(1.8))
            dismiss()
        }
    }
}
