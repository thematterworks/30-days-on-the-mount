import SwiftUI

/// Touch the right edge of the journey and a dotted path of the days fades
/// in; slide along it — a light tick at each day, the day's name beside your
/// finger — and let go to go to that day. Only the days that are open: the
/// journey still can't be run ahead of.
///
/// The edge sits over the journey, not inside its scroll view, so the two
/// never compete for the touch; and the page moves once, on release, rather
/// than scrolling through every day the finger passes.
struct DayScrubber: View {
    /// The days that can be visited, in order.
    let days: [JourneyDay]
    let current: Int?
    let onSelect: (Int) -> Void

    /// The finger's height while it's on the edge. Gesture state resets
    /// itself whenever the touch ends or is cancelled, so the scrubber can
    /// never be left open.
    @GestureState private var touchY: CGFloat?

    var body: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            let active = touchY.map { index(at: $0, in: height) }
            ZStack(alignment: .trailing) {
                if let active, days.indices.contains(active) {
                    track(height: height, active: active)
                    label(days[active])
                        .position(x: proxy.size.width - 70, y: position(of: active, in: height))
                        .animation(.snappy(duration: 0.16), value: active)
                }
                Color.clear
                    .frame(width: 28)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0, coordinateSpace: .local)
                            .updating($touchY) { value, state, _ in state = value.location.y }
                            .onEnded { value in
                                // A tap on the edge only shows the path; a slide chooses a day.
                                guard !days.isEmpty, abs(value.translation.height) > 8 else { return }
                                onSelect(days[index(at: value.location.y, in: height)].dayNumber)
                            }
                    )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .animation(.easeOut(duration: 0.18), value: touchY == nil)
            .sensoryFeedback(.selection, trigger: active)
        }
        .accessibilityHidden(true)
    }

    /// The day nearest the finger.
    private func index(at y: CGFloat, in height: CGFloat) -> Int {
        let (top, length) = bounds(height)
        let fraction = min(max((y - top) / max(length, 1), 0), 1)
        return Int((fraction * CGFloat(max(days.count - 1, 0))).rounded())
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
