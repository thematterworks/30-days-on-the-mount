import Combine
import ElevenLabs
import Foundation
import Observation
import OSLog

/// A spoken conversation with Qara, the ElevenLabs agent. One at a time: the
/// companion's Talk and the Bible's Ask both open one here, each telling
/// Qara where the participant is through the agent's dynamic variables
/// ({{bookName}}, {{chapter}}, {{activeWord}} and the rest).
///
/// The music rests while they talk, and what was said joins the companion
/// history when the call ends, so speaking and writing are one conversation.
@MainActor
@Observable
final class QaraVoice {
    enum Phase: Equatable {
        case idle, connecting, listening, thinking, speaking, ended
        case failed(String)

        var isLive: Bool { [.listening, .thinking, .speaking].contains(self) }
    }

    struct Line: Identifiable, Equatable {
        let id: String
        let fromQara: Bool
        let text: String
    }

    private(set) var phase: Phase = .idle
    private(set) var lines: [Line] = []
    private(set) var isMuted = false

    private let service: any VoiceService
    private let audio: AudioDirector
    @ObservationIgnored private var conversation: Conversation?
    @ObservationIgnored private var subscriptions: Set<AnyCancellable> = []

    init(service: any VoiceService, audio: AudioDirector) {
        self.service = service
        self.audio = audio
    }

    /// Opens a conversation. `variables` are where the participant is; the
    /// server adds who they are.
    func start(variables: [String: String]) async {
        guard phase == .idle || phase == .ended || isFailed else { return }
        phase = .connecting
        lines = []
        isMuted = false
        audio.pauseForRecording()
        do {
            let session = try await service.session(variables: variables)
            let token = session.token
            let conversation = try await ElevenLabs.startConversation(
                tokenProvider: { token },
                config: ConversationConfig(dynamicVariables: session.variables)
            )
            self.conversation = conversation
            observe(conversation)
        } catch {
            Logger.app.error("Qara couldn't start: \(error.localizedDescription, privacy: .public)")
            phase = .failed("Qara can't talk right now. Check your connection and try again.")
            audio.resumeAfterRecording()
        }
    }

    /// Ends the call and keeps what was said.
    func end() async {
        guard let conversation else {
            if phase != .idle { phase = .ended }
            return
        }
        self.conversation = nil
        subscriptions.removeAll()
        await conversation.endConversation()
        phase = .ended
        audio.resumeAfterRecording()

        let transcript = lines.map { (role: $0.fromQara ? "agent" : "user", text: $0.text) }
        guard !transcript.isEmpty else { return }
        do {
            try await service.save(transcript: transcript)
        } catch {
            Logger.app.error("Voice transcript didn't save: \(error.localizedDescription, privacy: .public)")
        }
    }

    func toggleMute() async {
        guard let conversation else { return }
        try? await conversation.setMuted(!isMuted)
    }

    /// Tells Qara the participant has moved on — another chapter, another
    /// word — without restarting the conversation.
    func update(context: String) async {
        guard let conversation, phase.isLive else { return }
        try? await conversation.updateContext(context)
    }

    func reset() {
        if conversation == nil { phase = .idle }
    }

    private var isFailed: Bool {
        if case .failed = phase { return true }
        return false
    }

    private func observe(_ conversation: Conversation) {
        conversation.$state
            .combineLatest(conversation.$agentState)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state, agentState in
                MainActor.assumeIsolated { self?.apply(state: state, agentState: agentState) }
            }
            .store(in: &subscriptions)
        conversation.$messages
            .receive(on: DispatchQueue.main)
            .sink { [weak self] messages in
                MainActor.assumeIsolated {
                    self?.lines = messages
                        .filter { !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                        .map { Line(id: $0.id, fromQara: $0.role == .agent, text: $0.content) }
                }
            }
            .store(in: &subscriptions)
        conversation.$isMuted
            .receive(on: DispatchQueue.main)
            .sink { [weak self] muted in MainActor.assumeIsolated { self?.isMuted = muted } }
            .store(in: &subscriptions)
    }

    private func apply(state: ConversationState, agentState: ElevenLabs.AgentState) {
        switch state {
        case .idle, .connecting:
            phase = .connecting
        case .active:
            phase = switch agentState {
            case .listening: .listening
            case .thinking: .thinking
            case .speaking: .speaking
            }
        case .ended:
            // Qara or the network ended it; keep what was said.
            if conversation != nil { Task { await end() } }
        case .error(let error):
            Logger.app.error("Qara conversation error: \(error.localizedDescription, privacy: .public)")
            phase = .failed("The conversation dropped. You can start again.")
            conversation = nil
            subscriptions.removeAll()
            audio.resumeAfterRecording()
        }
    }
}
