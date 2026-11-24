import Foundation
import Observation

@MainActor
@Observable
final class SessionStore {
    private(set) var session: Session?
    private let auth: any AuthService
    private let token: SessionToken
    private static let account = "session"

    init(auth: any AuthService, token: SessionToken) {
        self.auth = auth
        self.token = token
        session = KeychainStore.load(account: Self.account).flatMap { try? JSONDecoder().decode(Session.self, from: $0) }
        token.set(session?.token)
    }

    func requestCode(phoneNumber: String) async throws {
        try await auth.requestCode(phoneNumber: phoneNumber)
    }

    func verify(phoneNumber: String, code: String) async throws {
        let newSession = try await auth.verify(phoneNumber: phoneNumber, code: code)
        try KeychainStore.save(JSONEncoder().encode(newSession), account: Self.account)
        token.set(newSession.token)
        session = newSession
    }

    #if DEBUG
    /// Starts signed in for UI tests and simulator walkthroughs, via the
    /// `-previewSignedIn` launch argument. Compiled out of release builds.
    func signInForPreview() {
        session = Session(phoneNumber: "15555550123", token: "preview", isPreview: true)
    }
    #endif

    func signOut() {
        KeychainStore.delete(account: Self.account)
        token.set(nil)
        session = nil
    }
}
