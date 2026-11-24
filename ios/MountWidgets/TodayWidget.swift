import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: JourneySnapshot
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
        completion(TodayEntry(date: .now, snapshot: SharedStore.loadSnapshot() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let entry = TodayEntry(date: .now, snapshot: SharedStore.loadSnapshot() ?? .placeholder)
        let tomorrow = Calendar.current.startOfDay(for: .now).addingTimeInterval(86_400 + 300)
        completion(Timeline(entries: [entry], policy: .after(tomorrow)))
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TodayWidget", provider: TodayProvider()) { entry in
            TodayWidgetView(snapshot: entry.snapshot)
                .containerBackground(for: .widget) { Zoe.gradient }
                .widgetURL(DeepLink.day(entry.snapshot.dayNumber).url)
        }
        .configurationDisplayName("Today on the Mount")
        .description("Your day on the journey and its practice.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct TodayWidgetView: View {
    let snapshot: JourneySnapshot
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(snapshot.dayNumber), in: 0...Double(max(snapshot.totalDays, 1))) {
                Text("Day")
            } currentValueLabel: {
                Text("\(snapshot.dayNumber)").font(.system(.title3, design: .serif))
            }
            .gaugeStyle(.accessoryCircularCapacity)

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Day \(snapshot.dayNumber)").font(.zoeLabel).textCase(.uppercase)
                Text(snapshot.title).font(.system(.headline, design: .serif)).lineLimit(1)
                Text(snapshot.practiceTitle).font(.caption).lineLimit(1)
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
            Spacer(minLength: 0)
            Text(snapshot.finishedToday ? "Carried into today" : snapshot.practiceTitle)
                .font(.caption2)
                .foregroundStyle(Zoe.inkMuted)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
