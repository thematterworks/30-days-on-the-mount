import SwiftUI
import UIKit

/// Profile and settings. The journey at a glance, then the few preferences
/// that shape it. Every setting here changes something the participant can
/// feel; nothing is decorative.
struct ProfileView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingDeletion = false
    @State private var isChoosingIcon = false
    @State private var isDeleting = false
    @State private var deletionError: String?
    @State private var community = CommunityState()
    @State private var name = ""
    @FocusState private var isEditingName: Bool

    var body: some View {
        @Bindable var settings = model.settings
        let journey = model.journey
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 14) {
                        Button { isChoosingIcon = true } label: {
                            AvatarView(size: 76)
                                .overlay(alignment: .bottomTrailing) {
                                    Image(systemName: "pencil")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Zoe.navy)
                                        .frame(width: 24, height: 24)
                                        .background(Zoe.ink, in: Circle())
                                }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Change profile icon")
                        nameField
                        HStack(spacing: 28) {
                            stat("\(journey.progress.currentDay)", "of \(max(journey.totalDays, 1)) days")
                            stat("\(journey.progress.finishedStories.count)", "carried")
                            stat("\(journey.reflections.count)", "reflections")
                            stat("\(model.bible.highlights.count)", "highlights")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .listRowBackground(Color.clear)

                Section {
                    ShareJourneyCard()
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))

                CommunitySection(state: community)
                    .listRowBackground(rowBackground)

                Section("Rhythm") {
                    Picker("Morning invitation", selection: $settings.morningHour) {
                        ForEach(5..<12, id: \.self) { hour in Text(Self.hourLabel(hour)).tag(hour) }
                    }
                    .onChange(of: settings.morningHour) { old, new in
                        if old != new { model.morningHourChanged(to: new) }
                    }
                    Toggle("Midday: going deeper", isOn: Binding(
                        get: { model.middayInvitations },
                        set: { model.setMiddayInvitations($0) }
                    ))
                    Toggle("Evening check-in", isOn: $settings.eveningCheckIn)
                    Toggle("Live Activity for the day", isOn: $settings.liveActivities)
                }
                .listRowBackground(rowBackground)

                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Reading size")
                            Spacer()
                            Text("\(Int(settings.readingScale * 100))%").foregroundStyle(Zoe.inkMuted)
                        }
                        Slider(value: $settings.readingScale, in: 0.85...1.4, step: 0.05)
                        Text("Blessed are the poor in spirit, for theirs is the kingdom of heaven.")
                            .font(.system(size: 19 * settings.readingScale, design: .serif))
                            .foregroundStyle(Zoe.ink.opacity(0.9))
                    }
                    .padding(.vertical, 4)
                    LabeledContent("Translation", value: "Berean Standard Bible")
                    Toggle("Begin today with three breaths", isOn: $settings.thresholdBreaths)
                } header: {
                    Text("Reading")
                }
                .listRowBackground(rowBackground)

                Section {
                    Button("Notification settings") {
                        if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                } header: {
                    Text("Notifications")
                } footer: {
                    Text("For undistracted time, add \"On the Mount\" to a Focus: Settings → Focus → choose a Focus → Focus Filters. While that Focus is on, other apps stay quiet and this one opens to today.")
                }
                .listRowBackground(rowBackground)

                Section("About") {
                    Link("Privacy policy", destination: URL(string: "https://www.30daysonthemount.com/privacy")!)
                    Link("Terms of service", destination: URL(string: "https://www.30daysonthemount.com/terms")!)
                    LabeledContent("Version", value: Self.version)
                }
                .listRowBackground(rowBackground)

                Section {
                    Button("Sign out") { model.signOut() }
                    Button(role: .destructive) {
                        confirmingDeletion = true
                    } label: {
                        HStack {
                            Text("Delete account")
                            if isDeleting { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(isDeleting)
                } footer: {
                    if let deletionError {
                        Text(deletionError)
                    } else if model.session.session?.isPreview == true {
                        Text("Preview build — your journey is stored on this device only.")
                    }
                }
                .listRowBackground(rowBackground)
            }
            .scrollContentBackground(.hidden)
            .tint(Zoe.peach)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            // Content scrolling up passes beneath a frosted bar, not
            // through the title.
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .communityPresentations(community)
            .onAppear { name = model.firstName ?? "" }
            .sheet(isPresented: $isChoosingIcon) { AvatarPicker() }
            .confirmationDialog(
                "Delete your account?",
                isPresented: $confirmingDeletion,
                titleVisibility: .visible
            ) {
                Button("Delete account and journey", role: .destructive) {
                    Task {
                        isDeleting = true
                        deletionError = nil
                        defer { isDeleting = false }
                        do {
                            try await model.deleteAccount()
                        } catch {
                            deletionError = "Your account wasn't deleted. \(error.localizedDescription)"
                        }
                    }
                }
            } message: {
                Text("Your progress, reflections, highlights and conversation will be permanently removed. This can't be undone.")
            }
        }
        .keyboardDismissible()
        .presentationBackground { ZoeAtmosphere(glow: 0.25) }
        .presentationDragIndicator(.visible)
    }

    private var rowBackground: some View {
        Zoe.ink.opacity(0.07)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.zoeDisplay(26, relativeTo: .title2)).foregroundStyle(Zoe.ink)
            Text(label).font(.caption2).foregroundStyle(Zoe.inkMuted)
        }
        .accessibilityElement(children: .combine)
    }

    /// The participant's first name, under their icon — tap to change it.
    /// It's the name others see in Community.
    private var nameField: some View {
        HStack(spacing: 6) {
            TextField("Add your name", text: $name)
                .font(.zoeSerif(.title2))
                .foregroundStyle(Zoe.ink)
                .multilineTextAlignment(.center)
                .textContentType(.givenName)
                .submitLabel(.done)
                .focused($isEditingName)
                .fixedSize()
                .onSubmit(saveName)
            if !isEditingName {
                Image(systemName: "pencil")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Zoe.inkMuted)
                    .onTapGesture { isEditingName = true }
            }
        }
        .onChange(of: isEditingName) { _, editing in
            if !editing { saveName() }
        }
    }

    private func saveName() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard trimmed != (model.firstName ?? "") else { return }
        model.updateFirstName(trimmed)
    }

    private static func hourLabel(_ hour: Int) -> String {
        var components = DateComponents()
        components.hour = hour
        let date = Calendar.current.date(from: components) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }

    private static var version: String {
        let info = Bundle.main.infoDictionary
        return "\(info?["CFBundleShortVersionString"] as? String ?? "1.0") (\(info?["CFBundleVersion"] as? String ?? "1"))"
    }
}
