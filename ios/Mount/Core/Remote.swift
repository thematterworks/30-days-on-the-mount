import Foundation
import os

// The Remote* services: the app's seams (Services.swift) backed by the mobile
// API, app/api/mobile/* in this repository. Same protocols as the Preview*
// set, so no view knows which it is talking to.

// MARK: - Client

enum APIError: LocalizedError, Equatable {
    /// The session is missing, expired, or was signed by a rotated secret.
    case unauthorized
    /// The server said why, in words meant for the participant.
    case server(String)
    case offline

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Sign in again to continue."
        case .server(let message): message
        case .offline: "You're offline. Try again when you're connected."
        }
    }
}

/// The bearer token every Remote* service sends. SessionStore writes it;
/// services on any thread read it.
final class SessionToken: Sendable {
    private let value = OSAllocatedUnfairLock<String?>(initialState: nil)

    var current: String? { value.withLock { $0 } }
    func set(_ token: String?) { value.withLock { $0 = token } }
}

struct APIClient: Sendable {
    static let production = URL(string: "https://www.30daysonthemount.com")!

    let baseURL: URL
    let token: SessionToken
    /// Called once per 401, so the app can return to sign-in instead of
    /// failing every request quietly.
    let onUnauthorized: @Sendable () -> Void

    init(baseURL: URL = APIClient.configuredBaseURL, token: SessionToken, onUnauthorized: @escaping @Sendable () -> Void) {
        self.baseURL = baseURL
        self.token = token
        self.onUnauthorized = onUnauthorized
    }

    /// Production, unless a DEBUG build is launched with `-apiBase <url>` to
    /// point at a local `next dev`.
    static var configuredBaseURL: URL {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-apiBase"), arguments.indices.contains(index + 1),
           let url = URL(string: arguments[index + 1]) {
            return url
        }
        #endif
        return production
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let string = try decoder.singleValueContainer().decode(String.self)
            // Postgres timestamps arrive with or without fractional seconds.
            let formatter = ISO8601DateFormatter()
            for options: ISO8601DateFormatter.Options in [[.withInternetDateTime, .withFractionalSeconds], [.withInternetDateTime]] {
                formatter.formatOptions = options
                if let date = formatter.date(from: string) { return date }
            }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Unreadable date \(string)"))
        }
        return decoder
    }()

    func get<Response: Decodable>(_ path: String) async throws -> Response {
        try await send("GET", path, body: Optional<[String: String]>.none)
    }

    func send<Body: Encodable, Response: Decodable>(_ method: String, _ path: String, body: Body?) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = token.current {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError where [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(error.code) {
            throw APIError.offline
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 {
            onUnauthorized()
            throw APIError.unauthorized
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ServerError.self, from: data))?.error
            throw APIError.server(message ?? "Something went wrong. Please try again.")
        }
        return try Self.decoder.decode(Response.self, from: data)
    }

    private struct ServerError: Decodable { let error: String }
}

struct OK: Decodable { let ok: Bool }

/// The participant as the server describes them (participantPayload in
/// lib/mobile.ts).
struct RemoteParticipant: Decodable, Sendable {
    let phoneNumber: String
    let firstName: String?
    let status: String
    let currentDay: Int
    let timezone: String
    let preferredHour: Int?
    var middayInvitations: Bool?
    let features: Features?

    struct Features: Decodable, Sendable {
        /// The server can read aloud (ELEVENLABS_API_KEY is set).
        let voice: Bool
        /// Spoken conversations with your companion are available.
        var voiceChat: Bool?
    }
}

// MARK: - Sign in

struct RemoteAuthService: AuthService {
    let client: APIClient

    func requestCode(phoneNumber: String) async throws {
        let _: OK = try await client.send("POST", "api/mobile/auth/start", body: ["phoneNumber": phoneNumber])
    }

    func verify(phoneNumber: String, code: String) async throws -> Session {
        struct Response: Decodable { let token: String; let participant: RemoteParticipant }
        let response: Response = try await client.send(
            "POST", "api/mobile/auth/verify", body: ["phoneNumber": phoneNumber, "code": code]
        )
        return Session(phoneNumber: response.participant.phoneNumber, token: response.token, isPreview: false)
    }

    func options() async -> AuthOptions {
        (try? await client.get("api/mobile/auth/options")) ?? AuthOptions()
    }

    func signInWithApple(identityToken: String, firstName: String?) async throws -> Session {
        struct Body: Encodable { let identityToken: String; let firstName: String? }
        return try await session("api/mobile/auth/apple", body: Body(identityToken: identityToken, firstName: firstName))
    }

    func requestEmailCode(email: String) async throws {
        let _: OK = try await client.send("POST", "api/mobile/auth/email/start", body: ["email": email])
    }

