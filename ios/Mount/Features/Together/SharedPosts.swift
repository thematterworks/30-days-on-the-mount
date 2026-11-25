import SwiftUI

/// One shared reflection or group post: the name the writer chose (or
/// "Someone on the journey"), their words, and when. No likes, no counts.
struct SharedPostRow: View {
    let post: SharedPost
    var onDelete: (() -> Void)?
    var onReport: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(post.mine ? "You" : (post.displayName ?? "Someone on the journey"))
                    .font(.zoeSerif(.subheadline).weight(.semibold))
                    .foregroundStyle(post.mine ? Zoe.peach : Zoe.ink.opacity(0.9))
                Text(post.createdAt, format: .relative(presentation: .named))
                    .font(.caption2)
                    .foregroundStyle(Zoe.inkMuted)
                Spacer()
                Menu {
                    if post.mine, let onDelete {
                        Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
                    } else if let onReport {
                        Button("Report", systemImage: "flag", action: onReport)
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.caption)
                        .foregroundStyle(Zoe.inkMuted)
                        .frame(width: 30, height: 24)
                        .contentShape(Rectangle())
                }
            }
            Text(post.text)
                .font(.zoeSerif(.body))
                .foregroundStyle(Zoe.ink.opacity(0.92))
                .lineSpacing(5)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 12)
    }
}

/// Gentle words, and a way to talk to someone, for a writer whose post the
/// screen held because it saw signs they may be struggling.
struct SupportNote: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("You're not alone in this").font(.zoeSerif(.headline))
            Text("Thank you for trusting us with what you wrote. We've kept it private for now. If you're struggling, please reach out to someone today. You can call or text 988 any time to talk with someone who cares.")
                .font(.zoeSerif(.subheadline))
                .foregroundStyle(Zoe.ink.opacity(0.9))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
            Link(destination: URL(string: "tel:988")!) {
                Label("Call or text 988", systemImage: "phone")
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
            }
        }
        .padding(16)
        .background(Zoe.peach.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// Sharing a reflection with everyone walking the same day: the words
/// (editable), how they're signed, and what happens next.
struct ShareReflectionSheet: View {
    let dayNumber: Int
    let original: String
    var onShared: (SharedPost) -> Void = { _ in }

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var anonymous = false
    @State private var name = ""
    @State private var isSharing = false
    @State private var result: ShareOutcome?
    @State private var problem: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let result {
                        outcome(result)
                    } else {
                        Text("Others walking Day \(dayNumber) will see this. Every share is read with care before it appears.")
                            .font(.zoeSerif(.subheadline))
                            .foregroundStyle(Zoe.inkMuted)
                        TextEditor(text: $text)
                            .scrollContentBackground(.hidden)
                            .font(.zoeSerif(.body))
                            .frame(minHeight: 140)
                            .padding(12)
                            .background(Zoe.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Shared as").zoeLabelStyle()
                            Picker("Shared as", selection: $anonymous) {
                                Text(model.firstName ?? "My first name").tag(false)
                                Text("Anonymous").tag(true)
                            }
                            .pickerStyle(.segmented)
                            if !anonymous, model.firstName == nil {
                                TextField("Your first name", text: $name)
                                    .textContentType(.givenName)
                                    .padding(12)
                                    .background(Zoe.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                        }

                        if let problem {
                            Text(problem).font(.footnote).foregroundStyle(Zoe.peach)
                        }

                        Button(action: share) {
                            Group {
                                if isSharing { ProgressView().tint(Zoe.deep) } else { Text("Share") }
                            }
                            .font(.zoeSerif(.title3))
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Zoe.peach, in: Capsule())
                            .foregroundStyle(Zoe.deep)
                        }
                        .buttonStyle(.plain)
                        .disabled(isSharing || trimmed.isEmpty || (!anonymous && model.firstName == nil && name.trimmingCharacters(in: .whitespaces).isEmpty))
                    }
                }
                .padding(22)
            }
            .navigationTitle("Share your reflection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(result == nil ? "Cancel" : "Done") { dismiss() } }
            }
        }
        .onAppear { if text.isEmpty { text = original } }
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    @ViewBuilder
    private func outcome(_ result: ShareOutcome) -> some View {
        if result.support {
            SupportNote()
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "mountain.2").font(.title2).foregroundStyle(Zoe.peach)
                Text(result.outcome == .shared ? "Shared. Thank you." : "Thank you.")
                    .font(.zoeDisplay(32))
                Text(result.outcome == .shared
                     ? "Someone walking Day \(dayNumber) may find exactly what they needed in your words."
                     : "Your reflection will appear once it has been read.")
                    .font(.zoeSerif(.body))
                    .foregroundStyle(Zoe.ink.opacity(0.85))
            }
        }
    }

    private func share() {
        problem = nil
        isSharing = true
        let chosen = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !anonymous, model.firstName == nil, !chosen.isEmpty { model.updateFirstName(chosen) }
        Task {
            defer { isSharing = false }
            // A just-entered name has to reach the server before the post does.
            try? await Task.sleep(for: .milliseconds(anonymous || chosen.isEmpty ? 0 : 400))
            do {
                let outcome = try await model.together.share(day: dayNumber, text: trimmed, anonymous: anonymous)
                result = outcome
                if let post = outcome.post { onShared(post) }
            } catch {
                problem = "It couldn't be shared just now. Try again in a moment."
            }
        }
    }
}

/// The story card after the reflection: what others walking this day chose
/// to share. A long card, so it scrolls through all of them.
struct WalkingWithOthersScreen: View {
    let day: JourneyDay
    let isActive: Bool

    @Environment(AppModel.self) private var model
    @State private var posts: [SharedPost] = []
    @State private var hasLoaded = false
    @State private var isSharing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Walking with others").zoeLabelStyle(Zoe.peach)
                .arrival(isActive, order: 0)
            Text("What others on Day \(day.dayNumber) are carrying")
                .font(.zoeSerif(.title2))
                .fixedSize(horizontal: false, vertical: true)
                .arrival(isActive, order: 1)

            Button { isSharing = true } label: {
                Label("Share your reflection", systemImage: "square.and.arrow.up")
                    .zoeLabelStyle(Zoe.ink)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.6)))
            }
            .buttonStyle(.plain)
            .arrival(isActive, order: 2)

            if posts.isEmpty {
                Text(hasLoaded ? "No one has shared yet today. Yours could be the first." : "Gathering what others have shared…")
                    .font(.zoeSerif(.body).italic())
                    .foregroundStyle(Zoe.inkMuted)
                    .padding(.top, 12)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(posts) { post in
                        SharedPostRow(post: post, onDelete: { delete(post) }, onReport: { report(post) })
                        Rectangle().fill(Zoe.locked).frame(height: 0.5)
                    }
                }
                .arrival(isActive, order: 3)
            }
        }
        .padding(.horizontal, 30)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: isActive) {
            guard isActive else { return }
            posts = (try? await model.together.dayPosts(day.dayNumber)) ?? posts
            hasLoaded = true
        }
        .sheet(isPresented: $isSharing) {
            ShareReflectionSheet(dayNumber: day.dayNumber, original: model.journey.reflections[day.dayNumber]?.text ?? "") { post in
                posts.insert(post, at: 0)
            }
        }
    }

    private func delete(_ post: SharedPost) {
        posts.removeAll { $0.id == post.id }
        Task { try? await model.together.delete(postID: post.id) }
    }

    private func report(_ post: SharedPost) {
        posts.removeAll { $0.id == post.id }
        Task { try? await model.together.report(postID: post.id) }
    }
}
