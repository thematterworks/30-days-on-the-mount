import Foundation

/// One day of the journey: the content the guided story renders. Field for
/// field the iOS shape of the web's GuidedStoryDay, plus `practiceTitle`,
/// which every day's curriculum carries as its "Key Practice".
struct JourneyDay: Codable, Identifiable, Hashable, Sendable {
    let dayNumber: Int
    let title: String
    let hookText: String
    let scriptureReference: String
    let scriptureText: String
    let exegesisText: String
    let practiceTitle: String
    /// Hand-authored closing words. Nil for days that only have the base
    /// curriculum, where the Surrender screen falls back to the practice.
    let surrenderText: String?
    let teachingVideoURL: URL?
    let scriptureAudioURL: URL?
    let mediaURL: URL?
    /// The evening check-in question. Comes from the server; the bundled
    /// curriculum doesn't carry it.
    var eveningPrompt: String? = nil
    /// The morning invitation's question, under the day's title in the
    /// journey. From the server, for days that are open.
    var morningQuestion: String? = nil
    /// The threshold before the day's story: a short headline and one
    /// gentle line inviting the reader to be present with God.
    var thresholdTitle: String? = nil
    var thresholdLine: String? = nil

    var id: Int { dayNumber }

    var exegesisParagraphs: [String] {
        exegesisText.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
}
