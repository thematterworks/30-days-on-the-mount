import Foundation
import Observation
import OSLog
import SwiftUI
import UIKit

/// The participant's profile icon: their initials, one of a few symbols
/// from the journey, or a photo. Kept with the account on the server, so it
/// comes back after signing out or on a new phone, and cached here so it
/// shows instantly.
@MainActor
@Observable
final class AvatarStore {
    enum Choice: Codable, Equatable {
        case initials
        case symbol(name: String, tone: Tone)
        case photo
    }

    /// Backgrounds for a symbol, all from the palette.
    enum Tone: String, Codable, CaseIterable {
        case peach, lavender, periwinkle, navy
    }

    /// Symbols that belong to the journey's imagery. The server accepts the
    /// same list (lib/avatar.ts).
    static let symbols = ["mountain.2", "sun.horizon", "leaf", "flame", "drop", "moon.stars", "sparkles", "bird", "water.waves", "heart"]

    private(set) var choice: Choice
    private(set) var photo: UIImage?

    private let service: any AvatarService
    private static let choiceKey = "avatar.choice.v1"
    /// Set while a change hasn't reached the server yet, so the next sync
    /// sends it rather than overwriting it with the older copy there.
    private static let pendingKey = "avatar.pending.v1"

    /// In the App Group when it's available; otherwise the app's own
    /// storage, so a photo is never silently dropped.
    private static var photoURL: URL? {
        let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: SharedStore.appGroupID)
            ?? (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
        return folder?.appending(path: "avatar.jpg")
    }

    init(service: any AvatarService) {
        self.service = service
        choice = SharedStore.defaults.data(forKey: Self.choiceKey)
            .flatMap { try? JSONDecoder().decode(Choice.self, from: $0) } ?? .initials
        if choice == .photo {
            photo = Self.photoURL.flatMap { try? Data(contentsOf: $0) }.flatMap(UIImage.init(data:))
            if photo == nil { choice = .initials }
        }
    }

    func choose(_ newChoice: Choice) {
        choice = newChoice
        if newChoice != .photo { removePhoto() }
        persist()
        upload()
    }

    /// A photo already framed square (PhotoFramer) — kept, and sent to the
    /// account.
    func setFramedPhoto(_ image: UIImage) {
        storePhoto(image)
        choice = .photo
        persist()
        upload()
    }

    /// Brings this phone in line with the account: sends a change that
    /// hasn't reached the server, or takes the server's icon.
    func sync() async {
        if SharedStore.defaults.bool(forKey: Self.pendingKey) {
            await send()
            return
        }
        guard let remote = try? await service.avatar() else { return }
        switch remote.kind {
        case "symbol":
            if let name = remote.symbol, let tone = remote.tone.flatMap(Tone.init(rawValue:)) {
                choice = .symbol(name: name, tone: tone)
                removePhoto()
            }
        case "photo":
            guard let url = remote.photoURL,
                  let (data, _) = try? await URLSession.shared.data(from: url),
                  let image = UIImage(data: data) else { return }
            storePhoto(image)
            choice = .photo
        default:
            choice = .initials
            removePhoto()
        }
        persist()
    }

    func clearLocalData() {
        removePhoto()
        choice = .initials
        SharedStore.defaults.removeObject(forKey: Self.choiceKey)
        SharedStore.defaults.removeObject(forKey: Self.pendingKey)
    }

    private func upload() {
        SharedStore.defaults.set(true, forKey: Self.pendingKey)
        Task { await send() }
    }

    private func send() async {
        let remote: RemoteAvatar
        var jpeg: Data?
        switch choice {
        case .initials:
            remote = RemoteAvatar(kind: "initials")
        case .symbol(let name, let tone):
            remote = RemoteAvatar(kind: "symbol", symbol: name, tone: tone.rawValue)
        case .photo:
            remote = RemoteAvatar(kind: "photo")
            jpeg = photo?.jpegData(compressionQuality: 0.85)
            if jpeg == nil { return }
        }
        do {
            try await service.save(remote, photo: jpeg)
            SharedStore.defaults.set(false, forKey: Self.pendingKey)
        } catch {
            // Stays pending; the next sync tries again.
            Logger.app.error("Avatar didn't save: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func storePhoto(_ image: UIImage) {
        if let url = Self.photoURL, let jpeg = image.jpegData(compressionQuality: 0.85) {
            try? jpeg.write(to: url, options: .atomic)
        }
        photo = image
    }

    private func removePhoto() {
        photo = nil
        if let url = Self.photoURL { try? FileManager.default.removeItem(at: url) }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(choice) {
            SharedStore.defaults.set(data, forKey: Self.choiceKey)
        }
    }
}

extension AvatarStore.Tone {
    var color: Color {
        switch self {
        case .peach: Zoe.peach
        case .lavender: Zoe.lavender
        case .periwinkle: Zoe.periwinkle
        case .navy: Zoe.navy
        }
    }

    /// The mark's color on this background.
    var ink: Color { self == .peach ? Zoe.navy : Zoe.ink }
}
