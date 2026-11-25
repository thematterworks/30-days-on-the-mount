import SwiftUI

/// Profile → Together: the participant's name, and their walking companions —
/// small groups of friends taking the days together.
struct TogetherSection: View {
    @Environment(AppModel.self) private var model
    @State private var groups: [WalkingGroup] = []
    @State private var name = ""
    @State private var isStarting = false
    @State private var joinCode: String?

    var body: some View {
        Section {
            HStack {
                Text("Your first name")
                Spacer()
                TextField("Add your name", text: $name)
                    .multilineTextAlignment(.trailing)
                    .textContentType(.givenName)
                    .submitLabel(.done)
                    .onSubmit { model.updateFirstName(name) }
                    .foregroundStyle(Zoe.ink)
            }
            ForEach(groups) { group in
                NavigationLink {
                    GroupView(group: group) { groups.removeAll { $0.id == group.id } }
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(group.name).font(.zoeSerif(.headline))
                        Text(group.members.map(\.name).joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(Zoe.inkMuted)
                            .lineLimit(1)
                    }
                }
            }
            Button("Start a walking group", systemImage: "person.2") { isStarting = true }
            Button("Join with an invitation", systemImage: "envelope.open") { joinCode = "" }
        } header: {
            Text("Together")
        } footer: {
            Text("Walk the days with a few friends: a private group, a page for each day. Only the people you invite can see it.")
        }
        .task {
            name = model.firstName ?? ""
            groups = (try? await model.together.groups()) ?? []
        }
        .onChange(of: model.pendingInvite, initial: true) { _, code in
            if let code {
                joinCode = code
                model.pendingInvite = nil
            }
        }
        .sheet(isPresented: $isStarting) {
            StartGroupSheet { groups = $0 }
        }
        .sheet(item: Binding(get: { joinCode.map(JoinRequest.init) }, set: { joinCode = $0?.code })) { request in
            JoinGroupSheet(code: request.code) { groups = $0 }
        }
    }
}

private struct JoinRequest: Identifiable {
    let code: String
    var id: String { code }
}

/// Naming a new group; its invitation is shared from inside it.
private struct StartGroupSheet: View {
    let onCreated: ([WalkingGroup]) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var anonymous = false
    @State private var problem: String?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("e.g. Tuesday Breakfast Crew", text: $name)
                } header: {
                    Text("Name your group")
                } footer: {
                    Text("Next, you'll invite friends with a link. Groups hold up to twelve people.")
                }
                Section("You'll appear as") {
                    Picker("You'll appear as", selection: $anonymous) {
                        Text(model.firstName ?? "My first name").tag(false)
                        Text("A friend").tag(true)
                    }
                    .pickerStyle(.segmented)
                }
                if let problem { Text(problem).foregroundStyle(Zoe.peach) }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Start a walking group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") {
                        isWorking = true
                        Task {
                            defer { isWorking = false }
                            do {
                                onCreated(try await model.together.createGroup(name: name.trimmingCharacters(in: .whitespaces), anonymous: anonymous))
                                dismiss()
                            } catch {
                                problem = "The group couldn't be started. Try again."
                            }
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isWorking)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}

/// Accepting an invitation — from a link, or a code typed in.
private struct JoinGroupSheet: View {
    @State var code: String
    let onJoined: ([WalkingGroup]) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var anonymous = false
    @State private var problem: String?
    @State private var isWorking = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Invitation code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.system(.title3, design: .monospaced))
                } footer: {
                    Text("The eight letters at the end of the link a friend sent you.")
                }
                Section("You'll appear as") {
                    Picker("You'll appear as", selection: $anonymous) {
                        Text(model.firstName ?? "My first name").tag(false)
                        Text("A friend").tag(true)
                    }
                    .pickerStyle(.segmented)
                }
                if let problem { Text(problem).foregroundStyle(Zoe.peach) }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("Join a walking group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Join") {
                        isWorking = true
                        Task {
                            defer { isWorking = false }
                            do {
                                onJoined(try await model.together.joinGroup(code: code, anonymous: anonymous))
                                dismiss()
                            } catch {
                                problem = error.localizedDescription
                            }
                        }
                    }
                    .disabled(code.trimmingCharacters(in: .whitespaces).count < 6 || isWorking)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}

/// A walking group: who's in it, the invitation, and a page for each day —
/// today's by default.
struct GroupView: View {
    let group: WalkingGroup
    let onLeft: () -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var day = 1
    @State private var posts: [SharedPost] = []
    @State private var draft = ""
    @State private var isSending = false
    @State private var note: String?
    @State private var showsSupport = false
    @State private var isConfirmingLeave = false

    var body: some View {
        List {
            Section {
                Text(group.members.map { $0.isMe ? "You" : $0.name }.joined(separator: " · "))
                    .font(.zoeSerif(.subheadline))
                    .foregroundStyle(Zoe.ink.opacity(0.85))
                ShareLink(
                    item: group.inviteURL,
                    subject: Text("Walk 30 Days on the Mount with me"),
                    message: Text("I started a walking group, \"\(group.name)\", for 30 Days on the Mount: thirty mornings in Jesus' Sermon on the Mount, together. Join us:")
                ) {
                    Label("Invite friends", systemImage: "paperplane")
                }
                Text("Invitation code: \(group.inviteCode)")
                    .font(.caption.monospaced())
                    .foregroundStyle(Zoe.inkMuted)
                    .textSelection(.enabled)
            }
            .listRowBackground(Zoe.ink.opacity(0.07))

            Section {
                Picker("Day", selection: $day) {
                    ForEach(1...max(model.journey.progress.currentDay, 1), id: \.self) { number in
                        Text("Day \(number) · \(model.journey.day(number)?.title ?? "")").tag(number)
                    }
                }
                if posts.isEmpty {
                    Text("Nothing here yet. Share how Day \(day) is going.")
                        .font(.zoeSerif(.body).italic())
                        .foregroundStyle(Zoe.inkMuted)
                }
                ForEach(posts) { post in
                    SharedPostRow(post: post, onDelete: { delete(post) }, onReport: { report(post) })
                }
                if showsSupport { SupportNote() }
                if let note { Text(note).font(.footnote).foregroundStyle(Zoe.inkMuted) }
            }
            .listRowBackground(Color.clear)

            Section {
                Button("Leave this group", role: .destructive) { isConfirmingLeave = true }
            }
            .listRowBackground(Zoe.ink.opacity(0.07))
        }
        .scrollContentBackground(.hidden)
        .navigationTitle(group.name)
        .safeAreaInset(edge: .bottom) { composer }
        .task(id: day) { await load() }
        .onAppear { day = max(model.journey.progress.currentDay, 1) }
        .confirmationDialog("Leave \(group.name)?", isPresented: $isConfirmingLeave, titleVisibility: .visible) {
            Button("Leave", role: .destructive) {
                Task {
                    try? await model.together.leaveGroup(group.id)
                    onLeft()
                    dismiss()
                }
            }
        } message: {
            Text("You can rejoin with the invitation if you change your mind.")
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Share with the group", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .background(Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Zoe.locked : Zoe.peach)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private func load() async {
        posts = (try? await model.together.groupPosts(group.id, day: day)) ?? []
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        draft = ""
        isSending = true
        note = nil
        Task {
            defer { isSending = false }
            do {
                let outcome = try await model.together.post(toGroup: group.id, day: day, text: text)
                showsSupport = outcome.support
                if let post = outcome.post {
                    posts.append(post)
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
        Task { try? await model.together.report(postID: post.id) }
    }
}
