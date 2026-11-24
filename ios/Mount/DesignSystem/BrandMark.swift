import SwiftUI

/// The small header lockup from the layouts: the mountain line art over
/// "30 DAYS ON THE MOUNT" in tracked peach.
struct BrandMark: View {
    var compact = false

    var body: some View {
        VStack(spacing: compact ? 4 : 8) {
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: compact ? 38 : 72)
                .foregroundStyle(Zoe.ink)
            Text("30 Days on the Mount")
                .font(.system(size: compact ? 8.5 : 10.5, weight: .regular))
                .tracking(compact ? 1.8 : 2.4)
                .textCase(.uppercase)
                .foregroundStyle(Zoe.peach)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("30 Days on the Mount")
    }
}

/// The participant's avatar, top right on every tab. Opens Profile.
struct AvatarButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Button {
            model.isProfilePresented = true
        } label: {
            Text(model.profileInitials)
                .font(.system(.footnote, design: .serif, weight: .semibold))
                .foregroundStyle(Zoe.navy)
                .frame(width: 34, height: 34)
                .background(Zoe.peach, in: Circle())
                .overlay(Circle().strokeBorder(Zoe.ink.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Profile and settings")
    }
}

/// The header every tab shares: brand mark centered, avatar at the trailing
/// edge, floating over full-bleed content.
struct HubHeader: View {
    var body: some View {
        ZStack {
            BrandMark(compact: true)
            HStack {
                Spacer()
                AvatarButton()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 4)
    }
}
