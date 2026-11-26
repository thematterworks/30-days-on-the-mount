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
    @State private var voiceContext: VoiceContext?
    @State private var studying: StudyRequest?

    var body: some View {
        let bible = model.bible
        // The header has a row of its own: attached to the scroll view, its
        // buttons took several taps to answer.
        VStack(spacing: 0) {
            header
            reader(bible)
        }
        .sheet(isPresented: $isPickingBook) { BookPicker() }
        .sheet(item: $voiceContext) { context in
            TalkView(context: context).presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isSearching) { BibleSearch() }
        .sheet(item: $studying) { request in StudyView(request: request) }
        #if DEBUG
        // `-previewStudy`: opens the study of Matthew 5:3, for screenshots.
        .task {
            guard ProcessInfo.processInfo.arguments.contains("-previewStudy") else { return }
            try? await Task.sleep(for: .seconds(1.5))
            studying = StudyRequest(reference: "Matthew 5:3", text: "Blessed are the poor in spirit, for theirs is the kingdom of heaven.")
        }
        #endif
    }

    private func reader(_ bible: BibleStore) -> some View {
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
                .readableWidth()
                .padding(.bottom, selection.isEmpty ? 60 : 140)
            }
            .scrollIndicators(.hidden)
            .softScrollEdges()
            .overlay(alignment: .bottom) {
                if !selection.isEmpty {
                    SelectionBar(
                        label: bible.label(for: selection),
                        isHighlighted: selection.isSubset(of: bible.highlights),
                        highlight: { bible.toggleHighlight(selection); selection = [] },
                        copy: copySelection,
                        ask: askAboutSelection,
                        askInWriting: writeAboutSelection,
                        study: studySelection,
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

            if model.voiceAvailable { listenButton }

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

    /// The chapter read aloud, from the header: play, and stop.
    private var listenButton: some View {
        let audio = model.audio
        let id = "bible-\(model.bible.title)"
        let isThis = audio.speakingID == id
        return Button {
            audio.toggleSpeaking(chapterText, id: id)
        } label: {
            Group {
                if isThis && audio.isPreparingSpeech {
                    ProgressView().controlSize(.small).tint(Zoe.ink)
                } else {
                    Image(systemName: isThis ? "stop.fill" : "play.fill")
                        .font(.footnote)
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .foregroundStyle(isThis ? Zoe.peach : Zoe.ink)
            .frame(width: 36, height: 36)
            .zoeGlass(in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isThis ? "Stop reading" : "Listen to this chapter")
    }

    private var chapterHeading: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(model.bible.currentBook?.name ?? "").zoeLabelStyle(Zoe.peach)
            HStack(alignment: .lastTextBaseline) {
                Text("\(model.bible.location.chapter)")
                    .font(.zoeDisplay(72))
                    .foregroundStyle(Zoe.ink)
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

    /// Ask is a conversation with your companion about the chosen verses, out loud,
    /// when the server can make the call; otherwise it's written.
    private func askAboutSelection() {
        guard model.voiceChatAvailable, let book = model.bible.currentBook else { return writeAboutSelection() }
        voiceContext = .bible(
            book: book.name,
            chapter: model.bible.location.chapter,
            verses: selection.sorted().map(\.verse),
            label: model.bible.label(for: selection),
            text: selectedText
        )
        selection = []
    }

    private func studySelection() {
        studying = StudyRequest(reference: model.bible.label(for: selection), text: selectedText)
        selection = []
    }

    private func writeAboutSelection() {
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
    let askInWriting: () -> Void
    let study: () -> Void
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
            HStack(spacing: 8) {
                action(isHighlighted ? "Unmark" : "Highlight", "highlighter", highlight)
                action("Copy", "doc.on.doc", copy)
                action("Study", "text.magnifyingglass", study)
                action("Ask", "waveform", ask, prominent: true)
                    .contextMenu {
                        Button("Ask in writing", systemImage: "text.bubble", action: askInWriting)
                    }
            }
        }
        .padding(16)
        .zoeGlass(in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func action(_ title: String, _ icon: String, _ perform: @escaping () -> Void, prominent: Bool = false) -> some View {
        Button(action: perform) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.callout)
                Text(title).font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(prominent ? Zoe.peach : Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(prominent ? Zoe.navy : Zoe.ink)
        }
        .buttonStyle(.plain)
    }
}
