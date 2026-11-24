import Foundation
import Observation
import SwiftUI
import UIKit

/// The participant's profile icon: their initials, one of a few symbols
/// from the journey, or a photo. Kept on this phone.
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

    /// Symbols that belong to the journey's imagery.
    static let symbols = ["mountain.2", "sun.horizon", "leaf", "flame", "drop", "moon.stars", "sparkles", "bird", "water.waves", "heart"]

    private(set) var choice: Choice
    private(set) var photo: UIImage?

    private static let choiceKey = "avatar.choice.v1"
    private static var photoURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: SharedStore.appGroupID)?
            .appending(path: "avatar.jpg")
    }

    init() {
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
    }

    /// Takes a photo, squares and shrinks it — an avatar never needs more
    /// than a few hundred pixels.
    func setPhoto(_ data: Data) {
        guard let image = UIImage(data: data) else { return }
        let side = min(image.size.width, image.size.height)
        let crop = CGRect(x: (image.size.width - side) / 2, y: (image.size.height - side) / 2, width: side, height: side)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let square = UIGraphicsImageRenderer(size: CGSize(width: 400, height: 400), format: format).image { _ in
            image.draw(in: CGRect(x: -crop.minX * 400 / side, y: -crop.minY * 400 / side,
                                  width: image.size.width * 400 / side, height: image.size.height * 400 / side))
        }
        if let url = Self.photoURL, let jpeg = square.jpegData(compressionQuality: 0.85) {
            try? jpeg.write(to: url, options: .atomic)
        }
        photo = square
        choice = .photo
        persist()
    }

    func clearLocalData() {
        removePhoto()
        choice = .initials
        SharedStore.defaults.removeObject(forKey: Self.choiceKey)
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
