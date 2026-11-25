import SwiftUI

/// Where the participant is, for Qara: the agent's dynamic variables, a line
/// for the screen, and how to describe it again if they move on mid-call.
struct VoiceContext: Equatable, Identifiable {
    var title: String
    var variables: [String: String]

    var id: String { title }

    /// A passage in the Bible: a chapter, or verses chosen in it.
    static func bible(book: String, chapter: Int, verses: [Int] = [], label: String? = nil, text: String? = nil) -> VoiceContext {
        let word: String
        switch verses.count {
        case 0: word = "this chapter"
        case 1: word = "verse \(verses[0])"
        default: word = "verses \(verses.first!) to \(verses.last!)"
        }
        var variables = [
            "bookName": book,
            "chapter": String(chapter),
            "activeWord": word,
            "scripture_ref": label ?? "\(book) \(chapter)",
            "user_intent": "Reading the Bible and wanting to talk it through — questions, doubts and all",
        ]
        if let text { variables["verse_text"] = text; variables["user_input"] = text }
        return VoiceContext(title: label ?? "\(book) \(chapter)", variables: variables)
    }

    /// A day of the journey, for the companion: its theme, its passage and
    /// its practice.
    static func day(_ day: JourneyDay) -> VoiceContext {
        // "Matthew 5:3" → Matthew, 5.
        let reference = day.scriptureReference
        let parts = reference.split(separator: " ")
        let book = parts.dropLast().joined(separator: " ")
        let chapter = parts.last?.split(separator: ":").first.map(String.init) ?? ""
        return VoiceContext(
            title: "Day \(day.dayNumber) · \(day.title)",
            variables: [
                "bookName": book.isEmpty ? "Matthew" : book,
                "chapter": chapter.isEmpty ? "5" : chapter,
                "activeWord": day.title,
                "scripture_ref": reference,
                "verse_text": day.scriptureText,
                "day_number": String(day.dayNumber),
                "day_title": day.title,
                "practice": day.practiceTitle,
                "user_intent": "Checking in on Day \(day.dayNumber) of 30 Days on the Mount and how the practice is going",
            ]
        )
    }
}

/// Talking with Qara out loud. A light at the centre breathes while Qara
/// listens and brightens as it speaks; the words of the conversation run
/// quietly beneath, and the call ends with one tap.
struct TalkWithQaraView: View {
    let context: VoiceContext

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var breathe = false

    var body: some View {
        let voice = model.voice
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Qara").font(.zoeDisplay(34))
                    Text(context.title).zoeLabelStyle()
                }
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)

            Spacer(minLength: 20)

            presence(voice.phase)
                .frame(width: 220, height: 220)
                .accessibilityElement()
                .accessibilityLabel(status(voice.phase))

            Text(status(voice.phase))
                .font(.zoeSerif(.body).italic())
                .foregroundStyle(Zoe.inkMuted)
                .padding(.top, 22)
                .contentTransition(.opacity)
                .animation(.easeInOut, value: voice.phase)

            Spacer(minLength: 20)

            transcript(voice.lines)
                .frame(maxHeight: 220)

            controls(voice)
                .padding(.top, 16)
                .padding(.bottom, 24)
        }
        .background(ZoeAtmosphere(glow: voice.phase == .speaking ? 1 : 0.6))
        .task {
            await voice.start(variables: context.variables)
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) { breathe = true }
        }
        .onDisappear {
            Task { await voice.end(); voice.reset() }
        }
        .onChange(of: context) { _, new in
            Task { await voice.update(context: "The listener has moved on to \(new.title).") }
        }
        .interactiveDismissDisabled(voice.phase.isLive)
    }

    private func presence(_ phase: QaraVoice.Phase) -> some View {
        let speaking = phase == .speaking
        let thinking = phase == .thinking
        return ZStack {
            Circle()
                .fill(RadialGradient(colors: [Zoe.peach.opacity(speaking ? 0.55 : 0.3), .clear],
                                     center: .center, startRadius: 0, endRadius: 110))
                .scaleEffect(speaking ? 1.1 : (breathe ? 1 : 0.82))
            Circle()
                .stroke(Zoe.peach.opacity(thinking ? 0.9 : 0.5), lineWidth: 1.5)
                .scaleEffect(speaking ? 0.78 : (breathe ? 0.7 : 0.6))
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 72)
                .foregroundStyle(Zoe.ink.opacity(0.85))
        }
        .animation(.easeInOut(duration: 0.6), value: phase)
    }

    private func status(_ phase: QaraVoice.Phase) -> String {
        switch phase {
        case .idle, .connecting: "Qara is coming…"
        case .listening: model.voice.isMuted ? "Your microphone is off" : "Listening"
        case .thinking: "Thinking…"
        case .speaking: "Qara is speaking"
        case .ended: "The conversation is saved with your companion."
        case .failed(let message): message
        }
    }

    private func transcript(_ lines: [QaraVoice.Line]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(lines) { line in
                    Text(line.text)
                        .font(line.fromQara ? .zoeSerif(.callout) : .callout)
                        .foregroundStyle(line.fromQara ? Zoe.ink.opacity(0.9) : Zoe.inkMuted)
                        .frame(maxWidth: .infinity, alignment: line.fromQara ? .leading : .trailing)
                        .multilineTextAlignment(line.fromQara ? .leading : .trailing)
                        .id(line.id)
                }
            }
            .padding(.horizontal, 28)
        }
        .defaultScrollAnchor(.bottom)
        .scrollIndicators(.hidden)
        .mask {
            LinearGradient(stops: [.init(color: .clear, location: 0), .init(color: .black, location: 0.25)],
                           startPoint: .top, endPoint: .bottom)
        }
    }

    private func controls(_ voice: QaraVoice) -> some View {
        HStack(spacing: 36) {
            if voice.phase.isLive {
                Button {
                    Task { await voice.toggleMute() }
                } label: {
                    Image(systemName: voice.isMuted ? "mic.slash.fill" : "mic.fill")
                        .font(.title3)
                        .foregroundStyle(voice.isMuted ? Zoe.peach : Zoe.ink)
                        .frame(width: 60, height: 60)
                        .zoeGlass(in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(voice.isMuted ? "Turn microphone on" : "Turn microphone off")
            }

            Button {
                Task {
                    await voice.end()
                    dismiss()
                }
            } label: {
                Text(voice.phase.isLive || voice.phase == .connecting ? "End" : "Close")
                    .font(.zoeSerif(.title3))
                    .frame(width: 120, height: 60)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
            }
            .buttonStyle(.plain)
        }
    }
}

/// The way into a conversation: a small "Talk" capsule, shown only when the
/// server can make the call.
struct TalkButton: View {
    let context: VoiceContext
    var label = "Talk"
    /// Just the waveform, in a circle, for a crowded header.
    var compact = false

    @Environment(AppModel.self) private var model
    @State private var isTalking = false

    var body: some View {
        if model.voiceChatAvailable {
            Button {
                isTalking = true
            } label: {
                if compact {
                    Image(systemName: "waveform")
                        .foregroundStyle(Zoe.ink)
                        .frame(width: 36, height: 36)
                        .zoeGlass(in: Circle())
                } else {
                    Label(label, systemImage: "waveform")
                        .zoeLabelStyle(Zoe.ink)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .zoeGlass(in: Capsule())
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Talk with Qara")
            .sheet(isPresented: $isTalking) {
                TalkWithQaraView(context: context)
                    .presentationDragIndicator(.visible)
            }
        }
    }
}
