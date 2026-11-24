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
                SoundToggle()
                Spacer()
                AvatarButton()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 4)
    }
}

/// The ambient music's one control: a small speaker, top left on every tab.
/// Present but quiet — it should be findable, never noticed.
struct SoundToggle: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let audio = model.audio
        Button {
            audio.isAmbientOn.toggle()
        } label: {
            Image(systemName: audio.isAmbientOn ? "speaker.wave.2" : "speaker.slash")
                .font(.footnote.weight(.medium))
                .foregroundStyle(audio.isAmbientOn ? Zoe.ink.opacity(0.75) : Zoe.inkMuted)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 34, height: 34)
                .zoeGlass(in: Circle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: audio.isAmbientOn)
        .accessibilityLabel(audio.isAmbientOn ? "Turn off ambient music" : "Turn on ambient music")
    }
}

/// Reads a passage aloud in the app's voice. Hidden until the server can;
/// tapping again stops.
struct ListenButton: View {
    let text: String
    let id: String
    var label = "Listen"
    var compact = false

    @Environment(AppModel.self) private var model

    var body: some View {
        let audio = model.audio
        let isThis = audio.speakingID == id
        if model.voiceAvailable {
            Button {
                audio.toggleSpeaking(text, id: id)
            } label: {
                if compact {
                    Group {
                        if isThis && audio.isPreparingSpeech {
                            ProgressView().controlSize(.mini).tint(Zoe.inkMuted)
                        } else {
                            Image(systemName: isThis ? "stop.fill" : "speaker.wave.2")
                                .contentTransition(.symbolEffect(.replace))
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(isThis ? Zoe.peach : Zoe.inkMuted)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
                } else {
                    HStack(spacing: 8) {
                        if isThis && audio.isPreparingSpeech {
                            ProgressView().controlSize(.small).tint(Zoe.ink)
                        } else {
                            Image(systemName: isThis ? "stop.fill" : "play.fill")
                        }
                        Text(isThis ? "Stop" : label)
                    }
                    .zoeLabelStyle(Zoe.ink)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .zoeGlass(in: Capsule())
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isThis ? "Stop reading aloud" : "\(label), read aloud")
        }
    }
}
