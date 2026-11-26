import SwiftUI

/// A member card to open.
struct MemberRequest: Identifiable, Hashable {
    let id: String
}

/// Someone's soft profile, seen from a group you share: their icon, first
/// name, where they are on the mount, and the one line they chose. No
/// contact details and no way to message them privately, by design.
struct MemberCardSheet: View {
    let groupID: String
    let memberID: String

    @Environment(AppModel.self) private var model
    @State private var card: MemberCard?
    @State private var problem: String?

    var body: some View {
        VStack(spacing: 18) {
            if let card {
                avatar(card.avatar, name: card.name)
                VStack(spacing: 6) {
                    Text(card.name).font(.zoeDisplay(34))
                    Text(walking(card)).font(.footnote).foregroundStyle(Zoe.inkMuted)
                }
                if let about = card.about {
                    Text("\u{201C}\(about)\u{201D}")
                        .font(.zoeSerif(.title3).italic())
                        .foregroundStyle(Zoe.ink.opacity(0.9))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 12)
                }
                if !card.groupsInCommon.isEmpty {
                    Text("Also walking together in \(card.groupsInCommon.formatted(.list(type: .and)))")
                        .font(.caption)
                        .foregroundStyle(Zoe.inkMuted)
                        .multilineTextAlignment(.center)
                }
            } else if let problem {
                Text(problem).foregroundStyle(Zoe.inkMuted)
            } else {
                ProgressView().tint(Zoe.peach)
            }
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 36)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.4) }
        .task {
            do {
                card = try await model.together.member(memberID, group: groupID)
            } catch {
                problem = "Their card couldn't be opened just now."
            }
        }
    }

    private func walking(_ card: MemberCard) -> String {
        let day = card.currentDay > 31 ? "Finished the thirty days" : "On Day \(card.currentDay)"
        guard let started = card.startedOn.flatMap({ try? Date($0, strategy: .iso8601.year().month().day()) }) else { return day }
        return "\(day) · walking since \(started.formatted(.dateTime.month(.wide).day()))"
    }

    @ViewBuilder
    private func avatar(_ avatar: MemberCard.Avatar, name: String) -> some View {
        let size: CGFloat = 96
        switch avatar.kind {
        case "photo":
            AsyncImage(url: avatar.photoURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(Zoe.ink.opacity(0.1))
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        case "symbol":
            let tone = avatar.tone.flatMap(AvatarStore.Tone.init(rawValue:)) ?? .peach
            Image(systemName: avatar.symbol ?? "mountain.2")
                .font(.system(size: 38))
                .foregroundStyle(tone.ink)
                .frame(width: size, height: size)
                .background(tone.color, in: Circle())
        default:
            Text(String(name.prefix(1)).uppercased())
                .font(.zoeDisplay(44))
                .foregroundStyle(Zoe.navy)
                .frame(width: size, height: size)
                .background(Zoe.peach, in: Circle())
        }
    }
}

/// Profile → Community: "A word about you", the one line on your card.
struct AboutLineSheet: View {
    let current: String?
    let onSaved: (String?) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var problem: String?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("e.g. Learning to slow down", text: $text, axis: .vertical)
                        .lineLimit(2...4)
                        .onChange(of: text) { _, new in if new.count > 140 { text = String(new.prefix(140)) } }
                } footer: {
                    Text("Others in your groups see this on your card, with your first name and the day you're on. \(140 - text.count) characters left.")
                }
                if let problem { Text(problem).foregroundStyle(Zoe.peach) }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("A word about you")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        isSaving = true
                        Task {
                            defer { isSaving = false }
                            do {
                                onSaved(try await model.together.setAbout(text.trimmingCharacters(in: .whitespacesAndNewlines)))
                                dismiss()
                            } catch {
                                problem = error.localizedDescription
                            }
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.medium])
        .keyboardDismissible()
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
        .onAppear { text = current ?? "" }
    }
}
