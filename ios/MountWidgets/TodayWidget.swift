import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: JourneySnapshot
    /// After the evening check-in hour the widget turns to the evening
    /// question — the nightstand view in StandBy.
    var isEvening = false
}

/// Reads the snapshot the app writes to the App Group. The app reloads the
/// timeline whenever progress changes; the scheduled refresh just after
/// local midnight is the backstop for a day that turns over while the app is
/// closed.
struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(Self.entries(at: .now, snapshot: SharedStore.loadSnapshot() ?? .placeholder)[0])
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date.now
        let entries = Self.entries(at: now, snapshot: SharedStore.loadSnapshot() ?? .placeholder)
        let tomorrow = Calendar.current.startOfDay(for: now).addingTimeInterval(86_400 + 300)
        completion(Timeline(entries: entries, policy: .after(tomorrow)))
    }

    /// The day now, then — if it hasn't come yet — the same day at its
    /// evening hour, so the widget turns over on its own.
    static func entries(at now: Date, snapshot: JourneySnapshot, calendar: Calendar = .current) -> [TodayEntry] {
        guard let hour = snapshot.eveningHour,
              let evening = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: now) else {
            return [TodayEntry(date: now, snapshot: snapshot)]
        }
        if now >= evening {
            return [TodayEntry(date: now, snapshot: snapshot, isEvening: true)]
        }
        return [TodayEntry(date: now, snapshot: snapshot), TodayEntry(date: evening, snapshot: snapshot, isEvening: true)]
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayWidget", provider: TodayProvider()) { entry in
            TodayWidgetView(snapshot: entry.snapshot, isEvening: entry.isEvening)
                .containerBackground(for: .widget) {
                    // Evening is darker and lower-glare: on a nightstand, it
                    // shouldn't light the room.
                    if entry.isEvening {
                        LinearGradient(colors: [Color(hex: 0x2A2D48), Color(hex: 0x1C1F36)], startPoint: .top, endPoint: .bottom)
                    } else {
                        Zoe.gradient
                    }
                }
                .widgetURL(entry.isEvening ? DeepLink.companion.url : DeepLink.day(entry.snapshot.dayNumber).url)
        }
        .configurationDisplayName("Today on the Mount")
        .description("Your day and its practice; the evening question at night.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct TodayWidgetView: View {
    let snapshot: JourneySnapshot
    var isEvening = false
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if isEvening, family == .systemSmall || family == .systemMedium {
            evening
        } else {
            day
        }
    }

    /// The evening question, in dim type. StandBy shows small widgets on the
    /// nightstand; this is what they show after the check-in hour.
    private var evening: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "moon.stars")
                Text("Day \(snapshot.dayNumber) · Evening")
            }
            .font(.zoeLabel)
            .textCase(.uppercase)
            .tracking(1.6)
            .foregroundStyle(Zoe.peach.opacity(0.7))
            Spacer(minLength: 0)
            Text(snapshot.eveningPrompt ?? JourneySnapshot.fallbackEveningPrompt)
                .font(.system(family == .systemMedium ? .title3 : .callout, design: .serif).italic())
                .foregroundStyle(Zoe.ink.opacity(0.7))
                .minimumScaleFactor(0.7)
                .lineLimit(5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var day: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(snapshot.dayNumber), in: 0...Double(max(snapshot.totalDays, 1))) {
                Text("Day")
            } currentValueLabel: {
                Text("\(snapshot.dayNumber)").font(.system(.title3, design: .serif))
            }
            .gaugeStyle(.accessoryCircularCapacity)

        case .accessoryRectangular:
            // The day's verse, read every time the phone is picked up.
            if let verse = snapshot.verse {
                VStack(alignment: .leading, spacing: 1) {
                    Text(verse)
                        .font(.system(.footnote, design: .serif))
                        .lineLimit(3)
                        .minimumScaleFactor(0.8)
                    Text(snapshot.verseReference ?? "Day \(snapshot.dayNumber)")
                        .font(.zoeLabel)
                        .textCase(.uppercase)
                        .widgetAccentable()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Day \(snapshot.dayNumber)").font(.zoeLabel).textCase(.uppercase)
                    Text(snapshot.title).font(.system(.headline, design: .serif)).lineLimit(1)
                    Text(snapshot.practiceTitle).font(.caption).lineLimit(1)
                }
            }

        case .accessoryInline:
            Text("Day \(snapshot.dayNumber) · \(snapshot.title)")

        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                header
                Text(snapshot.hookText)
                    .font(.system(.footnote, design: .serif))
                    .foregroundStyle(Zoe.ink.opacity(0.85))
                    .lineLimit(6)
            }
            .foregroundStyle(Zoe.ink)

        default:
            header.foregroundStyle(Zoe.ink)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Day \(snapshot.dayNumber)").zoeLabelStyle(Zoe.peach)
            Text(snapshot.title)
                .font(.system(.headline, design: .serif))
                .lineLimit(3)
            // The journey's mark, beneath the day's theme.
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: family == .systemSmall ? 84 : 120)
                .foregroundStyle(Zoe.peach.opacity(0.9))
                .widgetAccentable()
                .accessibilityHidden(true)
                .padding(.top, 2)
            Spacer(minLength: 0)
            Text(snapshot.finishedToday ? "Carried into today" : snapshot.practiceTitle)
                .font(.caption2)
                .foregroundStyle(Zoe.inkMuted)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
