import Foundation

enum PhoneNumber {
    /// The canonical digit-only form the server keys participants on
    /// ("13109028045" — no "+", matching lib/twilio.ts normalizePhoneNumber),
    /// so a participant who started over SMS is the same person in the app.
    /// Ten digits are read as a US number.
    static func canonical(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = String(trimmed.unicodeScalars.filter { CharacterSet(charactersIn: "0123456789").contains($0) })
        switch digits.count {
        case 10:
            return "1" + digits
        case 11 where digits.hasPrefix("1"):
            return digits
        case 12...15 where trimmed.hasPrefix("+"):
            return digits
        default:
            return nil
        }
    }
}
