import SwiftUI

/// Hold along the right edge of the journey and a slim timeline of the days
/// fades in; slide to move through them, a light tick at each day, and let
/// go to land there. Only the days that are open — the journey still can't
/// be run ahead of.
struct DayScrubber: View {
    /// The days that can be visited, in order.
    let days: [JourneyDay]
    let current: Int?
    let onSelect: (Int) -> Void

    @State private var isScrubbing = false
    @State private var scrubbed: Int?

    var body: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            ZStack(alignment: .trailing) {
                if isScrubbing, let scrubbed, let index = days.firstIndex(where: { $0.dayNumber == scrubbed }) {
                    let y = position(of: index, in: height)
                    track(height: height, active: index)
                    label(days[index])
                        .position(x: proxy.size.width - 120, y: y)
                        .transition(.opacity)
                }
                // The edge that answers a long press.
                Color.clear
                    .frame(width: 28)
                    .contentShape(Rectangle())
                    .gesture(scrub(height: height))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .animation(.easeOut(duration: 0.25), value: isScrubbing)
        }
        .sensoryFeedback(.selection, trigger: scrubbed)
        .sensoryFeedback(.impact(weight: .light), trigger: isScrubbing) { _, new in new }
        .accessibilityHidden(true)
    }

    private func scrub(height: CGFloat) -> some Gesture {
        LongPressGesture(minimumDuration: 0.25)
            .sequenced(before: DragGesture(minimumDistance: 0))
            .onChanged { value in
                switch value {
                case .first(true):
                    begin()
                case .second(true, let drag):
                    begin()
                    if let drag, let day = day(at: drag.location.y, in: height), day != scrubbed {
                        scrubbed = day
                        // The page follows the finger, so each day is seen in passing.
                        onSelect(day)
                    }
                default:
                    break
                }
            }
            .onEnded { _ in
                isScrubbing = false
                scrubbed = nil
            }
    }

    private func begin() {
        guard !isScrubbing else { return }
        isScrubbing = true
        if scrubbed == nil { scrubbed = current ?? days.last?.dayNumber }
    }

    /// The track runs down the middle 70% of the edge.
    private func bounds(_ height: CGFloat) -> (top: CGFloat, length: CGFloat) {
        (height * 0.15, height * 0.7)
    }

    private func position(of index: Int, in height: CGFloat) -> CGFloat {
        let (top, length) = bounds(height)
        guard days.count > 1 else { return top + length / 2 }
        return top + length * CGFloat(index) / CGFloat(days.count - 1)
    }

    private func day(at y: CGFloat, in height: CGFloat) -> Int? {
        guard !days.isEmpty else { return nil }
        let (top, length) = bounds(height)
        let fraction = min(max((y - top) / max(length, 1), 0), 1)
        let index = Int((fraction * CGFloat(days.count - 1)).rounded())
        return days[index].dayNumber
    }

    private func track(height: CGFloat, active: Int) -> some View {
        ZStack(alignment: .top) {
            Capsule()
                .fill(Zoe.ink.opacity(0.12))
                .frame(width: 4, height: bounds(height).length + 16)
                .offset(y: bounds(height).top - 8)
            ForEach(days.indices, id: \.self) { index in
                Capsule()
                    .fill(index == active ? Zoe.peach : Zoe.ink.opacity(index < active ? 0.55 : 0.3))
                    .frame(width: index == active ? 14 : 6, height: index == active ? 4 : 2)
                    .offset(y: position(of: index, in: height) - 1)
            }
        }
        .frame(width: 28, height: height, alignment: .top)
        .transition(.opacity)
    }

    private func label(_ day: JourneyDay) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("Day \(day.dayNumber)").font(.zoeDisplay(26)).foregroundStyle(Zoe.peach)
            Text(day.title)
                .font(.zoeSerif(.footnote))
                .foregroundStyle(Zoe.ink)
                .lineLimit(1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(width: 180, alignment: .trailing)
        .zoeGlass(in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
