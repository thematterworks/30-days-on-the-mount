import SwiftUI

/// Write a reflection; the Curious Inspector answers with one question that
/// replaces the input — "one thing at a time", as ReflectionScreen.tsx does on
/// the web. From there the participant can carry it into the companion
/// conversation, which is where the AI lives in the app.
struct ReflectionScreen: View {
    let day: JourneyDay
    let isActive: Bool

    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var question: String?
    @State private var isAsking = false
    @State private var errorMessage: String?
    @FocusState private var isWriting: Bool

    var body: some View {
        StoryStage {
            if let question {
                Text("A question for you").zoeLabelStyle(Zoe.peach)
                Text(question)
                    .font(.zoeSerif(.title2))
                    .multilineTextAlignment(.center)
                    .lineSpacing(5)
                    .transition(.opacity)

                Button {
                    model.companion.carryOver(reflection: text, question: question, dayNumber: day.dayNumber)
                    model.open(.companion)
                } label: {
                    Text("Keep talking").zoeLabelStyle(Zoe.ink)
                        .padding(.horizontal, 22)
                        .padding(.vertical, 12)
                        .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.6)))
                }
                .padding(.top, 12)
            } else {
                Text("Reflect").zoeLabelStyle(Zoe.peach)
                    .arrival(isActive, order: 0)
                Text("What came up when you tried this today?")
                    .font(.zoeSerif(.title2))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .arrival(isActive, order: 1)

                journal
                    .arrival(isActive, order: 2)

                if let problem = model.dictation.problem {
                    Text(problem).font(.footnote).foregroundStyle(Zoe.inkMuted).multilineTextAlignment(.center)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(Zoe.peach).multilineTextAlignment(.center)
                }

                Button(action: ask) {
                    Group {
                        if isAsking { ProgressView().tint(Zoe.deep) } else { Text("Reflect") }
                    }
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 52)
                    // Outlined until there's something to send, rather than
                    // a filled button faded to grey.
                    .background(trimmed.isEmpty ? .clear : Zoe.peach, in: Capsule())
                    .overlay(Capsule().strokeBorder(Zoe.peach.opacity(trimmed.isEmpty ? 0.35 : 0)))
                    .foregroundStyle(trimmed.isEmpty ? Zoe.peach.opacity(0.55) : Zoe.deep)
                    .animation(.easeInOut(duration: 0.3), value: trimmed.isEmpty)
                }
                .buttonStyle(.plain)
                .disabled(isAsking || trimmed.isEmpty)
                .arrival(isActive, order: 3)

                Text("Only you and your companion see this.")
                    .font(.caption)
                    .foregroundStyle(Zoe.inkMuted)
                    .arrival(isActive, order: 3)
            }
        }
        .animation(.easeInOut(duration: 0.6), value: question)
        .sensoryFeedback(.impact(weight: .light), trigger: question)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { isWriting = false }
            }
        }
    }

    /// A page to write on: a soft card with an invitation in place of an
    /// empty box, and speaking offered as plainly as typing.
    private var journal: some View {
        let isListening = model.dictation.activeField == fieldID
        return VStack(alignment: .leading, spacing: 0) {
            TextEditor(text: $text)
                .focused($isWriting)
                .scrollContentBackground(.hidden)
                .font(.zoeSerif(.body))
                .lineSpacing(5)
                .frame(minHeight: 110, maxHeight: 200)
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(isListening ? "Listening…" : "Write freely. There's no wrong answer.")
                            .font(.zoeSerif(.body).italic())
                            .foregroundStyle(Zoe.inkMuted.opacity(0.8))
                            .padding(.top, 8)
                            .padding(.leading, 5)
                            .allowsHitTesting(false)
                    }
                }
            HStack {
                Spacer()
                MicButton(field: fieldID, text: $text, size: 30)
                Text(isListening ? "Tap to stop" : "Speak")
                    .font(.footnote)
                    .foregroundStyle(isListening ? Zoe.peach : Zoe.inkMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Zoe.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
            .strokeBorder(isListening || isWriting ? Zoe.peach.opacity(0.55) : Zoe.ink.opacity(0.12)))
        .animation(.easeInOut, value: isListening)
        .animation(.easeInOut, value: isWriting)
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var fieldID: String { "reflection-\(day.dayNumber)" }

    private func ask() {
        isWriting = false
        model.dictation.stop()
        isAsking = true
        errorMessage = nil
        Task {
            defer { isAsking = false }
            do {
                let answer = try await model.companion.inspect(reflection: trimmed, dayNumber: day.dayNumber)
                question = answer
                model.journey.saveReflection(trimmed, question: answer, for: day.dayNumber)
            } catch {
                errorMessage = "Your companion couldn't be reached. Your words are still here — try again."
            }
        }
    }
}
