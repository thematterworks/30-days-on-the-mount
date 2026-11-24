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
                    .font(.zoeSerif(.title3))
                    .multilineTextAlignment(.center)
                    .arrival(isActive, order: 1)

                TextEditor(text: $text)
                    .focused($isWriting)
                    .scrollContentBackground(.hidden)
                    .font(.zoeSerif(.body))
                    .frame(minHeight: 140, maxHeight: 220)
                    .padding(12)
                    .background(Zoe.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(model.dictation.activeField == fieldID ? Zoe.peach.opacity(0.7) : Zoe.locked))
                    .overlay(alignment: .bottomTrailing) {
                        MicButton(field: fieldID, text: $text).padding(10)
                    }
                    .animation(.easeInOut, value: model.dictation.activeField)

                if let problem = model.dictation.problem {
                    Text(problem).font(.footnote).foregroundStyle(Zoe.inkMuted).multilineTextAlignment(.center)
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(Zoe.peach)
                }

                Button(action: ask) {
                    Group {
                        if isAsking { ProgressView().tint(Zoe.deep) } else { Text("Reflect") }
                    }
                    .font(.zoeSerif(.title3))
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
                }
                .disabled(isAsking || trimmed.isEmpty)
                .opacity(trimmed.isEmpty ? 0.5 : 1)
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
