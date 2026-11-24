import SwiftUI

/// Books in canonical order, split by testament; choosing a book reveals its
/// chapters as a quiet grid of numbers.
struct BookPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var testament: BibleBook.Testament = .new
    @State private var expanded: Int?

    var body: some View {
        let books = model.bible.books.filter { $0.testament == testament }
        VStack(spacing: 0) {
            Picker("Testament", selection: $testament) {
                Text("Old Testament").tag(BibleBook.Testament.old)
                Text("New Testament").tag(BibleBook.Testament.new)
            }
            .pickerStyle(.segmented)
            .padding(20)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(books) { book in
                            Button {
                                withAnimation(.smooth(duration: 0.35)) { expanded = expanded == book.id ? nil : book.id }
                            } label: {
                                HStack {
                                    Text(book.name).font(.zoeSerif(.title3))
                                    Spacer()
                                    if book.id == model.bible.location.book {
                                        Circle().fill(Zoe.peach).frame(width: 6, height: 6)
                                    }
                                }
                                .foregroundStyle(Zoe.ink)
                                .padding(.vertical, 14)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .id(book.id)

                            if expanded == book.id {
                                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 6), spacing: 10) {
                                    ForEach(1...max(book.chapters, 1), id: \.self) { chapter in
                                        let isCurrent = book.id == model.bible.location.book && chapter == model.bible.location.chapter
                                        Button {
                                            Task { await model.bible.open(ChapterRef(book: book.id, chapter: chapter)) }
                                            dismiss()
                                        } label: {
                                            Text("\(chapter)")
                                                .font(.system(.callout, design: .serif))
                                                .frame(maxWidth: .infinity, minHeight: 40)
                                                .background(isCurrent ? Zoe.peach : Zoe.ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                                .foregroundStyle(isCurrent ? Zoe.navy : Zoe.ink)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.bottom, 16)
                                .transition(.opacity)
                            }
                            Rectangle().fill(Zoe.locked).frame(height: 0.5)
                        }
                    }
                    .padding(.horizontal, 24)
                }
                .onAppear {
                    if let current = model.bible.currentBook {
                        testament = current.testament
                        expanded = current.id
                        proxy.scrollTo(current.id, anchor: .top)
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}
