import SwiftUI

/// Hold along the right edge of the journey and a dotted path of the days
/// fades in; slide to move through them, a light tick at each day, and the
/// page follows. Only the days that are open — the journey still can't be
/// run ahead of.
struct DayScrubber: View {
    /// The days that can be visited, in order.
    let days: [JourneyDay]
    let current: Int?
    let onSelect: (Int) -> Void

    /// The day under the finger while scrubbing; nil otherwise.
    @State private var active: Int?
    /// Where the hold began, and the day it began on: until the finger moves,
    /// the scrub stays on that day.
    @State private var origin: (y: CGFloat, index: Int)?

    var body: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            ZStack(alignment: .trailing) {
                if let active, days.indices.contains(active) {
                    track(height: height, active: active)
                    label(days[active])
                        .position(x: proxy.size.width - 70, y: position(of: active, in: height))
                        .animation(.snappy(duration: 0.18), value: active)
                }
                // The edge that answers a hold. A native long-press: it
                // tracks the finger once recognised, and always reports its
                // end — lifted, cancelled or interrupted — so the scrubber
                // can't be left open.
                Color.clear
                    .frame(width: 30)
                    .contentShape(Rectangle())
                    .gesture(EdgeHold { y in update(y, height: height) })
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .animation(.easeOut(duration: 0.2), value: active == nil)
        }
        .accessibilityHidden(true)
    }

    private func update(_ y: CGFloat?, height: CGFloat) {
        guard let y, !days.isEmpty else {
            active = nil
            origin = nil
            return
        }
        guard let origin else {
            let start = days.firstIndex { $0.dayNumber == current } ?? days.count - 1
            self.origin = (y, start)
            active = start
            return
        }
        // Held but not yet moved: the day it began on.
        guard abs(y - origin.y) > 6 else { return }
        let (top, length) = bounds(height)
        let fraction = min(max((y - top) / max(length, 1), 0), 1)
        let index = Int((fraction * CGFloat(days.count - 1)).rounded())
        guard index != active else { return }
        active = index
        onSelect(days[index].dayNumber)
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

    /// A dotted path, one small circle a day — the welcome tour's path of
    /// days. The chosen day's dot grows to full peach, and its neighbours
    /// swell a little with nearness, a ripple that follows the finger.
    private func track(height: CGFloat, active: Int) -> some View {
        ZStack(alignment: .topTrailing) {
            ForEach(days.indices, id: \.self) { index in
                let swell = max(0, 1 - Double(abs(index - active)) / 3)
                let size = index == active ? 9 : 3.5 + 2.5 * swell
                Circle()
                    .fill(Zoe.peach.opacity(index == active ? 1 : 0.7 + 0.3 * swell))
                    .frame(width: size, height: size)
                    .frame(width: 12, height: 12)
                    .offset(x: -4, y: position(of: index, in: height) - 6)
            }
        }
        .frame(width: 26, height: height, alignment: .topTrailing)
        .animation(.snappy(duration: 0.2), value: active)
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

/// A press held on the edge, then followed: the finger's height while held,
/// nil once it ends for any reason.
private struct EdgeHold: UIGestureRecognizerRepresentable {
    let onChange: (CGFloat?) -> Void

    func makeUIGestureRecognizer(context: Context) -> UILongPressGestureRecognizer {
        let recognizer = UILongPressGestureRecognizer()
        recognizer.minimumPressDuration = 0.18
        // A little drift while pressing is still a hold, not a scroll.
        recognizer.allowableMovement = 16
        return recognizer
    }

    func handleUIGestureRecognizerAction(_ recognizer: UILongPressGestureRecognizer, context: Context) {
        switch recognizer.state {
        case .began, .changed:
            onChange(context.converter.localLocation.y)
        default:
            onChange(nil)
        }
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
