import SwiftUI

/// What Profile → Community shows and opens: the participant's groups,
/// their place in line for matching, and which sheet is up. Kept apart from
/// the section itself, because a Form only lays a section out as rows when
/// nothing (sheets, tasks) is attached to it.
@MainActor
@Observable
final class CommunityState {
    var groups: [WalkingGroup] = []
    var match: MatchStatus?
    var isStarting = false
    var isMatching = false
    var joinCode: String?
    var openGroup: WalkingGroup?
    var me: CommunityMe?
    var isEditingAbout = false

    func refresh(_ model: AppModel) async {
        async let loadedGroups = model.together.groups()
        async let loadedMatch = model.together.matchStatus()
        async let loadedMe = model.together.communityMe()
        if let loaded = try? await loadedGroups { groups = loaded }
        if let loaded = try? await loadedMatch { match = loaded }
        if let loaded = try? await loadedMe { me = loaded }
    }

    /// Whether they can start, join or be matched into groups.
    var isRemoved: Bool { me?.standing.status == "removed" }
}

/// Profile → Community: walking groups, with friends or matched strangers.
struct CommunitySection: View {
    @Bindable var state: CommunityState
    @Environment(AppModel.self) private var model

    static let guidelines = URL(string: "https://www.30daysonthemount.com/community-guidelines")!

    var body: some View {
        Section {
            if let notice = state.me?.standing.notice {
                VStack(alignment: .leading, spacing: 10) {
                    Text(notice).font(.subheadline).foregroundStyle(Zoe.ink).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 16) {
                        Link("Read the guidelines", destination: Self.guidelines)
                        Button("OK") {
                            state.me = state.me.map { CommunityMe(standing: .init(status: $0.standing.status, pausedUntil: $0.standing.pausedUntil, notice: nil), about: $0.about, memberId: $0.memberId) }
                            Task { try? await model.together.clearNotice() }
                        }
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Zoe.peach)
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 6)
            }
            ForEach(state.groups) { group in
                Button { state.openGroup = group } label: { GroupRow(group: group) }
                    .foregroundStyle(Zoe.ink)
            }
            if !state.isRemoved {
                matchRow
                row("Start a group with friends", symbol: "person.2") { state.isStarting = true }
                row("Join with an invitation", symbol: "envelope.open") { state.joinCode = "" }
            }
            Button { state.isEditingAbout = true } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("A word about you").foregroundStyle(Zoe.ink)
                        Text(state.me?.about ?? "One line others in your groups will see")
                            .font(.caption)
                            .foregroundStyle(Zoe.inkMuted)
                            .lineLimit(1)
                    }
                } icon: {
                    Image(systemName: "text.quote").foregroundStyle(Zoe.peach).frame(width: 30)
                }
            }
            Link(destination: Self.guidelines) {
                Label {
                    Text("Community Guidelines").foregroundStyle(Zoe.ink)
                } icon: {
                    Image(systemName: "hand.raised").foregroundStyle(Zoe.peach).frame(width: 30)
                }
            }
        } header: {
            Text("Community")
        } footer: {
            Text("Walk the days with a few others. Everything shared is read with care before anyone sees it.")
        }
    }

    private func row(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label {
                Text(title).foregroundStyle(Zoe.ink)
            } icon: {
                Image(systemName: symbol).foregroundStyle(Zoe.peach).frame(width: 30)
            }
        }
    }

    @ViewBuilder
    private var matchRow: some View {
        switch state.match?.state {
        case .waiting:
            VStack(alignment: .leading, spacing: 6) {
                Label {
                    Text("Finding your walking companions…").foregroundStyle(Zoe.ink)
                } icon: {
                    ProgressView().controlSize(.small)
                }
                Text("You'll get a notification when your group is ready.")
                    .font(.caption)
                    .foregroundStyle(Zoe.inkMuted)
                Button("Stop looking") {
                    Task { state.match = try? await model.together.cancelMatch() }
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(Zoe.peach)
                .buttonStyle(.plain)
            }
            .padding(.vertical, 4)
        case .none?:
            row("Find walking companions", symbol: "person.3") { state.isMatching = true }
        case .blocked?, nil:
            EmptyView()
        }
    }
}

extension View {
    /// The Community section's loading, links and sheets — attached to the
    /// whole Profile form rather than the section.
    func communityPresentations(_ state: CommunityState) -> some View {
        modifier(CommunityPresentations(state: state))
    }
}

private struct CommunityPresentations: ViewModifier {
    @Bindable var state: CommunityState
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content
            .task { await state.refresh(model) }
            .onChange(of: model.pendingInvite, initial: true) { _, code in
                if let code {
                    state.joinCode = code
                    model.pendingInvite = nil
                }
            }
            .onChange(of: model.pendingGroup, initial: true) { _, id in
                guard let id else { return }
                model.pendingGroup = nil
                Task {
                    await state.refresh(model)
                    state.openGroup = state.groups.first { $0.id == id }
                }
            }
            .onChange(of: state.openGroup) { _, group in
                // Back from a conversation: its unread count has changed.
                if group == nil { Task { await state.refresh(model) } }
            }
            .navigationDestination(item: $state.openGroup) { group in
                GroupChatView(group: group) { state.groups.removeAll { $0.id == group.id } }
            }
            .sheet(isPresented: $state.isStarting) {
                StartGroupSheet { state.groups = $0 }
            }
            .sheet(isPresented: $state.isMatching) {
                MatchSheet(termsAccepted: state.match?.termsAccepted ?? false) { status, updated, groupID in
                    state.match = status
                    state.groups = updated
                    if let groupID {
                        // Once the sheet has gone, so the push isn't lost in its dismissal.
                        Task {
                            try? await Task.sleep(for: .milliseconds(600))
                            state.openGroup = updated.first { $0.id == groupID }
                        }
                    }
                }
            }
            .sheet(isPresented: $state.isEditingAbout) {
                AboutLineSheet(current: state.me?.about) { about in
                    state.me = state.me.map { CommunityMe(standing: $0.standing, about: about, memberId: $0.memberId) }
                }
            }
            .sheet(item: Binding(get: { state.joinCode.map(JoinRequest.init) }, set: { state.joinCode = $0?.code })) { request in
                JoinGroupSheet(code: request.code) { state.groups = $0 }
            }
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
        .keyboardDismissible()
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
        .keyboardDismissible()
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}
