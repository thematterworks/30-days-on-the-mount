import SwiftUI
import UIKit

/// The Bible, read the way the rest of the app reads: serif text on the brand
/// gradient, generous leading, nothing between the reader and the words.
/// Tapping verses selects them; a quiet bar then offers Highlight, Copy, and
/// Ask — which carries the passage into the companion conversation.
struct BibleView: View {
    @Environment(AppModel.self) private var model
    @State private var selection: Set<VerseID> = []
    @State private var isPickingBook = false
    @State private var isSearching = false
    @State private var flash: VerseID?

    var body: some View {
        let bible = model.bible
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    chapterHeading
                        .id(Self.chapterTop)
                    if let error = bible.loadError {
                        Text(error).foregroundStyle(Zoe.peach).padding(.top, 40)
                    }
                    LazyVStack(alignment: .leading, spacing: 14 * model.settings.readingScale) {
                        ForEach(bible.verses) { verse in
                            VerseRow(
                                verse: verse,
                                scale: model.settings.readingScale,
                                isSelected: selection.contains(verse.id),
                                isHighlighted: bible.highlights.contains(verse.id),
                                isFlashing: flash == verse.id
                            ) {
                                toggle(verse.id)
                            }
                            .id(verse.id)
                        }
                    }
                    .padding(.top, 28)
                    chapterNavigation
                }
                .padding(.horizontal, 28)
                .padding(.bottom, selection.isEmpty ? 60 : 140)
            }
            .scrollIndicators(.hidden)
            .softScrollEdges()
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .overlay(alignment: .bottom) {
                if !selection.isEmpty {
                    SelectionBar(
                        label: bible.label(for: selection),
                        isHighlighted: selection.isSubset(of: bible.highlights),
                        highlight: { bible.toggleHighlight(selection); selection = [] },
                        copy: copySelection,
                        ask: askAboutSelection,
                        clear: { selection = [] }
                    )
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.smooth(duration: 0.3), value: selection.isEmpty)
            .sensoryFeedback(.selection, trigger: selection)
            .task { await bible.load() }
            .onChange(of: bible.verses) { _, _ in
                selection = []
                if model.audio.speakingID?.hasPrefix("bible-") == true { model.audio.stopSpeaking() }
                guard let focus = bible.focusVerse else {
                    // The heading, not the first verse — "Matthew / 5" is
                    // where a chapter begins.
                    proxy.scrollTo(Self.chapterTop, anchor: .top)
                    return
                }
                withAnimation { proxy.scrollTo(focus, anchor: .center) }
                flash = focus
                bible.focusVerse = nil
                Task {
                    try? await Task.sleep(for: .seconds(2))
                    withAnimation(.easeOut(duration: 0.8)) { flash = nil }
                }
            }
        }
        .sheet(isPresented: $isPickingBook) { BookPicker() }
        .sheet(isPresented: $isSearching) { BibleSearch() }
    }

    private static let chapterTop = "chapter-top"

    private var header: some View {
        HStack(spacing: 12) {
            Button { isPickingBook = true } label: {
                HStack(spacing: 6) {
                    Text(model.bible.title).font(.zoeSerif(.headline))
                    Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                }
                .foregroundStyle(Zoe.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .zoeGlass(in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Choose a book and chapter")

            Spacer()

            SoundToggle()

            Button { isSearching = true } label: {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(Zoe.ink)
                    .frame(width: 36, height: 36)
                    .zoeGlass(in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search the Bible")

            AvatarButton()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 6)
    }

    private var chapterHeading: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.bible.currentBook?.name ?? "").zoeLabelStyle(Zoe.peach)
            HStack(alignment: .lastTextBaseline) {
                Text("\(model.bible.location.chapter)")
                    .font(.zoeDisplay(72))
                    .foregroundStyle(Zoe.ink)
                Spacer()
                ListenButton(text: chapterText, id: "bible-\(model.bible.title)", label: "Listen")
            }
        }
        .padding(.top, 24)
        .accessibilityElement(children: .contain)
    }

    /// The chapter as it should sound: the heading, then each verse, with
    /// no verse numbers read out.
    private var chapterText: String {
        "\(model.bible.title). " + model.bible.verses.map(\.text).joined(separator: " ")
    }

    private var chapterNavigation: some View {
        HStack {
            if let previous = model.bible.previous {
                chapterButton("Previous", systemImage: "chevron.left", ref: previous)
            }
            Spacer()
            if let next = model.bible.next {
                chapterButton("Next", systemImage: "chevron.right", ref: next, trailingIcon: true)
            }
        }
        .padding(.top, 48)
    }

    private func chapterButton(_ title: String, systemImage: String, ref: ChapterRef, trailingIcon: Bool = false) -> some View {
        Button {
            Task { await model.bible.open(ref) }
        } label: {
            HStack(spacing: 6) {
                if !trailingIcon { Image(systemName: systemImage) }
                Text(title)
                if trailingIcon { Image(systemName: systemImage) }
            }
            .zoeLabelStyle(Zoe.ink)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .zoeGlass(in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func toggle(_ id: VerseID) {
        if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
    }

    private var selectedText: String {
        model.bible.verses.filter { selection.contains($0.id) }.map(\.text).joined(separator: " ")
    }

    private func copySelection() {
        UIPasteboard.general.string = "“\(selectedText)” — \(model.bible.label(for: selection)) (BSB)"
        selection = []
    }

    private func askAboutSelection() {
        let label = model.bible.label(for: selection)
        let text = selectedText
        selection = []
        model.askCompanion(about: text, label: label)
    }
}

private struct VerseRow: View {
    let verse: BibleVerse
    let scale: Double
    let isSelected: Bool
    let isHighlighted: Bool
    let isFlashing: Bool
    let onTap: () -> Void

    var body: some View {
        (Text("\(verse.number)  ")
            .font(.system(size: 11 * scale, weight: .semibold))
            .baselineOffset(5 * scale)
            .foregroundStyle(Zoe.peach)
         + Text(verse.text)
            .font(.system(size: 19 * scale, design: .serif))
            .foregroundStyle(Zoe.ink.opacity(0.94)))
            .lineSpacing(7 * scale)
            .padding(.vertical, 2)
            .padding(.horizontal, 6)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Zoe.peach.opacity(isFlashing ? 0.3 : isHighlighted ? 0.16 : 0))
            }
            .overlay(alignment: .leading) {
                if isSelected {
                    Capsule().fill(Zoe.peach).frame(width: 2.5).offset(x: -10)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Verse \(verse.number). \(verse.text)")
            .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
            .animation(.easeOut(duration: 0.2), value: isSelected)
    }
}

private struct SelectionBar: View {
    let label: String
    let isHighlighted: Bool
    let highlight: () -> Void
    let copy: () -> Void
    let ask: () -> Void
    let clear: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text(label).zoeLabelStyle(Zoe.peach)
                Spacer()
                Button(action: clear) { Image(systemName: "xmark").font(.caption.weight(.semibold)) }
                    .foregroundStyle(Zoe.inkMuted)
                    .accessibilityLabel("Clear selection")
            }
            HStack(spacing: 10) {
                action(isHighlighted ? "Unmark" : "Highlight", "highlighter", highlight)
                action("Copy", "doc.on.doc", copy)
                action("Ask", "text.bubble", ask, prominent: true)
            }
        }
        .padding(16)
        .zoeGlass(in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func action(_ title: String, _ icon: String, _ perform: @escaping () -> Void, prominent: Bool = false) -> some View {
        Button(action: perform) {
            Label(title, systemImage: icon)
                .font(.footnote.weight(.medium))
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(prominent ? Zoe.peach : Zoe.ink.opacity(0.08), in: Capsule())
                .foregroundStyle(prominent ? Zoe.navy : Zoe.ink)
        }
        .buttonStyle(.plain)
    }
}