    func verifyEmail(_ email: String, code: String) async throws -> Session {
        try await session("api/mobile/auth/email/verify", body: ["email": email, "code": code])
    }

    private struct SessionResponse: Decodable { let token: String; let participant: RemoteParticipant }

    private func session<Body: Encodable>(_ path: String, body: Body) async throws -> Session {
        let response: SessionResponse = try await client.send("POST", path, body: body)
        return Session(phoneNumber: response.participant.phoneNumber, token: response.token, isPreview: false)
    }
}

// MARK: - Companion

struct RemoteCompanionService: CompanionService {
    let client: APIClient

    private struct Message: Decodable {
        let id: UUID
        let role: CompanionMessage.Author
        let text: String
        let sentAt: Date
        /// The day the message was written in, from the daily push that
        /// opened it.
        let dayNumber: Int?

        var companionMessage: CompanionMessage {
            CompanionMessage(id: id, author: role, text: text, sentAt: sentAt, dayNumber: dayNumber)
        }
    }

    func history() async throws -> [CompanionMessage] {
        struct Response: Decodable { let messages: [Message] }
        let response: Response = try await client.get("api/mobile/companion")
        return response.messages.map(\.companionMessage)
    }

    func send(_ text: String, dayNumber: Int) async throws -> CompanionMessage {
        struct Response: Decodable { let replies: [Message] }
        let response: Response = try await client.send("POST", "api/mobile/companion", body: ["text": text])
        // The engine can answer in more than one message; the conversation
        // reads them as one reply.
        guard let first = response.replies.first else {
            throw APIError.server("The companion is quiet right now. Try again in a moment.")
        }
        let text = response.replies.map(\.text).joined(separator: "\n\n")
        return CompanionMessage(id: first.id, author: .companion, text: text, sentAt: first.sentAt, dayNumber: dayNumber)
    }

    func inspect(reflection: String, dayNumber: Int) async throws -> String {
        struct Body: Encodable { let dayNumber: Int; let reflection: String }
        struct Response: Decodable { let question: String }
        let response: Response = try await client.send(
            "POST", "api/mobile/reflect", body: Body(dayNumber: dayNumber, reflection: reflection)
        )
        return response.question
    }
}

// MARK: - Journey

/// Where the server has the participant, and its latest word on each open
/// day's content.
struct JourneyRemoteState: Sendable {
    struct Day: Decodable, Sendable {
        let dayNumber: Int
        let title: String
        let hook: String
        let scriptureReference: String
        let scriptureText: String
        let scriptureAudioURL: String?
        let teachingVideoURL: String?
        let exegesis: String
        let surrender: String
        let eveningPrompt: String?
    }

    let currentDay: Int
    let days: [Day]
}

extension JourneyDay {
    /// This day with the server's content laid over it. Empty server fields
    /// keep the bundled text rather than blanking a screen.
    /// The server's titles are written for texts ("Day 31: The Ongoing
    /// Zoe"); the app shows the day number on its own, so the title drops it.
    nonisolated static func bareTitle(_ title: String) -> String {
        let bare = title.replacing(/^\s*Day\s+\d+\s*[:·\-–—]\s*/.ignoresCase(), with: "")
        return bare.isEmpty ? title : bare
    }

    func overlaid(_ remote: JourneyRemoteState.Day) -> JourneyDay {
        func pick(_ value: String, _ fallback: String) -> String {
            value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : value
        }
        return JourneyDay(
            dayNumber: dayNumber,
            title: Self.bareTitle(pick(remote.title, title)),
            hookText: pick(remote.hook, hookText),
            scriptureReference: pick(remote.scriptureReference, scriptureReference),
            scriptureText: pick(remote.scriptureText, scriptureText),
            exegesisText: pick(remote.exegesis, exegesisText),
            practiceTitle: practiceTitle,
            surrenderText: remote.surrender.isEmpty ? surrenderText : remote.surrender,
            teachingVideoURL: remote.teachingVideoURL.flatMap(URL.init(string:)) ?? teachingVideoURL,
            scriptureAudioURL: remote.scriptureAudioURL.flatMap(URL.init(string:)) ?? scriptureAudioURL,
            mediaURL: mediaURL,
            eveningPrompt: remote.eveningPrompt.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 } ?? eveningPrompt
        )
    }
}

protocol JourneyService: Sendable {
    func fetch() async throws -> JourneyRemoteState
}

struct RemoteJourneyService: JourneyService {
    let client: APIClient

    func fetch() async throws -> JourneyRemoteState {
        struct Response: Decodable { let currentDay: Int; let days: [JourneyRemoteState.Day] }
        let response: Response = try await client.get("api/mobile/curriculum")
        return JourneyRemoteState(currentDay: response.currentDay, days: response.days)
    }
}

// MARK: - Account

