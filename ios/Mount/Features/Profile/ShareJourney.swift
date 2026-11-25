import SwiftUI

/// "Share the journey": an invitation for someone in the participant's
/// life to walk the thirty days too — a personal note, the link, and a card
/// in the brand's colours for the share sheet.
struct ShareJourneyCard: View {
    @Environment(AppModel.self) private var model
    @State private var card: Image?

    private static let link = URL(string: "https://www.30daysonthemount.com")!

    var body: some View {
        let day = model.journey.progress.currentDay
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Share the journey").font(.zoeDisplay(30)).foregroundStyle(Zoe.ink)
                    Text("Someone in your life could use thirty quiet mornings with the words of Jesus. Walking it together changes it.")
                        .font(.zoeSerif(.subheadline))
                        .foregroundStyle(Zoe.ink.opacity(0.85))
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image("MountainLine")
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFit()
                    .frame(width: 56)
                    .foregroundStyle(Zoe.peach.opacity(0.8))
                    .padding(.top, 6)
            }

            ShareLink(
                item: Self.link,
                subject: Text("Walk the Sermon on the Mount with me"),
                message: Text(message(day: day)),
                preview: SharePreview("Walk the Sermon on the Mount with me", image: card ?? Image("MountainLine"))
            ) {
                Label("Invite someone", systemImage: "paperplane")
                    .font(.zoeSerif(.headline))
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Zoe.peach, in: Capsule())
                    .foregroundStyle(Zoe.deep)
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .background(
            LinearGradient(colors: [Zoe.peach.opacity(0.16), Zoe.peach.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 24, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Zoe.peach.opacity(0.25)))
        .task { card = InviteCard.render() }
    }

    private func message(day: Int) -> String {
        let opening = day >= 1
            ? "I'm on Day \(day) of 30 Days on the Mount"
            : "I'm starting 30 Days on the Mount"
        return "\(opening): a month walking through Jesus' Sermon on the Mount, one short invitation each morning. Walk it with me?"
    }
}

/// The image that travels with an invitation.
private enum InviteCard {
    @MainActor
    static func render() -> Image? {
        let card = VStack(spacing: 30) {
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 520)
                .foregroundStyle(.white)
            Text("Walk the Sermon on the Mount with me")
                .font(.system(size: 50, design: .serif).italic())
                .foregroundStyle(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .frame(width: 820)
            Text("30 Days on the Mount")
                .font(.custom(ZoeType.displayFamily, size: 84))
                .foregroundStyle(Zoe.peach)
            Text("Matthew 5–7 · one morning at a time")
                .font(.system(size: 28, weight: .medium))
                .tracking(5)
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
