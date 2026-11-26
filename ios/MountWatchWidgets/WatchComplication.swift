import SwiftUI
import WidgetKit

/// The watch-face complication: the day you're on, at a glance; tapping it
/// opens the watch app.
@main
struct MountWatchWidgets: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DayComplication", provider: DayProvider()) { entry in
            DayComplicationView(entry: entry)
                .containerBackground(Zoe.gradient, for: .widget)
        }
        .configurationDisplayName("Today on the Mount")
        .description("The day of your journey, and its title.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

struct DayEntry: TimelineEntry {
    let date: Date
    let snapshot: JourneySnapshot
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { DayEntry(date: .now, snapshot: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(DayEntry(date: .now, snapshot: SharedStore.loadSnapshot() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let entry = DayEntry(date: .now, snapshot: SharedStore.loadSnapshot() ?? .placeholder)
        // The phone reloads this whenever the day changes; an hourly look
        // keeps it honest if a message is missed.
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(3600))))
    }
}

struct DayComplicationView: View {
    let entry: DayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            VStack(spacing: 0) {
                Image(systemName: "mountain.2.fill").font(.caption2)
                Text("\(entry.snapshot.dayNumber)").font(.system(.title3, design: .serif).weight(.semibold))
            }
            .widgetAccentable()
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("DAY \(entry.snapshot.dayNumber) · ON THE MOUNT")
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()
                Text(entry.snapshot.title).font(.system(.headline, design: .serif))
                Text(entry.snapshot.practiceTitle).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .accessoryCorner:
            Image(systemName: "mountain.2.fill")
                .font(.title3)
                .widgetLabel("Day \(entry.snapshot.dayNumber)")
        default:
            Text("Day \(entry.snapshot.dayNumber) · \(entry.snapshot.title)")
        }
    }
}
