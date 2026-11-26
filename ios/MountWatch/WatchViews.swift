import SwiftUI
import WatchKit

/// Today, then the three breaths, a page each.
struct WatchRootView: View {
    @Environment(WatchReceiver.self) private var receiver

    var body: some View {
        TabView {
            TodayPage(snapshot: receiver.snapshot)
                .containerBackground(Zoe.gradient, for: .tabView)
            BreathePage()
                .containerBackground(Zoe.gradient, for: .tabView)
        }
        .tabViewStyle(.verticalPage)
    }
}

/// The day: its number, its title, the verse, and the practice to carry.
private struct TodayPage: View {
    let snapshot: JourneySnapshot?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if let snapshot {
                    Text("DAY \(snapshot.dayNumber)")
                        .font(.caption2.weight(.semibold))
                        .tracking(2)
                        .foregroundStyle(Zoe.peach)
                    Text(snapshot.title)
                        .font(.system(.title3, design: .serif))
                    if let verse = snapshot.verse {
                        Text("\u{201C}\(verse)\u{201D}")
                            .font(.system(.footnote, design: .serif).italic())
                            .foregroundStyle(.white.opacity(0.85))
                        if let reference = snapshot.verseReference {
                            Text(reference).font(.caption2).foregroundStyle(.white.opacity(0.6))
                        }
                    }
                    Divider().overlay(.white.opacity(0.2)).padding(.vertical, 2)
                    Text("TODAY'S PRACTICE")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(Zoe.peach.opacity(0.9))
                    Text(snapshot.practiceTitle)
                        .font(.system(.footnote, design: .serif))
                    Text(snapshot.hookText)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                } else {
                    Image(systemName: "mountain.2")
                        .font(.title2)
                        .foregroundStyle(Zoe.peach)
                    Text("Open On the Mount on your iPhone, and today's day will appear here.")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            // Clear of the screen's rounded edges, and of the scroll indicator.
            .padding(.horizontal, 10)
            .padding(.bottom, 8)
        }
    }
}

/// Three slow breaths — four seconds in, four out — with a tap on the
/// wrist at each turn, the way the day's story begins on the iPhone.
private struct BreathePage: View {
    @State private var expanded = false
    @State private var breath = 0
    @State private var isBreathing = false
    @State private var cue = "Three breaths"

    private let breaths = 3

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().stroke(Zoe.peach.opacity(0.2), lineWidth: 1)
                Circle()
                    .fill(RadialGradient(colors: [Zoe.peach.opacity(0.45), .clear], center: .center, startRadius: 0, endRadius: 60))
                    .scaleEffect(expanded ? 1 : 0.4)
                Circle()
                    .stroke(Zoe.peach.opacity(0.8), lineWidth: 1.5)
                    .scaleEffect(expanded ? 1 : 0.4)
            }
            .frame(width: 110, height: 110)
            Text(cue)
                .font(.system(.footnote, design: .serif).italic())
                .contentTransition(.opacity)
            if !isBreathing {
                Button(breath >= breaths ? "Again" : "Begin") { Task { await breathe() } }
                    .tint(Zoe.peach)
                    .controlSize(.small)
            }
        }
    }

    private func breathe() async {
        isBreathing = true
        breath = 0
        for _ in 0..<breaths {
            WKInterfaceDevice.current().play(.start)
            withAnimation(.easeInOut(duration: 0.4)) { cue = "Breathe in" }
            withAnimation(.easeInOut(duration: 4)) { expanded = true }
            try? await Task.sleep(for: .seconds(4))
            WKInterfaceDevice.current().play(.stop)
            withAnimation(.easeInOut(duration: 0.4)) { cue = "Breathe out" }
            withAnimation(.easeInOut(duration: 4)) { expanded = false }
            try? await Task.sleep(for: .seconds(4))
            breath += 1
        }
        WKInterfaceDevice.current().play(.success)
        withAnimation { cue = "Walk on in peace" }
        isBreathing = false
    }
}
