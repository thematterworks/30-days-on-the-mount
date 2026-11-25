import SwiftUI

/// Search by words or by reference. "John 3:16" or "jn 3" jumps straight to
/// the passage; anything else searches the full text of the BSB.
struct BibleSearch: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var hits: [SearchHit] = []
    @State private var isSearching = false
    @State private var expandedBook: Int?
    @FocusState private var focused: Bool

    var body: some View {
        let reference = model.bible.reference(for: query)
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(Zoe.inkMuted)
                TextField("Words, a book, or John 3:16", text: $query)
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                    .onSubmit {
                        if let reference { go(to: reference) }
                    }
                // Say it instead: "the Lord is my shepherd", "Romans eight".
                MicButton(field: "bible-search", text: $query, size: 30)
            }
            .padding(.leading, 14)
            .padding(.trailing, 8)
            .padding(.vertical, 8)
            .background(Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(20)

            if query.trimmingCharacters(in: .whitespaces).isEmpty {
                // Nothing typed yet: every book, to choose from.
                BookPicker()
            } else {
                results(reference: reference)
            }
        }
        .task(id: query) {
            // Debounced: search once typing pauses.
            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled else { return }
            isSearching = true
            hits = query.count < 2 ? [] : await model.bible.search(query)
            isSearching = false
        }
        .onAppear { focused = true }
        .onDisappear { model.dictation.stop() }
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }

    /// Books whose names match what's typed — "joh" finds John and 1–3 John.
    private var matchingBooks: [BibleBook] {
        let typed = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard typed.count >= 2, typed.rangeOfCharacter(from: .decimalDigits.inverted) != nil else { return [] }
        return model.bible.books.filter { book in
            let name = book.name.lowercased()
            return name.hasPrefix(typed) || name.split(separator: " ").contains { $0.hasPrefix(typed) }
        }
    }

    @ViewBuilder
    private func results(reference: ScriptureReference.Parsed?) -> some View {
            List {
                if let reference, let book = model.bible.books.first(where: { $0.id == reference.book }) {
                    Button {
                        go(to: reference)
                    } label: {
                        Label("Go to \(book.name) \(reference.chapter)\(reference.verse.map { ":\($0)" } ?? "")", systemImage: "arrow.right.circle")
                            .font(.zoeSerif(.headline))
                            .foregroundStyle(Zoe.peach)
                    }
                    .listRowBackground(Color.clear)
                }
                ForEach(matchingBooks) { book in
                    bookRow(book)
                        .listRowBackground(Color.clear)
                }
                ForEach(hits) { hit in
                    Button {
                        Task { await model.bible.open(ChapterRef(book: hit.verse.book, chapter: hit.verse.chapter), focus: hit.verse.number) }
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("\(hit.bookName) \(hit.verse.chapter):\(hit.verse.number)").zoeLabelStyle(Zoe.peach)
                            Text(hit.verse.text)
                                .font(.zoeSerif(.body))
                                .foregroundStyle(Zoe.ink.opacity(0.9))
                                .lineLimit(3)
                        }
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(Color.clear)
                }
                if !query.isEmpty, hits.isEmpty, matchingBooks.isEmpty, reference == nil, !isSearching {
                    Text("Nothing found for “\(query)”.")
                        .foregroundStyle(Zoe.inkMuted)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
    }

    /// A book, and its chapters when tapped.
    private func bookRow(_ book: BibleBook) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.smooth(duration: 0.3)) { expandedBook = expandedBook == book.id ? nil : book.id }
            } label: {
                HStack {
                    Label(book.name, systemImage: "book.closed").font(.zoeSerif(.headline))
                    Spacer()
                    Image(systemName: expandedBook == book.id ? "chevron.up" : "chevron.down").font(.caption)
                }
                .foregroundStyle(Zoe.ink)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if expandedBook == book.id {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 6), spacing: 10) {
                    ForEach(1...max(book.chapters, 1), id: \.self) { chapter in
                        Button {
                            Task { await model.bible.open(ChapterRef(book: book.id, chapter: chapter)) }
                            dismiss()
                        } label: {
                            Text("\(chapter)")
                                .font(.system(.callout, design: .serif))
                                .frame(maxWidth: .infinity, minHeight: 38)
                                .background(Zoe.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .foregroundStyle(Zoe.ink)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }

    private func go(to reference: ScriptureReference.Parsed) {
        Task { await model.bible.open(ChapterRef(book: reference.book, chapter: reference.chapter), focus: reference.verse) }
        dismiss()
    }
}
