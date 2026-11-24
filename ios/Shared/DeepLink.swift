import Foundation

/// The app's internal URLs, shared by widgets, Live Activities and
/// notifications so every surface opens the same destinations.
enum DeepLink: Equatable, Sendable {
    case day(Int)
    case companion

    static let scheme = "mount"

    var url: URL {
        switch self {
        case .day(let number): URL(string: "\(Self.scheme)://day/\(number)")!
        case .companion: URL(string: "\(Self.scheme)://companion")!
        }
    }

    init?(url: URL) {
        guard url.scheme == Self.scheme else { return nil }
        switch url.host() {
        case "companion":
            self = .companion
        case "day":
            guard let number = Int(url.lastPathComponent), number >= 1 else { return nil }
            self = .day(number)
        default:
            return nil
        }
    }
}
