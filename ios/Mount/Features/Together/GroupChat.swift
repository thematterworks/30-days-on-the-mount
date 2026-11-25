import SwiftUI

/// A walking group's conversation: one thread across the days, marked by the
/// day each message was written on. Everything is screened before the others
/// see it; while the thread is open it checks for new messages every few
/// seconds.
struct GroupChatView: View {
    let group: WalkingGroup
    let onLeft: () -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var posts: [SharedPost] = []
    @State private var hasLoaded = false
    @State private var draft = ""
    @State private var sending: String?
    @State private var note: String?
    @State private var showsSupport = false
    @State private var isShowingInfo = false
    @FocusState private var isComposing: Bool

    /// Quick words of encouragement, put in the draft to send or change.
    private static let encouragements = ["Praying for you", "Me too", "Thank you for sharing this", "Keep going"]

    var body: some View {
        // The composer is its own row, not attached to the scroll view: on
        // iOS 26 controls inset into a scroll view can lose their taps.
        VStack(spacing: 0) {
            thread
            composer
        }
        .background { ZoeAtmosphere(glow: 0.2).ignoresSafeArea() }
        .navigationTitle(group.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("About this group", systemImage: "person.2") { isShowingInfo = true }
            }
        }
        .sheet(isPresented: $isShowingInfo) {
            GroupInfoSheet(group: group) {
                onLeft()
                dismiss()
            }
        }
        .task { await poll() }
    }

    // MARK: Thread

    private var thread: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 6) {
                    if hasLoaded && posts.isEmpty {
                        Text(group.kind == .matched
                             ? "Say hello. Everyone here is walking within a few days of you."
                             : "Nothing here yet. Share how the walk is going.")
                            .font(.zoeSerif(.body).italic())
                            .foregroundStyle(Zoe.inkMuted)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    }
                    ForEach(Array(posts.enumerated()), id: \.element.id) { index, post in
                        let previous = index > 0 ? posts[index - 1] : nil
                        if let day = post.dayNumber, previous?.dayNumber != day {
                            DayMarker(day: day)
                        }
                        let continues = previous.map { $0.displayName == post.displayName && $0.mine == post.mine && !$0.fromCompanion && $0.dayNumber == post.dayNumber } ?? false
                        MessageBubble(post: post, showsName: !continues, onDelete: { delete(post) }, onReport: { report(post) })
                    }
                    if let sending {
                        MessageBubble(post: SharedPost(id: "sending", dayNumber: nil, displayName: nil, text: sending, createdAt: .now, mine: true), showsName: false)
                            .opacity(0.55)
                            .overlay(alignment: .bottomTrailing) {
                                Text("Reading with care…").font(.caption2).foregroundStyle(Zoe.inkMuted).offset(y: 16)
                            }
                            .padding(.bottom, 14)
                    }
                    if showsSupport { SupportNote().padding(.vertical, 8) }
                    if let note {
                        Text(note)
                            .font(.footnote)
                            .foregroundStyle(Zoe.inkMuted)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .multilineTextAlignment(.trailing)
                    }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .defaultScrollAnchor(.bottom)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: posts.count) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("end", anchor: .bottom) }
            }
            .onChange(of: sending) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("end", anchor: .bottom) }
            }
            .onChange(of: isComposing) { _, composing in
                if composing { proxy.scrollTo("end", anchor: .bottom) }
            }
        }
    }

    // MARK: Composer

    private var trimmed: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var composer: some View {
        VStack(spacing: 8) {
            if trimmed.isEmpty, let last = posts.last, !last.mine, !last.fromCompanion {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Self.encouragements, id: \.self) { words in
                            Button(words) {
                                draft = words
                                isComposing = true
                            }
                            .font(.footnote)
                            .foregroundStyle(Zoe.ink)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.45)))
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField(group.kind == .matched ? "Encourage, share, ask" : "Share with the group", text: $draft, axis: .vertical)
                    .focused($isComposing)
                    .lineLimit(1...5)
                    .padding(.vertical, 10)
                    .padding(.horizontal, 14)
                    .background(Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                Button(action: send) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(trimmed.isEmpty || sending != nil ? Zoe.locked : Zoe.peach)
                }
                .disabled(trimmed.isEmpty || sending != nil)
                .accessibilityLabel("Send")
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    // MARK: Actions

    /// Loads the thread, then checks for new messages every few seconds
    /// until the view goes away.
    private func poll() async {
        if let loaded = try? await model.together.groupPosts(group.id, since: nil) {
            posts = loaded
        }
        hasLoaded = true
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            guard let newer = try? await model.together.groupPosts(group.id, since: posts.last?.createdAt) else { continue }
            let known = Set(posts.map(\.id))
            let fresh = newer.filter { !known.contains($0.id) }
            if !fresh.isEmpty { posts.append(contentsOf: fresh) }
        }
    }

    private func send() {
        let text = trimmed
        guard !text.isEmpty else { return }
        draft = ""
        sending = text
        note = nil
        showsSupport = false
        Task {
            defer { sending = nil }
            do {
                let outcome = try await model.together.post(toGroup: group.id, day: max(model.journey.progress.currentDay, 1), text: text)
                showsSupport = outcome.support
                if let post = outcome.post {
                    if !posts.contains(where: { $0.id == post.id }) { posts.append(post) }
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                } else if let notice = outcome.notice {
                    note = notice
                } else if !outcome.support {
                    note = "Thank you. It will appear once it has been read."
                }
            } catch {
                draft = text
                note = "It couldn't be sent just now."
            }
        }
    }

    private func delete(_ post: SharedPost) {
        posts.removeAll { $0.id == post.id }
        Task { try? await model.together.delete(postID: post.id) }
    }

    private func report(_ post: SharedPost) {
        posts.removeAll { $0.id == post.id }
        note = "Thank you for telling us. It's hidden for you, and we'll look at it."
        Task { try? await model.together.report(postID: post.id) }
    }
}

