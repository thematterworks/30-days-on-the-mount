import ActivityKit
import SwiftUI
import WidgetKit

/// The day in progress — on the Lock Screen and in the Dynamic Island.
/// Morning: the practice being carried. Evening: the check-in, opening the
/// companion. The island stays as quiet as the rest of the app: the day
/// number in gold and a single glyph for where the day is.
struct DayLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DayActivityAttributes.self) { context in
            LockScreenDayView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .activityBackgroundTint(Zoe.deep.opacity(0.92))
                .activitySystemActionForegroundColor(Zoe.peach)
                // Past the next morning: the new day, which the app syncs to on open.
                .widgetURL(context.isStale
                    ? DeepLink.day(min(context.attributes.dayNumber + 1, context.attributes.totalDays)).url
                    : link(for: context.attributes, state: context.state).url)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("Day \(context.attributes.dayNumber)")
                        .zoeLabelStyle(Zoe.peach)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    JourneyRing(day: context.attributes.dayNumber, total: context.attributes.totalDays)
                        .frame(width: 26, height: 26)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.title)
                        .font(.system(.headline, design: .serif))
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 10) {
                        Text(caption(for: context.attributes, state: context.state))
                            .font(.footnote)
                            .foregroundStyle(Zoe.inkMuted)
                            .lineLimit(2)
                            .multilineTextAlignment(.center)
                        if context.state.phase == .carrying {
                            LivedItButton(dayNumber: context.attributes.dayNumber)
                        }
                    }
                }
            } compactLeading: {
                // The day's scripture, the day number until it's known.
                Text(context.attributes.shortReference ?? "\(context.attributes.dayNumber)")
                    .font(.system(.caption, design: .serif, weight: .semibold))
                    .foregroundStyle(Zoe.peach)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            } compactTrailing: {
                Image(systemName: symbol(for: context.state.phase))
                    .foregroundStyle(Zoe.peach)
            } minimal: {
                Text("\(context.attributes.dayNumber)")
                    .font(.system(.caption, design: .monospaced, weight: .semibold))
                    .foregroundStyle(Zoe.peach)
            }
            .keylineTint(Zoe.peach)
            .widgetURL(link(for: context.attributes, state: context.state).url)
        }
    }
}

private func symbol(for phase: DayActivityAttributes.ContentState.Phase) -> String {
    switch phase {
    case .carrying: "mountain.2"
    case .eveningCheckIn: "moon.stars"
    case .rested: "checkmark"
    }
}

private func caption(for attributes: DayActivityAttributes, state: DayActivityAttributes.ContentState) -> String {
    switch state.phase {
    case .carrying: attributes.practiceTitle
    case .eveningCheckIn: state.prompt ?? "How did today's practice meet you?"
    case .rested: "Rest well. Tomorrow's invitation arrives in the morning."
    }
}

private func link(for attributes: DayActivityAttributes, state: DayActivityAttributes.ContentState) -> DeepLink {
    state.phase == .eveningCheckIn ? .companion : .day(attributes.dayNumber)
}

private struct LockScreenDayView: View {
    let attributes: DayActivityAttributes
    let state: DayActivityAttributes.ContentState
    /// The next morning has come and the app hasn't ended this yet.
    var isStale = false

    var body: some View {
        if isStale {
            HStack(spacing: 16) {
                JourneyRing(day: attributes.dayNumber, total: attributes.totalDays)
                    .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Day \(min(attributes.dayNumber + 1, attributes.totalDays))").zoeLabelStyle(Zoe.peach)
                    Text("A new day is waiting")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(Zoe.ink)
                    Text("Open On the Mount to begin.")
                        .font(.footnote)
                        .foregroundStyle(Zoe.inkMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
        } else {
            current
        }
    }

    private var current: some View {
        HStack(spacing: 16) {
            JourneyRing(day: attributes.dayNumber, total: attributes.totalDays)
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.phase == .eveningCheckIn ? "Day \(attributes.dayNumber) · Evening" : "Day \(attributes.dayNumber)")
                    .zoeLabelStyle(Zoe.peach)
                Text(attributes.title)
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(Zoe.ink)
                Text(caption(for: attributes, state: state))
                    .font(.footnote)
                    .foregroundStyle(Zoe.inkMuted)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
            if state.phase == .carrying {
                LivedItButton(dayNumber: attributes.dayNumber)
            }
        }
        .padding(16)
    }
}

/// Progress through the 31 days as a single thin ring.
private struct JourneyRing: View {
    let day: Int
    let total: Int

    var body: some View {
        ZStack {
            Circle().stroke(Zoe.locked, lineWidth: 3)
            Circle()
                .trim(from: 0, to: CGFloat(day) / CGFloat(max(total, 1)))
                .stroke(Zoe.peach, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(day)")
                .font(.system(.caption2, design: .monospaced, weight: .semibold))
                .foregroundStyle(Zoe.ink)
        }
    }
}

/// "I lived it" — the one control on the Live Activity. Runs LivedItIntent in
/// the app's process, which moves the activity to its rested state.
private struct LivedItButton: View {
    let dayNumber: Int

    var body: some View {
        Button(intent: LivedItIntent(dayNumber: dayNumber)) {
            Text("I lived it")
                .font(.system(.caption, design: .serif, weight: .semibold))
                .foregroundStyle(Zoe.deep)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Zoe.peach, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
