import SwiftUI

/// The 30 Days on the Mount design system.
///
/// Colors are measured from the brand assets, not approximated: the gradient
/// runs dusty mauve → lavender → periwinkle (left to right in the artwork),
/// and the single accent is the wordmark's peach. White carries reading text;
/// peach is kept for display type, labels and the one primary action on a
/// screen. Small body text stays white — peach on lavender is lovely large and
/// too faint small.
enum Zoe {
    static let mauve = Color(hex: 0x8A8396)
    static let lavender = Color(hex: 0x737293)
    static let periwinkle = Color(hex: 0x546391)
    static let peach = Color(hex: 0xF6CDAF)
    /// The deepest tone in the system: text set on peach, Lock Screen tint,
    /// the night end of the atmosphere.
    static let navy = Color(hex: 0x2C3254)

    static let ink = Color.white
    static let inkMuted = Color.white.opacity(0.62)
    static let locked = Color.white.opacity(0.14)

    /// Kept for the widget and Live Activity code, which predates the
    /// measured palette.
    static let deep = navy

    /// The brand gradient exactly as the artwork sets it.
    static let gradient = LinearGradient(
        colors: [mauve, lavender, periwinkle],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// The brand gradient tuned to the hour. Morning borrows the sunrise
    /// variant from the layouts (a breath of peach at the top), evening and
    /// night lean toward periwinkle and navy. The family never changes — only
    /// how much light is in it.
    static func gradient(at date: Date, calendar: Calendar = .current) -> LinearGradient {
        let hour = calendar.component(.hour, from: date)
        let colors: [Color] = switch hour {
        case 5..<10: [Color(hex: 0xA8919A), mauve, periwinkle]
        case 10..<18: [mauve, lavender, periwinkle]
        case 18..<22: [Color(hex: 0x6F6A8A), Color(hex: 0x5A6290), Color(hex: 0x3F4A7A)]
        default: [Color(hex: 0x4E4B6C), Color(hex: 0x3D4672), navy]
        }
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// Type families in one place, so the licensed brand face drops in with a
/// one-line change.
enum ZoeType {
    /// The brand's display face is Roller Coaster Serif. It is commercial, so
    /// it ships only once its file and an app-embedding license are in hand;
    /// Didot — high-contrast, and built into iOS — stands in until then.
    static let displayFamily = "Didot"
}

extension Font {
    /// Display type: day titles, section heads, the large moments.
    static func zoeDisplay(_ size: CGFloat, relativeTo style: Font.TextStyle = .largeTitle) -> Font {
        .custom(ZoeType.displayFamily, size: size, relativeTo: style)
    }

    /// Reading type: scripture, exegesis, the companion's voice.
    static func zoeSerif(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .serif, weight: weight)
    }

    /// The small tracked label the layouts use ("30 DAYS ON THE MOUNT", "DAY 4").
    static let zoeLabel = Font.system(.caption2, design: .default, weight: .medium)
}

extension View {
    /// Keeps a column of reading to a comfortable line length, centered,
    /// however wide the window (an iPad in landscape).
    func readableWidth(_ width: CGFloat = 680) -> some View {
        frame(maxWidth: width).frame(maxWidth: .infinity)
    }

    func zoeLabelStyle(_ color: Color = Zoe.inkMuted) -> some View {
        font(.zoeLabel).tracking(2.4).textCase(.uppercase).foregroundStyle(color)
    }

    func zoeBackground() -> some View {
        background(Zoe.gradient.ignoresSafeArea())
    }
}