protocol AccountService: Sendable {
    func participant() async throws -> RemoteParticipant?
    func updateMorningHour(_ hour: Int, timezone: String) async throws
    func updateMiddayInvitations(_ on: Bool) async throws
    func updateFirstName(_ name: String) async throws
    func registerDevice(apnsToken: String) async throws
    func unregisterDevice(apnsToken: String) async throws
    func deleteAccount() async throws
}

struct RemoteAccountService: AccountService {
    let client: APIClient

    private struct ParticipantResponse: Decodable { let participant: RemoteParticipant }

    func participant() async throws -> RemoteParticipant? {
        let response: ParticipantResponse = try await client.get("api/mobile/me")
        return response.participant
    }

    func updateMorningHour(_ hour: Int, timezone: String) async throws {
        struct Body: Encodable { let preferredHour: Int; let timezone: String }
        let _: ParticipantResponse = try await client.send(
            "PATCH", "api/mobile/me", body: Body(preferredHour: hour, timezone: timezone)
        )
    }

    func updateFirstName(_ name: String) async throws {
        let _: ParticipantResponse = try await client.send("PATCH", "api/mobile/me", body: ["firstName": name])
    }

    func updateMiddayInvitations(_ on: Bool) async throws {
        let _: ParticipantResponse = try await client.send("PATCH", "api/mobile/me", body: ["middayInvitations": on])
    }

    func registerDevice(apnsToken: String) async throws {
        let _: OK = try await client.send(
            "POST", "api/mobile/devices", body: ["apnsToken": apnsToken, "environment": Self.apnsEnvironment]
        )
    }

    func unregisterDevice(apnsToken: String) async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/devices", body: ["apnsToken": apnsToken])
    }

    func deleteAccount() async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/account", body: Optional<[String: String]>.none)
    }

    /// Debug builds are signed for the APNs sandbox; App Store and TestFlight
    /// builds for production. The server needs to know which gateway to use.
    private static var apnsEnvironment: String {
        #if DEBUG
        "development"
        #else
        "production"
        #endif
    }
}

/// Keeps everything on the device, for previews and UI tests.
struct PreviewAccountService: AccountService {
    func participant() async throws -> RemoteParticipant? { nil }
    func updateMorningHour(_ hour: Int, timezone: String) async throws {}
    func updateMiddayInvitations(_ on: Bool) async throws {}
    func updateFirstName(_ name: String) async throws {}
    func registerDevice(apnsToken: String) async throws {}
    func unregisterDevice(apnsToken: String) async throws {}
    func deleteAccount() async throws {}
}

// MARK: - Avatar

/// The profile icon as the server keeps it (app/api/mobile/avatar).
struct RemoteAvatar: Codable, Sendable {
    let kind: String
    var symbol: String?
    var tone: String?
    var photoURL: URL?
}

protocol AvatarService: Sendable {
    func avatar() async throws -> RemoteAvatar?
    /// `photo` is a JPEG, sent when `kind` is "photo".
    func save(_ avatar: RemoteAvatar, photo: Data?) async throws
}

struct RemoteAvatarService: AvatarService {
    let client: APIClient

    private struct Response: Decodable { let avatar: RemoteAvatar? }

    func avatar() async throws -> RemoteAvatar? {
        let response: Response = try await client.get("api/mobile/avatar")
        return response.avatar
    }

    func save(_ avatar: RemoteAvatar, photo: Data?) async throws {
        struct Body: Encodable { let kind: String; let symbol: String?; let tone: String?; let photo: String? }
        let _: Response = try await client.send(
            "PUT", "api/mobile/avatar",
            body: Body(kind: avatar.kind, symbol: avatar.symbol, tone: avatar.tone, photo: photo?.base64EncodedString())
        )
    }
}

struct PreviewAvatarService: AvatarService {
    func avatar() async throws -> RemoteAvatar? { nil }
    func save(_ avatar: RemoteAvatar, photo: Data?) async throws {}
}

// MARK: - Voice conversations

/// Spoken conversations with your companion (app/api/mobile/voice). The server hands
/// out a short-lived token and fills in who the participant is; the call
/// runs between the phone and ElevenLabs.
protocol VoiceService: Sendable {
    func session(variables: [String: String]) async throws -> (token: String, variables: [String: String])
    /// What was said, so it joins the companion history.
    func save(transcript: [(role: String, text: String)]) async throws
}

struct RemoteVoiceService: VoiceService {
    let client: APIClient

    func session(variables: [String: String]) async throws -> (token: String, variables: [String: String]) {
        struct Body: Encodable { let variables: [String: String] }
        struct Response: Decodable { let token: String; let variables: [String: String] }
        let response: Response = try await client.send("POST", "api/mobile/voice", body: Body(variables: variables))
        return (response.token, response.variables)
    }

