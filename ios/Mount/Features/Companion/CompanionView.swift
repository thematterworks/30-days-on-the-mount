import SwiftUI

/// The companion: one continuous conversation, reachable from the journey,
/// from a reflection ("keep talking"), and by replying to a notification.
///
/// Styled as a journal rather than a messenger — no bubbles, no avatars. The
/// companion writes in the serif voice the curriculum uses; the participant's
/// words sit quieter, to the right. That keeps the AI feeling like part of
/// the sanctuary instead of a chat app bolted onto it.
struct CompanionView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = ""
    @FocusState private var isComposing: Bool

    var body: some View {
        let companion = model.companion
        let today = model.journey.today
        VStack(spacing: 0) {
            header(today: today)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    if companion.messages.isEmpty {
                        Text("Whatever today's practice stirs up, you can bring it here.")
                            .font(.zoeSerif(.title3))
                            .foregroundStyle(Zoe.inkMuted)
                            .padding(.top, 40)
                    }
                    ForEach(companion.messages) { message in
                        CompanionEntry(message: message)
                            .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 10)), removal: .opacity))
                    }
                    if companion.isSending {
                        ListeningDots().padding(.leading, 2)
                    }
                    if let error = companion.lastError {
                        Text(error).font(.footnote).foregroundStyle(Zoe.peach)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            }
            .defaultScrollAnchor(.bottom)
            .softScrollEdges()
            .animation(.easeOut(duration: 0.45), value: companion.messages.count)
            .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: companion.messages.count)
            .scrollDismissesKeyboard(.interactively)

            composer(dayNumber: today?.dayNumber ?? model.journey.progress.currentDay)
        }
        .task { await companion.refresh() }
    }

    private func header(today: JourneyDay?) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text("Companion").font(.zoeDisplay(40))
                if let today {
                    Text("Day \(today.dayNumber) · \(today.title)").zoeLabelStyle()
                }
            }
            Spacer()
            AvatarButton()
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
        .padding(.bottom, 8)
    }

    private func composer(dayNumber: Int) -> some View {
        HStack(alignment: .bottom, spacing: 12) {
            TextField("Write to your companion", text: $draft, axis: .vertical)
                .focused($isComposing)
                .lineLimit(1...6)
                .font(.body)
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .background(Zoe.ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            Button {
                let text = draft
                draft = ""
                Task { await model.companion.send(text, dayNumber: dayNumber) }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Zoe.locked : Zoe.peach)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.companion.isSending)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

private struct CompanionEntry: View {
    let message: CompanionMessage

    var body: some View {
        switch message.author {
        case .companion:
            Text(message.text)
                .font(.zoeSerif(.body))
                .foregroundStyle(Zoe.ink)
                .lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .participant:
            Text(message.text)
                .font(.body)
                .foregroundStyle(Zoe.inkMuted)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.leading, 48)
        }
    }
}

/// The companion is "listening" while a reply is on its way: three gold dots
/// breathing in sequence, quieter than a spinner.
private struct ListeningDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 7) {
                ForEach(0..<3, id: \.self) { dot in
                    Circle()
                        .fill(Zoe.peach)
                        .frame(width: 6, height: 6)
                        .opacity(reduceMotion ? 0.6 : 0.3 + 0.7 * (0.5 + 0.5 * sin(t * 3 - Double(dot) * 0.7)))
                }
            }
        }
        .accessibilityLabel("Your companion is replying")
    }
}
