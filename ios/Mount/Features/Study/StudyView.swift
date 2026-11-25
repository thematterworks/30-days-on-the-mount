import SwiftUI

/// What to study: the verses chosen in the Bible.
struct StudyRequest: Identifiable, Hashable {
    let reference: String
    let text: String
    var id: String { reference }
}

/// A study of the chosen verses — the passage, its setting, the words
/// behind the English, where else scripture speaks to it, and how it shows
/// the Gospel of the Kingdom. Meant to teach a way of reading, so it's laid
/// out the way a careful reader works: slowly, one layer at a time.
struct StudyView: View {
    let request: StudyRequest

    @Environment(AppModel.self) private var model
    @State private var study: ScriptureStudy?
    @State private var problem: String?
    /// Still being written: sections appear as they're ready.
    @State private var isWriting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Study").zoeLabelStyle(Zoe.peach)
                        Spacer()
                        if let study, !isWriting { ListenButton(text: spoken(study), id: "study-\(request.reference)", compact: true) }
                    }
                    Text(request.reference).font(.zoeDisplay(38))
                    Text("\u{201C}\(request.text)\u{201D}")
                        .font(.zoeSerif(.body).italic())
                        .foregroundStyle(Zoe.ink.opacity(0.85))
                        .lineSpacing(5)
                }

                if let study {
                    if !study.summary.isEmpty { section("The passage") { prose(study.summary) } }
                    if !study.context.isEmpty { section("Context") { prose(study.context) } }
                    if !study.words.isEmpty {
                        section("The words") {
                            VStack(alignment: .leading, spacing: 18) {
                                ForEach(study.words, id: \.self) { word in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                                            Text(word.word.capitalized).font(.zoeSerif(.headline))
                                            Text(word.original).font(.system(.headline, design: .serif)).foregroundStyle(Zoe.peach)
                                            Text(word.transliteration).font(.zoeSerif(.subheadline).italic()).foregroundStyle(Zoe.inkMuted)
                                        }
                                        prose(word.meaning)
                                    }
                                }
                            }
                        }
                    }
                    if !study.connections.isEmpty {
                        section("Across scripture") {
                            VStack(alignment: .leading, spacing: 14) {
                                ForEach(study.connections, id: \.self) { link in
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(link.reference).font(.zoeSerif(.headline)).foregroundStyle(Zoe.peach)
                                        prose(link.note)
                                    }
                                }
                            }
                        }
                    }
                    if !study.kingdom.isEmpty {
                        section("The Kingdom") {
                            prose(study.kingdom)
                                .padding(16)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Zoe.peach.opacity(0.1), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    }
                    if !study.question.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("To carry with you").zoeLabelStyle()
                            Text(study.question).font(.zoeSerif(.title3).italic()).lineSpacing(4)
                        }
                    }
                    if isWriting {
                        HStack(spacing: 10) {
                            ProgressView().controlSize(.small).tint(Zoe.peach)
                            Text("Still writing…").font(.zoeSerif(.subheadline).italic()).foregroundStyle(Zoe.inkMuted)
                        }
                    }
                    Color.clear.frame(height: 24)
                } else if let problem {
                    VStack(spacing: 14) {
                        Text(problem).foregroundStyle(Zoe.inkMuted).multilineTextAlignment(.center)
                        Button("Try again") { Task { await load() } }.foregroundStyle(Zoe.peach)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                } else {
                    VStack(spacing: 14) {
                        ProgressView().tint(Zoe.peach)
                        Text("Opening the passage…").font(.zoeSerif(.body).italic()).foregroundStyle(Zoe.inkMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                }
            }
            .padding(.horizontal, 26)
            .padding(.top, 28)
        }
        .scrollIndicators(.hidden)
        .task { await load() }
        .onDisappear {
            if model.audio.speakingID == "study-\(request.reference)" { model.audio.stopSpeaking() }
        }
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.35) }
    }

    private func load() async {
        problem = nil
        isWriting = true
        defer { isWriting = false }
        do {
            for try await partial in model.study.studyStream(reference: request.reference, text: request.text) {
                withAnimation(.easeOut(duration: 0.25)) { study = partial }
            }
        } catch {
            if study == nil { problem = "The study couldn't be opened just now." }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).zoeLabelStyle()
            content()
        }
    }

    /// Body text; the study may use *emphasis*.
    private func prose(_ text: String) -> some View {
        Text(LocalizedStringKey(text))
            .font(.zoeSerif(.body))
            .foregroundStyle(Zoe.ink.opacity(0.92))
            .lineSpacing(6)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func spoken(_ study: ScriptureStudy) -> String {
        ([request.reference, study.summary, study.context]
            + study.words.map { "\($0.word): \($0.meaning)" }
            + [study.kingdom, study.question])
            .joined(separator: "\n\n")
            .replacingOccurrences(of: "*", with: "")
    }
}