    func save(transcript: [(role: String, text: String)]) async throws {
        struct Turn: Encodable { let role: String; let text: String }
        struct Body: Encodable { let transcript: [Turn] }
        let _: OK = try await client.send(
            "PUT", "api/mobile/voice", body: Body(transcript: transcript.map { Turn(role: $0.role, text: $0.text) })
        )
    }
}

struct PreviewVoiceService: VoiceService {
    func session(variables: [String: String]) async throws -> (token: String, variables: [String: String]) {
        throw APIError.server("Talking with your companion needs the live server.")
    }

    func save(transcript: [(role: String, text: String)]) async throws {}
}

// MARK: - Study

/// A study of a passage (app/api/mobile/study, lib/ai.ts).
struct ScriptureStudy: Decodable, Sendable {
    struct Word: Decodable, Sendable, Hashable {
        let word: String
        let original: String
        let transliteration: String
        let meaning: String
    }

    struct Connection: Decodable, Sendable, Hashable {
        let reference: String
        let note: String
    }

    var summary: String
    var context: String
    var words: [Word]
    var connections: [Connection]
    var kingdom: String
    var question: String

    init(summary: String, context: String, words: [Word], connections: [Connection], kingdom: String, question: String) {
        self.summary = summary
        self.context = context
        self.words = words
        self.connections = connections
        self.kingdom = kingdom
        self.question = question
    }

    private enum CodingKeys: String, CodingKey { case summary, context, words, connections, kingdom, question }

    /// Tolerant, because a study arrives as it's written: early versions
    /// have only the first sections, and the last entry of a list may be
    /// half-written (and is left out until it's whole).
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        summary = (try? container.decodeIfPresent(String.self, forKey: .summary)) ?? ""
        context = (try? container.decodeIfPresent(String.self, forKey: .context)) ?? ""
        words = ((try? container.decodeIfPresent([Lossy<Word>].self, forKey: .words)) ?? []).compactMap(\.value)
        connections = ((try? container.decodeIfPresent([Lossy<Connection>].self, forKey: .connections)) ?? []).compactMap(\.value)
        kingdom = (try? container.decodeIfPresent(String.self, forKey: .kingdom)) ?? ""
        question = (try? container.decodeIfPresent(String.self, forKey: .question)) ?? ""
    }
}

/// An element of a list that may not decode yet.
private struct Lossy<Value: Decodable & Sendable>: Decodable, Sendable {
    let value: Value?
    init(from decoder: any Decoder) throws { value = try? Value(from: decoder) }
}

protocol StudyService: Sendable {
    func study(reference: String, text: String) async throws -> ScriptureStudy
    /// The study as it's written: each element is the study so far, the
    /// last one finished.
    func studyStream(reference: String, text: String) -> AsyncThrowingStream<ScriptureStudy, any Error>
}

extension StudyService {
    func studyStream(reference: String, text: String) -> AsyncThrowingStream<ScriptureStudy, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    continuation.yield(try await study(reference: reference, text: text))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

struct RemoteStudyService: StudyService {
    let client: APIClient

    func study(reference: String, text: String) async throws -> ScriptureStudy {
        struct Response: Decodable { let study: ScriptureStudy }
        let response: Response = try await client.send(
            "POST", "api/mobile/study", body: ["reference": reference, "text": text]
        )
        return response.study
    }

