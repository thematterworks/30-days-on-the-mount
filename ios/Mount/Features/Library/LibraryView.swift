import SwiftUI

struct LibraryVoice: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let author: String
    let quote: String
    let context: String
}

struct LibraryItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let author: String
    let summary: String
    let url: URL
    let minutes: Int?
}

struct LibraryContent: Codable, Sendable {
    let voices: [LibraryVoice]
    let teachings: [LibraryItem]
    let readings: [LibraryItem]

    /// Bundled now; served from the hub backend once it exists, so new
    /// teachings and readings arrive without an app release.
    static func bundled() -> LibraryContent {
        guard let url = Bundle.main.url(forResource: "Library", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let content = try? JSONDecoder().decode(LibraryContent.self, from: data) else {
            return LibraryContent(voices: [], teachings: [], readings: [])
        }
        return content
    }
}

/// The library: voices on the Sermon, teachings, and readings from those who
/// have walked this way before. Set like the layouts — type on the gradient,
/// no cards.
struct LibraryView: View {
    @State private var content = LibraryContent.bundled()
    @State private var voice: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 44) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Library").font(.zoeDisplay(56)).foregroundStyle(Zoe.ink)
                    Text("Voices, teachings and readings for the way.")
                        .font(.zoeSerif(.body).italic())
                        .foregroundStyle(Zoe.inkMuted)
                }
                .padding(.horizontal, 28)
                .padding(.top, 12)

                voices
                shelf("Teachings", systemImage: "play.circle", items: content.teachings,
                      empty: "Teachings from pastors and theologians on the Sermon are being gathered. They will appear here.")
                shelf("Readings", systemImage: "text.book.closed", items: content.readings,
                      empty: "Articles and longer readings will gather here as the library grows.")
            }
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .softScrollEdges()
        .safeAreaInset(edge: .top, spacing: 0) { HubHeader() }
    }

    private var voices: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Voices on the Sermon").zoeLabelStyle(Zoe.peach).padding(.horizontal, 28)
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(content.voices) { voice in
                        VStack(alignment: .leading, spacing: 20) {
                            Text("\u{201C}\(voice.quote)\u{201D}")
                                .font(.zoeSerif(.title3).italic())
                                .foregroundStyle(Zoe.ink)
                                .lineSpacing(6)
                            Text("— \(voice.author)").font(.zoeSerif(.headline)).foregroundStyle(Zoe.peach)
                            Text(voice.context)
                                .font(.footnote)
                                .foregroundStyle(Zoe.inkMuted)
                                .lineSpacing(3)
                        }
                        .padding(.horizontal, 28)
                        .frame(maxHeight: .infinity, alignment: .top)
                        .containerRelativeFrame(.horizontal)
                        .scrollTransition(.interactive, axis: .horizontal) { content, phase in
                            content.opacity(phase.isIdentity ? 1 : 0.15)
                        }
                        .id(voice.id)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $voice)
            .scrollIndicators(.hidden)

            HStack(spacing: 7) {
                ForEach(content.voices) { item in
                    Capsule()
                        .fill(item.id == (voice ?? content.voices.first?.id) ? Zoe.peach : Zoe.locked)
                        .frame(width: item.id == (voice ?? content.voices.first?.id) ? 18 : 6, height: 6)
                }
            }
            .animation(.smooth, value: voice)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
        }
    }

    private func shelf(_ title: String, systemImage: String, items: [LibraryItem], empty: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Label(title, systemImage: systemImage).zoeLabelStyle(Zoe.peach)
            if items.isEmpty {
                Text(empty)
                    .font(.zoeSerif(.body))
                    .foregroundStyle(Zoe.inkMuted)
                    .lineSpacing(4)
            } else {
                ForEach(items) { item in
                    Link(destination: item.url) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.title).font(.zoeSerif(.title3)).foregroundStyle(Zoe.ink)
                            Text([item.author, item.minutes.map { "\($0) min" }].compactMap { $0 }.joined(separator: " · "))
                                .zoeLabelStyle()
                            Text(item.summary).font(.footnote).foregroundStyle(Zoe.inkMuted).lineLimit(3)
                        }
                    }
                    Rectangle().fill(Zoe.locked).frame(height: 0.5)
                }
            }
        }
        .padding(.horizontal, 28)
    }
}
