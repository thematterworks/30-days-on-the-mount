import SwiftUI

/// Profile → Together: the participant's name, and their walking companions —
/// small groups taking the days together, with friends or matched strangers.
struct TogetherSection: View {
    @Environment(AppModel.self) private var model
    @State private var groups: [WalkingGroup] = []
    @State private var match: MatchStatus?
    @State private var name = ""
    @State private var isStarting = false
    @State private var isMatching = false
    @State private var joinCode: String?
    @State private var openGroup: WalkingGroup?

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
                Button { openGroup = group } label: { GroupRow(group: group) }
                    .foregroundStyle(Zoe.ink)
            }
            matchRow
            Button("Start a group with friends", systemImage: "person.2") { isStarting = true }
            Button("Join with an invitation", systemImage: "envelope.open") { joinCode = "" }
        } header: {
            Text("Together")
        } footer: {
            Text("Walk the days with a few others: a private conversation for your group, screened with care. Start one with friends, or be matched with people on nearby days.")
        }
        .task { await refresh() }
        .onChange(of: model.pendingInvite, initial: true) { _, code in
            if let code {
                joinCode = code
                model.pendingInvite = nil
            }
        }
        .onChange(of: model.pendingGroup, initial: true) { _, id in
            guard let id else { return }
            model.pendingGroup = nil
            Task {
                await refresh()
                openGroup = groups.first { $0.id == id }
            }
        }
        .onChange(of: openGroup) { _, group in
            // Back from a conversation: its unread count has changed.
            if group == nil { Task { await refresh() } }
        }
        .navigationDestination(item: $openGroup) { group in
            GroupChatView(group: group) { groups.removeAll { $0.id == group.id } }
        }
        .sheet(isPresented: $isStarting) {
            StartGroupSheet { groups = $0 }
        }
        .sheet(isPresented: $isMatching) {
            MatchSheet(termsAccepted: match?.termsAccepted ?? false) { status, updated, groupID in
                match = status
                groups = updated
                if let groupID {
                    // Once the sheet has gone, so the push isn't lost in its dismissal.
                    Task {
                        try? await Task.sleep(for: .milliseconds(600))
                        openGroup = updated.first { $0.id == groupID }
                    }
                }
            }
        }
        .sheet(item: Binding(get: { joinCode.map(JoinRequest.init) }, set: { joinCode = $0?.code })) { request in
            JoinGroupSheet(code: request.code) { groups = $0 }
        }
    }

    @ViewBuilder
    private var matchRow: some View {
        switch match?.state {
        case .waiting:
            VStack(alignment: .leading, spacing: 6) {
                Label("Finding your walking companions…", systemImage: "person.3")
                    .foregroundStyle(Zoe.ink)
                Text("We're gathering a few people on nearby days. You'll get a notification when your group is ready.")
                    .font(.caption)
                    .foregroundStyle(Zoe.inkMuted)
                Button("Stop looking") {
                    Task { match = try? await model.together.cancelMatch() }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(Zoe.peach)
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
            .padding(.vertical, 4)
        case .none?:
            Button("Find walking companions", systemImage: "person.3") { isMatching = true }
        case .blocked?, nil:
            EmptyView()
        }
    }

    private func refresh() async {
        name = model.firstName ?? name
        async let loadedGroups = model.together.groups()
        async let loadedMatch = model.together.matchStatus()
        if let loaded = try? await loadedGroups { groups = loaded }
        if let loaded = try? await loadedMatch { match = loaded }
    }
}

/// A group in the list: its name, the latest message, and what's unread.
private struct GroupRow: View {
    let group: WalkingGroup

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(group.name).font(.zoeSerif(.headline))
                    if group.kind == .matched {
                        Text("Matched").font(.caption2.weight(.semibold)).foregroundStyle(Zoe.peach)
                    }
                }
                Group {
                    if let last = group.lastMessage {
                        Text("\(last.name): \(last.text)")
                    } else {
                        Text(group.members.map(\.name).joined(separator: ", "))
                    }
                }
                .font(.caption)
                .foregroundStyle(Zoe.inkMuted)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
            if group.unread > 0 {
                Text(group.unread > 9 ? "9+" : "\(group.unread)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Zoe.deep)
                    .frame(minWidth: 20, minHeight: 20)
                    .background(Zoe.peach, in: Capsule())
                    .accessibilityLabel("\(group.unread) unread")
            }
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Zoe.locked)
        }
        .contentShape(Rectangle())
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