    func studyStream(reference: String, text: String) -> AsyncThrowingStream<ScriptureStudy, any Error> {
        struct Line: Decodable { let study: ScriptureStudy?; let done: Bool?; let error: String? }
        let client = client
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = URLRequest(url: client.baseURL.appending(path: "api/mobile/study"))
                    request.httpMethod = "POST"
                    request.timeoutInterval = 90
                    request.setValue("application/x-ndjson", forHTTPHeaderField: "Accept")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    if let token = client.token.current { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
                    request.httpBody = try JSONEncoder().encode(["reference": reference, "text": text])
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if status == 401 { client.onUnauthorized(); throw APIError.unauthorized }
                    guard (200..<300).contains(status) else { throw APIError.server("The study couldn't be opened just now.") }
                    for try await line in bytes.lines {
                        guard let data = line.data(using: .utf8), let decoded = try? JSONDecoder().decode(Line.self, from: data) else { continue }
                        if let error = decoded.error { throw APIError.server(error) }
                        if let study = decoded.study { continuation.yield(study) }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

struct PreviewStudyService: StudyService {
    func study(reference: String, text: String) async throws -> ScriptureStudy {
        try await Task.sleep(for: .seconds(1))
        return ScriptureStudy(
            summary: "Jesus opens His sermon with a surprise: the people God calls blessed are the ones who know they have nothing to offer.",
            context: "Seeing the crowds, Jesus goes up on a mountain and sits down, as a teacher would. This is the first of the Beatitudes.",
            words: [.init(word: "poor", original: "πτωχοί", transliteration: "ptōchoi",
                          meaning: "Destitute, dependent on others to live; often used of beggars.")],
            connections: [.init(reference: "Isaiah 61:1", note: "Good news to the poor, coming true.")],
            kingdom: "The kingdom opens first to people who have stopped pretending — *is*, not will be.",
            question: "Where are you still coming to God with full hands?"
        )
    }
}

// MARK: - Together

/// A reflection or group post someone shared (lib/community.ts).
struct SharedPost: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let dayNumber: Int?
    let displayName: String?
    let text: String
    let createdAt: Date
    let mine: Bool
    /// The companion's own words — a welcome, or a nudge to a quiet group.
    var fromCompanion: Bool = false
    /// Who wrote it, opaquely: opens their member card.
    var authorID: String?
    var media: SharedMedia?

    private enum CodingKeys: String, CodingKey { case id, dayNumber, displayName, text, createdAt, mine, fromCompanion, authorID = "authorId", media }

    init(id: String, dayNumber: Int?, displayName: String?, text: String, createdAt: Date, mine: Bool, fromCompanion: Bool = false, authorID: String? = nil, media: SharedMedia? = nil) {
        self.id = id
        self.dayNumber = dayNumber
        self.displayName = displayName
        self.text = text
        self.createdAt = createdAt
        self.mine = mine
        self.fromCompanion = fromCompanion
        self.authorID = authorID
        self.media = media
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        dayNumber = try container.decodeIfPresent(Int.self, forKey: .dayNumber)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        text = try container.decode(String.self, forKey: .text)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        mine = try container.decode(Bool.self, forKey: .mine)
        fromCompanion = try container.decodeIfPresent(Bool.self, forKey: .fromCompanion) ?? false
        authorID = try container.decodeIfPresent(String.self, forKey: .authorID)
        media = try? container.decodeIfPresent(SharedMedia.self, forKey: .media)
    }
}

/// A photo, video or voice message in a group, behind a short-lived link.
struct SharedMedia: Decodable, Hashable, Sendable {
    enum Kind: String, Decodable, Sendable { case image, video, audio }
    let kind: Kind
    let url: URL
    let thumbURL: URL?
    let duration: Double?
    let width: Double?
    let height: Double?
    let transcript: String?
}

/// Where a photo, video or recording goes before the post that carries it.
struct MediaUpload: Decodable, Sendable {
    struct Target: Decodable, Sendable {
        let path: String
        let uploadURL: URL
        let contentType: String
    }
    let upload: Target
    let thumb: Target?
    let frames: Target?
}

/// What a group post's media is, once uploaded.
struct PostMediaReference: Encodable, Sendable {
    let kind: String
    let path: String
    var thumbPath: String?
    var framesPath: String?
    var duration: Double?
    var width: Double?
    var height: Double?
}

/// Someone's soft profile, seen from a shared group.
struct MemberCard: Decodable, Sendable, Identifiable {
    struct Avatar: Decodable, Sendable {
        let kind: String
        let symbol: String?
        let tone: String?
        let photoURL: URL?
    }
    let id: String
    let name: String
    let avatar: Avatar
    let currentDay: Int
    let startedOn: String?
    let about: String?
    let groupsInCommon: [String]
}

/// The participant in Community: their standing, any notice for them, and their line.
struct CommunityMe: Decodable, Sendable {
    struct Standing: Decodable, Sendable {
        let status: String
        let pausedUntil: Date?
        let notice: String?
    }
    let standing: Standing
    let about: String?
    let memberId: String
    var agreed: Bool? = nil
}

/// What happened to something shared: up now, waiting to be read, or held —
/// with support offered when the screen saw distress.
struct ShareOutcome: Decodable, Sendable {
    enum Kind: String, Decodable, Sendable { case shared, pending, held }
    let outcome: Kind
    let support: Bool
    let post: SharedPost?
    /// Why it was held, when the writer should know (e.g. contact details among strangers).
    var notice: String?
    /// Nothing was posted: the Community Guidelines haven't been agreed to yet.
    var needsAgreement: Bool?
}

/// Someone the participant has blocked.
struct BlockedPerson: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let since: Date
}

struct WalkingGroup: Decodable, Identifiable, Hashable, Sendable {
    enum Kind: String, Decodable, Sendable { case friends, matched }
    struct Member: Decodable, Hashable, Sendable {
        var id: String?
        let name: String
        let isMe: Bool
        let currentDay: Int?
    }
    struct LastMessage: Decodable, Hashable, Sendable {
        let name: String
        let text: String
        let createdAt: Date
    }
    let id: String
    let name: String
    let kind: Kind
    /// Friends' groups only; matched groups take no invitations.
    let inviteCode: String?
    let inviteURL: URL?
    let members: [Member]
    let unread: Int
    let lastMessage: LastMessage?
}

/// Where the participant stands with being matched to strangers.
struct MatchStatus: Decodable, Equatable, Sendable {
    enum State: String, Decodable, Sendable { case none, waiting, blocked }
    let state: State
    var termsAccepted: Bool?
    var since: Date?
}

protocol TogetherService: Sendable {
    func dayPosts(_ day: Int) async throws -> [SharedPost]
    func share(day: Int, text: String, anonymous: Bool) async throws -> ShareOutcome
    func delete(postID: String) async throws
    func report(postID: String) async throws
    func groups() async throws -> [WalkingGroup]
    func createGroup(name: String, anonymous: Bool) async throws -> [WalkingGroup]
    func joinGroup(code: String, anonymous: Bool) async throws -> [WalkingGroup]
    func leaveGroup(_ id: String) async throws
    /// The group's conversation — all of it, or only what came after `since`.
    func groupPosts(_ id: String, since: Date?) async throws -> [SharedPost]
    func post(toGroup id: String, day: Int, text: String, media: PostMediaReference?) async throws -> ShareOutcome
    func mediaUpload(group id: String, kind: SharedMedia.Kind) async throws -> MediaUpload
    func member(_ memberID: String, group id: String) async throws -> MemberCard
    func communityMe() async throws -> CommunityMe
    func setAbout(_ about: String) async throws -> String?
    func clearNotice() async throws
    func agreeToGuidelines() async throws
    func block(postID: String) async throws
    func block(memberID: String, group id: String) async throws
    func blocked() async throws -> [BlockedPerson]
    func unblock(memberID: String) async throws
    func matchStatus() async throws -> MatchStatus
    func requestMatch(adult: Bool, agreed: Bool, firstName: String?) async throws -> (MatchStatus, [WalkingGroup], groupID: String?)
    func cancelMatch() async throws -> MatchStatus
    /// The participant's own Share-the-journey link (/i/CODE).
    func personalInvite() async throws -> URL
}

struct RemoteTogetherService: TogetherService {
    let client: APIClient

    private struct Posts: Decodable { let posts: [SharedPost] }
    private struct Groups: Decodable { let groups: [WalkingGroup] }

    func dayPosts(_ day: Int) async throws -> [SharedPost] {
        let response: Posts = try await client.get("api/mobile/together/day/\(day)")
        return response.posts
    }

    func share(day: Int, text: String, anonymous: Bool) async throws -> ShareOutcome {
        struct Body: Encodable { let text: String; let anonymous: Bool }
        return try await client.send("POST", "api/mobile/together/day/\(day)", body: Body(text: text, anonymous: anonymous))
    }

    func delete(postID: String) async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/together/posts/\(postID)", body: Optional<[String: String]>.none)
    }

    func report(postID: String) async throws {
        let _: OK = try await client.send("POST", "api/mobile/together/posts/\(postID)/report", body: Optional<[String: String]>.none)
    }

    func groups() async throws -> [WalkingGroup] {
        let response: Groups = try await client.get("api/mobile/together/groups")
        return response.groups
    }

    func createGroup(name: String, anonymous: Bool) async throws -> [WalkingGroup] {
        struct Body: Encodable { let name: String; let anonymous: Bool }
        let response: Groups = try await client.send("POST", "api/mobile/together/groups", body: Body(name: name, anonymous: anonymous))
        return response.groups
    }

    func joinGroup(code: String, anonymous: Bool) async throws -> [WalkingGroup] {
        struct Body: Encodable { let code: String; let anonymous: Bool }
        let response: Groups = try await client.send("POST", "api/mobile/together/groups/join", body: Body(code: code, anonymous: anonymous))
        return response.groups
    }

    func leaveGroup(_ id: String) async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/together/groups/\(id)", body: Optional<[String: String]>.none)
    }

