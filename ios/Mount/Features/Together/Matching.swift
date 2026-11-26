import SwiftUI

/// The guidelines everyone in a matched group agrees to.
struct WalkingGuidelines: View {
    private static let items: [(symbol: String, text: String)] = [
        ("heart", "Be kind. Encourage each other; don't correct, debate or preach."),
        ("lock", "Keep it here. Phone numbers, emails, handles and links aren't shared, and there are no private messages."),
        ("hand.raised", "What others share stays in the group. Don't repeat their stories."),
        ("flag", "If something feels wrong, report it. You can leave at any time."),
        ("phone", "This is companionship, not crisis care. If you're struggling, call or text 988."),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Self.items, id: \.text) { item in
                Label {
                    Text(item.text).font(.subheadline).fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: item.symbol).foregroundStyle(Zoe.peach)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Opting in to be matched with strangers walking nearby days: what it is,
/// the guidelines, 18+, and a first name.
struct MatchSheet: View {
    let termsAccepted: Bool
    let onUpdate: (MatchStatus, [WalkingGroup], String?) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var isAdult = false
    @State private var agrees = false
    @State private var name = ""
    @State private var isWorking = false
    @State private var problem: String?
    @State private var isWaiting = false

    private var needsName: Bool { (model.firstName ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
    private var canSubmit: Bool {
        (termsAccepted || (isAdult && agrees)) && (!needsName || !name.trimmingCharacters(in: .whitespaces).isEmpty) && !isWorking
    }

    var body: some View {
        NavigationStack {
            Form {
                if isWaiting {
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            Image(systemName: "person.3").font(.title2).foregroundStyle(Zoe.peach)
                            Text("We're finding your companions").font(.zoeSerif(.title3))
                            Text("As soon as a few people on nearby days are ready, we'll bring you together and send you a notification. Keep walking in the meantime.")
                                .font(.subheadline)
                                .foregroundStyle(Zoe.ink.opacity(0.85))
                        }
                        .padding(.vertical, 6)
                    }
                } else {
                    Section {
                        Text("We'll place you in a small group, up to six people, who are within a few days of you on the journey, so you're on the same page together. You'll see first names only, and everything shared is screened with care.")
                            .font(.subheadline)
                            .foregroundStyle(Zoe.ink.opacity(0.9))
                    }
                    if !termsAccepted {
                        Section("How we walk together") {
                            WalkingGuidelines()
                            Toggle("I'm 18 or older", isOn: $isAdult)
                            Toggle("I'll follow these guidelines", isOn: $agrees)
                        }
                    }
                    if needsName {
                        Section {
                            TextField("Your first name", text: $name)
                                .textContentType(.givenName)
                        } header: {
                            Text("Your first name")
                        } footer: {
                            Text("Matched groups show first names only.")
                        }
                    }
                    if let problem {
                        Text(problem).foregroundStyle(Zoe.peach)
                    }
                }
            }
            .tint(Zoe.peach)
            .scrollContentBackground(.hidden)
            .navigationTitle("Walking companions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if isWaiting {
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
                } else {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Find") { submit() }.disabled(!canSubmit)
                    }
                }
            }
        }
        .keyboardDismissible()
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }

    private func submit() {
        isWorking = true
        problem = nil
        let chosen = name.trimmingCharacters(in: .whitespaces)
        Task {
            defer { isWorking = false }
            do {
                let (status, groups, groupID) = try await model.together.requestMatch(
                    adult: termsAccepted || isAdult,
                    agreed: termsAccepted || agrees,
                    firstName: needsName ? chosen : nil
                )
                if needsName, !chosen.isEmpty { model.updateFirstName(chosen) }
                onUpdate(status, groups, groupID)
                if groupID != nil {
                    dismiss()
                } else {
                    withAnimation { isWaiting = true }
                }
            } catch {
                problem = error.localizedDescription
            }
        }
    }
}
