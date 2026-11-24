import Foundation
import Observation
import OSLog

@MainActor
@Observable
final class CompanionStore {
    private(set) var messages: [CompanionMessage] = []
    private(set) var isSending = false
    private(set) var lastError: String?

    private let service: any CompanionService
    private static let historyKey = "companion.history.v1"

    init(service: any CompanionService) {
        self.service = service
        messages = SharedStore.defaults.data(forKey: Self.historyKey)
            .flatMap { try? JSONDecoder().decode([CompanionMessage].self, from: $0) } ?? []
    }

    func refresh() async {
        do {
            let remote = try await service.history()
            guard !remote.isEmpty else { return }
            // The server's thread is the record. What the device added since
            // its last message (a reflection carried over from a day) stays
            // until the next exchange reaches the server.
            let lastRemote = remote.map(\.sentAt).max() ?? .distantPast
            let remoteIDs = Set(remote.map(\.id))
            messages = remote + messages.filter { !remoteIDs.contains($0.id) && $0.sentAt > lastRemote }
            persist()
        } catch {
            Logger.app.error("Companion history failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func send(_ text: String, dayNumber: Int) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }
        messages.append(CompanionMessage(author: .participant, text: trimmed, dayNumber: dayNumber))
        persist()
        isSending = true
        lastError = nil
        defer { isSending = false }
        do {
            let reply = try await service.send(trimmed, dayNumber: dayNumber)
            messages.append(reply)
            persist()
        } catch {
            lastError = "Your message is saved, but the companion couldn't answer just now."
        }
    }

    func inspect(reflection: String, dayNumber: Int) async throws -> String {
        try await service.inspect(reflection: reflection, dayNumber: dayNumber)
    }

    /// Carries a reflection and the Curious Inspector's question into the
    /// conversation, so "keep talking" continues from where the day left off
    /// rather than starting cold.
    func carryOver(reflection: String, question: String, dayNumber: Int) {
        messages.append(CompanionMessage(author: .participant, text: reflection, dayNumber: dayNumber))
        messages.append(CompanionMessage(author: .companion, text: question, dayNumber: dayNumber))
        persist()
    }

    func clearLocalData() {
        messages = []
        SharedStore.defaults.removeObject(forKey: Self.historyKey)
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(messages) {
            SharedStore.defaults.set(data, forKey: Self.historyKey)
        }
    }
}