    func groupPosts(_ id: String, since: Date?) async throws -> [SharedPost] {
        var path = "api/mobile/together/groups/\(id)/posts"
        if let since {
            let stamp = since.ISO8601Format(Date.ISO8601FormatStyle(includingFractionalSeconds: true))
            path += "?since=\(stamp.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? stamp)"
        }
        let response: Posts = try await client.get(path)
        return response.posts
    }

    func post(toGroup id: String, day: Int, text: String, media: PostMediaReference?) async throws -> ShareOutcome {
        struct Body: Encodable { let dayNumber: Int; let text: String; let media: PostMediaReference? }
        return try await client.send("POST", "api/mobile/together/groups/\(id)/posts", body: Body(dayNumber: day, text: text, media: media))
    }

    func mediaUpload(group id: String, kind: SharedMedia.Kind) async throws -> MediaUpload {
        try await client.send("POST", "api/mobile/together/groups/\(id)/media", body: ["kind": kind.rawValue])
    }

    func member(_ memberID: String, group id: String) async throws -> MemberCard {
        struct Response: Decodable { let member: MemberCard }
        let response: Response = try await client.get("api/mobile/together/people/\(memberID)?group=\(id)")
        return response.member
    }

    func communityMe() async throws -> CommunityMe {
        try await client.get("api/mobile/together/me")
    }

