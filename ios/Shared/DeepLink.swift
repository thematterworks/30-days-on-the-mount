import Foundation

/// The app's internal URLs, shared by widgets, Live Activities and
/// notifications so every surface opens the same destinations.
enum DeepLink: Equatable, Sendable {
    case day(Int)
    /// A day's story opened at its teaching — the midday notification.
    case deeper(Int)
    case companion

    static let scheme = "mount"

    var url: URL {
        switch self {
        case .day(let number): URL(string: "\(Self.scheme)://day/\(number)")!
        case .deeper(let number): URL(string: "\(Self.scheme)://day/\(number)/deeper")!
        case .companion: URL(string: "\(Self.scheme)://companion")!
        }
    }

    init?(url: URL) {
        guard url.scheme == Self.scheme else { return nil }
        switch url.host() {
        case "companion":
            self = .companion
        case "day":
            // mount://day/4, or mount://day/4/deeper
            let parts = url.pathComponents.filter { $0 != "/" }
            guard let first = parts.first, let number = Int(first), number >= 1 else { return nil }
            self = parts.dropFirst().first == "deeper" ? .deeper(number) : .day(number)
        default:
            return nil
        }
    }
}
