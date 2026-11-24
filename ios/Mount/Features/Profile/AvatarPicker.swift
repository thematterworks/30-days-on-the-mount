import PhotosUI
import SwiftUI

/// The participant's icon, wherever it appears: avatar button, profile.
struct AvatarView: View {
    let size: CGFloat
    @Environment(AppModel.self) private var model

    var body: some View {
        let avatar = model.avatar
        Group {
            switch avatar.choice {
            case .photo:
                if let photo = avatar.photo {
                    Image(uiImage: photo).resizable().scaledToFill()
                } else {
                    initials
                }
            case .symbol(let name, let tone):
                Image(systemName: name)
                    .font(.system(size: size * 0.44, weight: .light))
                    .foregroundStyle(tone.ink)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(tone.color)
            case .initials:
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initials: some View {
        Text(model.profileInitials)
            .font(.system(size: size * 0.38, weight: .semibold, design: .serif))
            .foregroundStyle(Zoe.navy)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Zoe.peach)
    }
}

/// Choosing an icon: a photo, a symbol on a tone, or initials. Changes
/// apply as they're tapped.
struct AvatarPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var photoItem: PhotosPickerItem?
    @State private var tone: AvatarStore.Tone = .peach

    var body: some View {
        let avatar = model.avatar
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    AvatarView(size: 120)
                        .overlay(Circle().strokeBorder(Zoe.ink.opacity(0.4)))
                        .padding(.top, 12)
                        .animation(.smooth, value: avatar.choice)

                    PhotosPicker(selection: $photoItem, matching: .images) {
                        // PhotosPicker's label is built off the main actor,
                        // so it's styled directly rather than with the
                        // design-system modifiers.
                        Label("Choose a photo", systemImage: "photo")
                            .font(.zoeLabel)
                            .tracking(2.4)
                            .textCase(.uppercase)
                            .foregroundStyle(Zoe.ink)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 11)
                            .background(Zoe.ink.opacity(0.1), in: Capsule())
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Or a symbol").zoeLabelStyle()
                        HStack(spacing: 12) {
                            ForEach(AvatarStore.Tone.allCases, id: \.self) { option in
                                Button {
                                    tone = option
                                    if case .symbol(let name, _) = avatar.choice {
                                        avatar.choose(.symbol(name: name, tone: option))
                                    }
                                } label: {
                                    Circle().fill(option.color)
                                        .frame(width: 30, height: 30)
                                        .overlay(Circle().strokeBorder(Zoe.ink, lineWidth: tone == option ? 2 : 0))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(option.rawValue)
                            }
                        }
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 5), spacing: 14) {
                            ForEach(AvatarStore.symbols, id: \.self) { name in
                                let selected = avatar.choice == .symbol(name: name, tone: tone)
                                Button {
                                    avatar.choose(.symbol(name: name, tone: tone))
                                } label: {
                                    Image(systemName: name)
                                        .font(.title3.weight(.light))
                                        .foregroundStyle(tone.ink)
                                        .frame(width: 54, height: 54)
                                        .background(tone.color, in: Circle())
                                        .overlay(Circle().strokeBorder(Zoe.ink, lineWidth: selected ? 2 : 0))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    Button("Use my initials") { avatar.choose(.initials) }
                        .font(.footnote)
                        .foregroundStyle(Zoe.inkMuted)
                }
                .padding(24)
            }
            .navigationTitle("Profile icon")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .sensoryFeedback(.selection, trigger: avatar.choice)
            .onAppear {
                if case .symbol(_, let current) = avatar.choice { tone = current }
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self) { avatar.setPhoto(data) }
                    photoItem = nil
                }
            }
        }
        .presentationBackground { ZoeAtmosphere(glow: 0.25) }
        .presentationDetents([.large])
    }
}
