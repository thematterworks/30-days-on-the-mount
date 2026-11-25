import SwiftUI

/// Hold along the right edge of the journey and a fine line of the days
/// fades in; slide to move through them, a light tick at each day, and the
/// page follows. Only the days that are open — the journey still can't be
/// run ahead of.
struct DayScrubber: View {
    /// The days that can be visited, in order.
    let days: [JourneyDay]
    let current: Int?
    let onSelect: (Int) -> Void

    /// Where the finger is while scrubbing; nil otherwise. Gesture state
    /// resets itself when the touch ends *or is cancelled*, so the scrubber
    /// can never be left open.
    @GestureState private var touch: Touch?
    @State private var startDay: Int?

    private enum Touch: Equatable {
        case held
        case at(CGFloat)
    }

    var body: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            let active = activeIndex(in: height)
            ZStack(alignment: .trailing) {
                if let active {
                    track(height: height, active: active)
                    label(days[active])
                        .position(x: proxy.size.width - 70, y: position(of: active, in: height))
                }
                // The edge that answers a long press.
                Color.clear
                    .frame(width: 26)
                    .contentShape(Rectangle())
                    .gesture(scrub)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .animation(.easeOut(duration: 0.2), value: touch == nil)
            .onChange(of: active) { _, index in
                guard let index else { return }
                onSelect(days[index].dayNumber)
            }
            .sensoryFeedback(.selection, trigger: active)
        }
        .onChange(of: touch == nil) { _, ended in
            if !ended { startDay = current ?? days.last?.dayNumber }
        }
        .accessibilityHidden(true)
    }

    private var scrub: some Gesture {
        LongPressGesture(minimumDuration: 0.25)
            .sequenced(before: DragGesture(minimumDistance: 0))
            .updating($touch) { value, state, _ in
                switch value {
                case .first(true):
                    state = .held
                case .second(true, let drag):
                    state = drag.map { .at($0.location.y) } ?? .held
                default:
                    state = nil
                }
            }
    }

    /// The day under the finger — or, held but not yet moved, the day the
    /// scrub began on.
    private func activeIndex(in height: CGFloat) -> Int? {
        guard let touch, !days.isEmpty else { return nil }
        switch touch {
        case .held:
            return days.firstIndex { $0.dayNumber == (startDay ?? current) } ?? days.indices.last
        case .at(let y):
            let (top, length) = bounds(height)
            let fraction = min(max((y - top) / max(length, 1), 0), 1)
            return Int((fraction * CGFloat(days.count - 1)).rounded())
        }
    }

    /// The line runs down the middle 64% of the edge.
    private func bounds(_ height: CGFloat) -> (top: CGFloat, length: CGFloat) {
        (height * 0.18, height * 0.64)
    }

    private func position(of index: Int, in height: CGFloat) -> CGFloat {
        let (top, length) = bounds(height)
        guard days.count > 1 else { return top + length / 2 }
        return top + length * CGFloat(index) / CGFloat(days.count - 1)
    }

    /// A hairline with a fine tick for each day. The chosen day's tick
    /// widens, and its neighbours swell a little with nearness — a ripple
    /// that follows the finger.
    private func track(height: CGFloat, active: Int) -> some View {
        ZStack(alignment: .topTrailing) {
            Rectangle()
                .fill(Zoe.ink.opacity(0.14))
                .frame(width: 1, height: bounds(height).length)
                .offset(x: -8, y: bounds(height).top)
            ForEach(days.indices, id: \.self) { index in
                let swell = max(0, 1 - Double(abs(index - active)) / 3)
                Capsule()
                    .fill(index == active ? Zoe.peach : Zoe.ink.opacity(0.25 + 0.3 * swell))
                    .frame(width: 3 + 9 * swell, height: index == active ? 2 : 1)
                    .offset(x: -8, y: position(of: index, in: height))
                    .animation(.spring(duration: 0.25, bounce: 0.2), value: active)
            }
        }
        .frame(width: 26, height: height, alignment: .topTrailing)
        .transition(.opacity)
    }

    /// Small and quiet: the day, and its title in fine type.
    private func label(_ day: JourneyDay) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text("Day \(day.dayNumber)")
                .font(.zoeSerif(.subheadline))
                .foregroundStyle(Zoe.peach)
            Text(day.title)
                .font(.system(size: 10))
                .foregroundStyle(Zoe.inkMuted)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Zoe.deep.opacity(0.35), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .fixedSize()
        .frame(width: 110, alignment: .trailing)
        .transition(.opacity)
    }
}

/// Every day of the journey in one list, from the title at the top of the
/// journey: the open days to jump to, the rest still ahead.
struct DayPicker: View {
    let onSelect: (Int) -> Void

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let journey = model.journey
        NavigationStack {
            ScrollViewReader { proxy in
                List(journey.days) { day in
                    let open = journey.canOpen(day.dayNumber)
                    let isToday = day.dayNumber == journey.progress.currentDay
                    Button {
                        onSelect(day.dayNumber)
                        dismiss()
                    } label: {
                        HStack(spacing: 14) {
                            Text("\(day.dayNumber)")
                                .font(.zoeDisplay(22))
                                .foregroundStyle(isToday ? Zoe.peach : Zoe.ink.opacity(open ? 0.8 : 0.35))
                                .frame(width: 34, alignment: .leading)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(day.title).font(.zoeSerif(.headline))
                                Text(day.scriptureReference).font(.caption).foregroundStyle(Zoe.inkMuted)
                            }
                            .foregroundStyle(Zoe.ink.opacity(open ? 1 : 0.4))
                            Spacer()
                            if isToday {
                                Text("Today").zoeLabelStyle(Zoe.peach)
                            } else if journey.hasFinished(day.dayNumber) {
                                Image(systemName: "checkmark").font(.caption).foregroundStyle(Zoe.peach)
                            } else if !open {
                                Image(systemName: "lock").font(.caption).foregroundStyle(Zoe.inkMuted)
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!open)
                    .listRowBackground(isToday ? Zoe.peach.opacity(0.08) : Color.clear)
                    .id(day.dayNumber)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .onAppear { proxy.scrollTo(journey.progress.currentDay, anchor: .center) }
            }
            .navigationTitle("The days")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}