    func setAbout(_ about: String) async throws -> String? {
        struct Response: Decodable { let about: String? }
        let response: Response = try await client.send("PUT", "api/mobile/together/me", body: ["about": about])
        return response.about
    }

    func clearNotice() async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/together/me", body: Optional<[String: String]>.none)
    }

    func agreeToGuidelines() async throws {
        let _: OK = try await client.send("POST", "api/mobile/together/agree", body: Optional<[String: String]>.none)
    }

    func block(postID: String) async throws {
        let _: OK = try await client.send("POST", "api/mobile/together/blocks", body: ["postId": postID])
    }

    func block(memberID: String, group id: String) async throws {
        let _: OK = try await client.send("POST", "api/mobile/together/blocks", body: ["memberId": memberID, "groupId": id])
    }

    func blocked() async throws -> [BlockedPerson] {
        struct Response: Decodable { let blocked: [BlockedPerson] }
        let response: Response = try await client.get("api/mobile/together/blocks")
        return response.blocked
    }

    func unblock(memberID: String) async throws {
        let _: OK = try await client.send("DELETE", "api/mobile/together/blocks", body: ["memberId": memberID])
    }

    private struct Status: Decodable { let status: MatchStatus }

    func matchStatus() async throws -> MatchStatus {
        let response: Status = try await client.get("api/mobile/together/match")
        return response.status
    }

    func requestMatch(adult: Bool, agreed: Bool, firstName: String?) async throws -> (MatchStatus, [WalkingGroup], groupID: String?) {
        struct Body: Encodable { let adult: Bool; let agreed: Bool; let firstName: String? }
        struct Response: Decodable { let status: MatchStatus; let groups: [WalkingGroup]; let groupId: String? }
        let response: Response = try await client.send("POST", "api/mobile/together/match", body: Body(adult: adult, agreed: agreed, firstName: firstName))
        return (response.status, response.groups, response.groupId)
    }

    func cancelMatch() async throws -> MatchStatus {
        let response: Status = try await client.send("DELETE", "api/mobile/together/match", body: Optional<[String: String]>.none)
        return response.status
    }

    func personalInvite() async throws -> URL {
        struct Response: Decodable { let url: URL }
        let response: Response = try await client.get("api/mobile/invite")
        return response.url
    }
}

/// Keeps everything on the device, for previews and walkthroughs.
struct PreviewTogetherService: TogetherService {
    static let sample = [
        SharedPost(id: "1", dayNumber: 1, displayName: "Grace", text: "I caught myself explaining why I was late, three times. Letting it go felt like setting down a backpack.", createdAt: .now.addingTimeInterval(-3600), mine: false),
        SharedPost(id: "2", dayNumber: 1, displayName: nil, text: "Harder than I expected. I didn't realise how much of my day is spent defending myself.", createdAt: .now.addingTimeInterval(-7200), mine: false),
    ]
    func dayPosts(_ day: Int) async throws -> [SharedPost] { Self.sample }
    func share(day: Int, text: String, anonymous: Bool) async throws -> ShareOutcome {
        ShareOutcome(outcome: .shared, support: false,
                     post: SharedPost(id: UUID().uuidString, dayNumber: day, displayName: anonymous ? nil : "You", text: text, createdAt: .now, mine: true))
    }
    func delete(postID: String) async throws {}
    func report(postID: String) async throws {}
    static let sampleGroupID = "00000000-0000-0000-0000-000000000001"
    private static var isShowcase: Bool { ProcessInfo.processInfo.arguments.contains("-previewShowcase") }

