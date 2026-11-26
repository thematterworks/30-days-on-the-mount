import StoreKit
import SwiftUI

/// Gifts that keep the journey free. Given on the website through Stripe
/// (30daysonthemount.com/give), so no app store takes a share. The app
/// links there only on the US App Store, where linking out to a web
/// payment is allowed; elsewhere it shows nothing.
enum Giving {
    static func url(from source: String) -> URL {
        URL(string: "https://www.30daysonthemount.com/give?from=\(source)")!
    }

    /// The US App Store storefront — not the device's region or language.
    static func isAvailable() async -> Bool {
        #if DEBUG
        // `-previewGiving`: show it in the simulator, which has no storefront.
        if ProcessInfo.processInfo.arguments.contains("-previewGiving") { return true }
        #endif
        return await Storefront.current?.countryCode == "USA"
    }
}

/// Profile: a quiet invitation to give, below Share the journey.
struct GiveCard: View {
    @Environment(\.openURL) private var openURL
    @State private var isAvailable = false

    var body: some View {
        // Always a view, so the storefront check runs even while hidden.
        ZStack {
            Color.clear.frame(height: 0)
            if isAvailable {
                VStack(spacing: 10) {
                    Text("Keep the mountain open").font(.zoeSerif(.title3)).foregroundStyle(Zoe.ink)
                    Text("30 Days on the Mount is free, with no ads. If these mornings have meant something to you, a gift helps keep it free for the next person who needs it.")
                        .font(.subheadline)
                        .foregroundStyle(Zoe.ink.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    Button { openURL(Giving.url(from: "profile")) } label: {
                        Label("Give a gift", systemImage: "heart")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.6)))
                            .foregroundStyle(Zoe.peach)
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
                .frame(maxWidth: .infinity)
                .background(Zoe.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            }
        }
        .task { isAvailable = await Giving.isAvailable() }
    }
}

/// The summit, after Day 30: one line, easy to pass by.
struct SummitGiveLink: View {
    @Environment(\.openURL) private var openURL
    @State private var isAvailable = false

    var body: some View {
        ZStack {
            Color.clear.frame(height: 0)
            if isAvailable {
                Button { openURL(Giving.url(from: "summit")) } label: {
                    Text("Help someone else begin: give a gift so the journey stays free for them.")
                        .font(.footnote)
                        .foregroundStyle(Zoe.peach)
                        .underline()
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(.plain)
            }
        }
        .task { isAvailable = await Giving.isAvailable() }
    }
}
