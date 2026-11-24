import SwiftUI

/// Search by words or by reference. "John 3:16" or "jn 3" jumps straight to
/// the passage; anything else searches the full text of the BSB.
struct BibleSearch: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var hits: [SearchHit] = []
    @State private var isSearching = false
    @FocusState private var focused: Bool

    var body: some View {
        let reference = model.bible.reference(for: query)
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(Zoe.inkMuted)
                TextField("Words, or a reference like John 3:16", text: $query)
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                    .onSubmit {
                        if let reference { go(to: reference) }
                    }
            }
            .padding(14)
            .background(Zoe.ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(20)

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
                if !query.isEmpty, hits.isEmpty, reference == nil, !isSearching {
                    Text("Nothing found for “\(query)”.")
                        .foregroundStyle(Zoe.inkMuted)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
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
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }

    private func go(to reference: ScriptureReference.Parsed) {
        Task { await model.bible.open(ChapterRef(book: reference.book, chapter: reference.chapter), focus: reference.verse) }
        dismiss()
    }
}