    func groups() async throws -> [WalkingGroup] {
        guard Self.isShowcase else { return [] }
        return [WalkingGroup(
            id: Self.sampleGroupID, name: "Tuesday Breakfast Crew", kind: .friends, inviteCode: "ABCD2345",
            inviteURL: URL(string: "https://www.30daysonthemount.com/journey/join/ABCD2345")!,
            members: [.init(id: "m0", name: "Grace", isMe: true, currentDay: 13), .init(id: "m1", name: "Marcus", isMe: false, currentDay: 13),
                      .init(id: "m2", name: "Ana", isMe: false, currentDay: 12), .init(id: "m3", name: "David", isMe: false, currentDay: 13)],
            unread: 2,
            lastMessage: .init(name: "Ana", text: "Praying for you both today.", createdAt: .now - 600)
        )]
    }
    func createGroup(name: String, anonymous: Bool) async throws -> [WalkingGroup] {
        [WalkingGroup(id: "g1", name: name, kind: .friends, inviteCode: "ABCD2345", inviteURL: URL(string: "https://www.30daysonthemount.com/join/ABCD2345")!,
                      members: [.init(name: "You", isMe: true, currentDay: 1)], unread: 0, lastMessage: nil)]
    }
    func joinGroup(code: String, anonymous: Bool) async throws -> [WalkingGroup] { [] }
    func leaveGroup(_ id: String) async throws {}
    func groupPosts(_ id: String, since: Date?) async throws -> [SharedPost] {
        guard Self.isShowcase, since == nil else { return [] }
        let hour: TimeInterval = 3600
        return [
            SharedPost(id: "p0", dayNumber: 12, displayName: "Companion", text: "Welcome, walkers. Say hello, and share what brought you here.", createdAt: .now - 30 * hour, mine: false, fromCompanion: true),
            SharedPost(id: "p1", dayNumber: 13, displayName: "Marcus", text: "Love your enemies. I've been praying for my brother-in-law all week. Something is softening, in me first.", createdAt: .now - 5 * hour, mine: false, authorID: "m1"),
            SharedPost(id: "p2", dayNumber: 13, displayName: "Grace", text: "Me too. Hardest one yet. Praying for you, Marcus.", createdAt: .now - 4 * hour, mine: true),
            SharedPost(id: "p3", dayNumber: 13, displayName: "David", text: "I read it on the train this morning and had to put my phone down for a minute.", createdAt: .now - 2 * hour, mine: false, authorID: "m3"),
            SharedPost(id: "p4", dayNumber: 13, displayName: "Ana", text: "Praying for you both today.", createdAt: .now - 600, mine: false, authorID: "m2"),
        ]
    }
    func post(toGroup id: String, day: Int, text: String, media: PostMediaReference?) async throws -> ShareOutcome {
        try await share(day: day, text: text, anonymous: false)
    }
    func mediaUpload(group id: String, kind: SharedMedia.Kind) async throws -> MediaUpload { throw APIError.server("Media isn't available in previews.") }
    func member(_ memberID: String, group id: String) async throws -> MemberCard {
        MemberCard(id: memberID, name: "Grace", avatar: .init(kind: "symbol", symbol: "leaf", tone: "lavender", photoURL: nil),
                   currentDay: 4, startedOn: "2026-11-20", about: "Learning to slow down.", groupsInCommon: [])
    }
    func communityMe() async throws -> CommunityMe {
        CommunityMe(standing: .init(status: "active", pausedUntil: nil, notice: nil), about: nil, memberId: "me", agreed: true)
    }
    func setAbout(_ about: String) async throws -> String? { about.isEmpty ? nil : about }
    func clearNotice() async throws {}
    func agreeToGuidelines() async throws {}
    func block(postID: String) async throws {}
    func block(memberID: String, group id: String) async throws {}
    func blocked() async throws -> [BlockedPerson] { [] }
    func unblock(memberID: String) async throws {}
    func matchStatus() async throws -> MatchStatus { MatchStatus(state: .none, termsAccepted: false) }
    func requestMatch(adult: Bool, agreed: Bool, firstName: String?) async throws -> (MatchStatus, [WalkingGroup], groupID: String?) {
        (MatchStatus(state: .waiting, since: .now), [], nil)
    }
    func cancelMatch() async throws -> MatchStatus { MatchStatus(state: .none, termsAccepted: true) }
    func personalInvite() async throws -> URL { URL(string: "https://www.30daysonthemount.com/i/preview")! }
}

// MARK: - Media

protocol MediaService: Sendable {
    func ambientTracks() async throws -> [AudioDirector.Track]
    /// A playable URL for `text` read aloud in the app's voice.
    func speechURL(for text: String) async throws -> URL
}

struct RemoteMediaService: MediaService {
    let client: APIClient

    func ambientTracks() async throws -> [AudioDirector.Track] {
        struct Response: Decodable { let tracks: [AudioDirector.Track] }
        let response: Response = try await client.get("api/mobile/ambient")
        return response.tracks
    }

    func speechURL(for text: String) async throws -> URL {
        struct Response: Decodable { let url: URL }
        let response: Response = try await client.send("POST", "api/mobile/speech", body: ["text": text])
        return response.url
    }
}

struct PreviewMediaService: MediaService {
    func ambientTracks() async throws -> [AudioDirector.Track] { AudioDirector.fallbackTracks }
    func speechURL(for text: String) async throws -> URL {
        throw APIError.server("Reading aloud needs the journey server.")
    }
}
