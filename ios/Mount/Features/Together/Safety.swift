import SwiftUI

/// Before someone's first post anywhere in Community: the guidelines, and
/// their agreement to them. Shown once (App Review 1.2).
struct CommunityAgreementSheet: View {
    let onAgreed: () -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var isSaving = false
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Before you share").font(.zoeDisplay(34))
                    Text("Community works only if everyone can be honest without being hurt. Everything shared is read with care before others see it.")
                        .font(.zoeSerif(.body))
                        .foregroundStyle(Zoe.ink.opacity(0.88))
                        .fixedSize(horizontal: false, vertical: true)
                    WalkingGuidelines()
                    Text("Breaking the guidelines can lead to a warning, a pause on posting, or removal from Community. You can report or block anyone, at any time.")
                        .font(.footnote)
                        .foregroundStyle(Zoe.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    Link("Read the full Community Guidelines", destination: CommunitySection.guidelines)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Zoe.peach)
                    if let problem { Text(problem).font(.footnote).foregroundStyle(Zoe.peach) }
                    Button(action: agree) {
                        Group {
                            if isSaving { ProgressView().tint(Zoe.deep) } else { Text("I agree") }
                        }
                        .font(.zoeSerif(.title3))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Zoe.peach, in: Capsule())
                        .foregroundStyle(Zoe.deep)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                }
                .padding(24)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } }
            }
        }
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }

    private func agree() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await model.together.agreeToGuidelines()
                model.hasAgreedToCommunity = true
                dismiss()
                onAgreed()
            } catch {
                problem = "That didn't save just now. Try again."
            }
        }
    }
}

/// Profile → Community → Blocked people: who you've blocked, and unblocking.
struct BlockedPeopleSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var people: [BlockedPerson]?

    var body: some View {
        NavigationStack {
            List {
                if let people, people.isEmpty {
                    Text("You haven't blocked anyone.").foregroundStyle(Zoe.inkMuted)
                }
                ForEach(people ?? []) { person in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(person.name)
                            Text("Blocked \(person.since.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(Zoe.inkMuted)
                        }
                        Spacer()
                        Button("Unblock") {
                            self.people?.removeAll { $0.id == person.id }
                            Task { try? await model.together.unblock(memberID: person.id) }
                        }
                        .foregroundStyle(Zoe.peach)
                        .buttonStyle(.borderless)
                    }
                }
                Section {} footer: {
                    Text("Blocking works both ways: you won't see each other's posts, and you'll never be matched into the same group.")
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Blocked people")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .task { people = (try? await model.together.blocked()) ?? [] }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}
