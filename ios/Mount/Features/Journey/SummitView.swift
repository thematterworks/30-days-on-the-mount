import SwiftUI

/// The last page of the journey, after Day 31 is carried. The thirty-one
/// days appear as the path that was walked, then resolve into the mountain
/// line itself. Nothing is shared unless the participant chooses to; the
/// card they can share carries no name, number or reflection.
struct SummitPage: View {
    @Environment(AppModel.self) private var model
    @State private var resolved = false
    @State private var shareCard: Image?

    var body: some View {
        let journey = model.journey
        VStack(spacing: 18) {
            Spacer(minLength: 50)

            ZStack {
                SummitPath(total: journey.totalDays, entered: journey.progress.finishedStories)
                    .opacity(resolved ? 0 : 1)
                    .scaleEffect(resolved ? 0.9 : 1)
                Image("MountainLine")
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFit()
                    .foregroundStyle(Zoe.ink)
                    .opacity(resolved ? 1 : 0)
                    .scaleEffect(resolved ? 1 : 1.08)
                Circle()
                    .fill(RadialGradient(colors: [Zoe.peach.opacity(resolved ? 0.35 : 0), .clear], center: .center, startRadius: 0, endRadius: 140))
                    .frame(width: 280, height: 280)
                    .allowsHitTesting(false)
            }
            .frame(width: 280, height: 170)
            .accessibilityHidden(true)

            Text("The summit").zoeLabelStyle(Zoe.peach)
            Text("You walked the mount")
                .font(.zoeDisplay(42))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Text("Thirty-one days with the words of Jesus. Whatever you carried, whatever you set down, the path is yours. The Sermon is still here, and so is your companion, whenever you want to return.")
                .font(.zoeSerif(.body))
                .foregroundStyle(Zoe.ink.opacity(0.88))
                .multilineTextAlignment(.center)
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 28) {
                stat("\(journey.progress.finishedStories.count)", "days entered")
                stat("\(journey.reflections.count)", "reflections")
            }
            .padding(.top, 4)

            Spacer(minLength: 16)

            if let shareCard {
                ShareLink(
                    item: shareCard,
                    preview: SharePreview("30 Days on the Mount", image: shareCard)
                ) {
                    Label("Share your summit", systemImage: "square.and.arrow.up")
                        .zoeLabelStyle(Zoe.ink)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .zoeGlass(in: Capsule())
                }
                Text("Only if you'd like to. It shows the mountain, nothing personal.")
                    .font(.caption)
                    .foregroundStyle(Zoe.inkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 32)
        .padding(.bottom, 76)
        .frame(maxWidth: .infinity)
        .task {
            shareCard = SummitCard.render()
            try? await Task.sleep(for: .seconds(1.2))
            withAnimation(.easeInOut(duration: 2.4)) { resolved = true }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.zoeDisplay(28)).foregroundStyle(Zoe.ink)
            Text(label).font(.caption2).foregroundStyle(Zoe.inkMuted)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Every day as a mark along a climb: the days entered in peach, the rest
/// quieter. Grace over streaks: an unentered day is still on the path.
private struct SummitPath: View {
    let total: Int
    let entered: Set<Int>

    var body: some View {
        GeometryReader { proxy in
            let count = max(total, 1)
            ZStack {
                ForEach(1...count, id: \.self) { day in
                    let x = Double(day - 1) / Double(max(count - 1, 1))
                    let height = min(1, 0.85 * x + 0.1 * sin(x * .pi * 3))
                    Circle()
                        .fill(entered.contains(day) ? Zoe.peach : Zoe.ink.opacity(0.3))
                        .frame(width: day == count ? 10 : 5, height: day == count ? 10 : 5)
                        .position(x: 6 + x * (proxy.size.width - 12), y: 6 + (1 - height) * (proxy.size.height - 12))
                }
            }
        }
    }
}

/// The shareable card: the mountain and the words, on the brand gradient.
private enum SummitCard {
    @MainActor
    static func render() -> Image? {
        let card = VStack(spacing: 28) {
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 520)
                .foregroundStyle(.white)
            Text("I walked")
                .font(.system(size: 44, design: .serif).italic())
                .foregroundStyle(.white.opacity(0.85))
            Text("30 Days on the Mount")
                .font(.custom(ZoeType.displayFamily, size: 88))
                .foregroundStyle(Zoe.peach)
            Text("Matthew 5–7")
                .font(.system(size: 30, weight: .medium))
                .tracking(6)
                .textCase(.uppercase)
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(width: 1080, height: 1350)
        .background(Zoe.gradient)

        let renderer = ImageRenderer(content: card)
        renderer.scale = 1
        return renderer.uiImage.map { Image(uiImage: $0) }
    }
}
