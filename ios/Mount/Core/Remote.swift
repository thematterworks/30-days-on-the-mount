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