/// "Day 4", between the days of a conversation.
private struct DayMarker: View {
    let day: Int

    var body: some View {
        Text("Day \(day)")
            .zoeLabelStyle()
            .frame(maxWidth: .infinity)
            .padding(.top, 18)
            .padding(.bottom, 6)
    }
}

/// One message: the participant's own on the right, others' on the left,
/// and the companion's in the middle, quieter.
private struct MessageBubble: View {
    let post: SharedPost
    let showsName: Bool
    var onDelete: (() -> Void)?
    var onReport: (() -> Void)?

    var body: some View {
        if post.fromCompanion {
            VStack(spacing: 6) {
                Image(systemName: "mountain.2").font(.caption).foregroundStyle(Zoe.peach)
                Text(post.text)
                    .font(.zoeSerif(.subheadline).italic())
                    .foregroundStyle(Zoe.ink.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
        } else {
            VStack(alignment: post.mine ? .trailing : .leading, spacing: 3) {
                if showsName && !post.mine {
                    Text(post.displayName ?? "A friend")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Zoe.ink.opacity(0.75))
                        .padding(.leading, 12)
                        .padding(.top, 8)
                }
                Text(post.text)
                    .font(.zoeSerif(.body))
                    .foregroundStyle(post.mine ? Zoe.deep : Zoe.ink.opacity(0.94))
                    .lineSpacing(3)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(post.mine ? Zoe.peach : Zoe.ink.opacity(0.09), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .fixedSize(horizontal: false, vertical: true)
                    .contextMenu {
                        Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = post.text }
                        if post.mine, let onDelete {
                            Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
                        } else if !post.mine, let onReport {
                            Button("Report", systemImage: "flag", role: .destructive, action: onReport)
                        }
                    }
            }
            .frame(maxWidth: 300, alignment: post.mine ? .trailing : .leading)
            .frame(maxWidth: .infinity, alignment: post.mine ? .trailing : .leading)
        }
    }
}

/// Who's in the group and where they are on the mount; the invitation for
/// friends' groups; the guidelines for matched ones; leaving.
private struct GroupInfoSheet: View {
    let group: WalkingGroup
    let onLeft: () -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingLeave = false

    var body: some View {
        NavigationStack {
            List {
                Section("Walking together") {
                    ForEach(Array(group.members.enumerated()), id: \.offset) { _, member in
                        HStack {
                            Text(member.isMe ? "You" : member.name)
                            Spacer()
                            if let day = member.currentDay {
                                Text(day > 31 ? "Finished" : "Day \(day)").foregroundStyle(Zoe.inkMuted)
                            }
                        }
                    }
                }
                if let url = group.inviteURL, let code = group.inviteCode {
                    Section {
                        ShareLink(
                            item: url,
                            subject: Text("Walk 30 Days on the Mount with me"),
                            message: Text("I started a walking group, \"\(group.name)\", for 30 Days on the Mount: thirty mornings in Jesus' Sermon on the Mount, together. Join us:")
                        ) {
                            Label("Invite friends", systemImage: "paperplane")
                        }
                        Text("Invitation code: \(code)")
                            .font(.caption.monospaced())
                            .foregroundStyle(Zoe.inkMuted)
                            .textSelection(.enabled)
                    }
                } else {
                    Section {
                        WalkingGuidelines()
                    } header: {
                        Text("How we walk together")
                    } footer: {
                        Text("Matched groups have no private messages and no invitations. Press and hold a message to report it.")
                    }
                }
                Section {
                    Button("Leave this group", role: .destructive) { isConfirmingLeave = true }
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle(group.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog("Leave \(group.name)?", isPresented: $isConfirmingLeave, titleVisibility: .visible) {
                Button("Leave", role: .destructive) {
                    Task {
                        try? await model.together.leaveGroup(group.id)
                        dismiss()
                        onLeft()
                    }
                }
            } message: {
                Text(group.kind == .matched
                     ? "You can ask to be matched again from Profile."
                     : "You can rejoin with the invitation if you change your mind.")
            }
        }
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}
