import SwiftUI

/// Where a vertical story comes to rest. Cards that fit the screen snap one
/// at a time, like the welcome tour. A card longer than the screen — the
/// teaching, a long passage — scrolls freely through its whole text; a flick
/// stops at its end, and the next swipe goes on to the next card.
struct StoryLayout: Equatable {
    /// Each card's height, in order.
    var heights: [CGFloat]
    var viewport: CGFloat

    /// Each card's top, as a scroll offset.
    private var starts: [CGFloat] {
        heights.indices.map { heights.prefix($0).reduce(0, +) }
    }

    /// The scroll offsets a card can rest at: its top, and for a long card,
    /// anywhere down to where its end meets the bottom of the screen.
    private func restRange(_ index: Int) -> ClosedRange<CGFloat> {
        let top = starts[index]
        return top...max(top, top + heights[index] - viewport)
    }

    /// The card whose rest range holds `offset` (or the last one before it).
    func card(at offset: CGFloat) -> Int {
        guard !heights.isEmpty else { return 0 }
        return starts.lastIndex(where: { $0 <= offset + 1 }) ?? 0
    }

    /// How far through card `index` the reader is, 0 to 1. Cards that fit
    /// the screen are read at a glance, so they're 1 once reached.
    func progress(of index: Int, at offset: CGFloat) -> Double {
        guard heights.indices.contains(index) else { return 0 }
        let range = restRange(index)
        guard range.upperBound > range.lowerBound else { return 1 }
        return Double(min(max((offset - range.lowerBound) / (range.upperBound - range.lowerBound), 0), 1))
    }

    /// Where a scroll that began at `start` and was heading for `proposed`
    /// should settle.
    func rest(from start: CGFloat, proposed: CGFloat) -> CGFloat {
        guard !heights.isEmpty, viewport > 0 else { return proposed }
        let index = card(at: start)
        let range = restRange(index)
        let isLong = range.upperBound > range.lowerBound

        if isLong {
            if range.contains(proposed) { return proposed }
            if proposed > range.upperBound {
                // Reading on: stop at the end first, then move on.
                return start < range.upperBound - 1 ? range.upperBound : top(of: index + 1, comingFrom: .above)
            }
            return start > range.lowerBound + 1 ? range.lowerBound : top(of: index - 1, comingFrom: .below)
        }

        // A short card: any real swipe moves one card; only a nudge springs back.
        let threshold = viewport * 0.08
        if proposed > start + threshold { return top(of: index + 1, comingFrom: .above) }
        if proposed < start - threshold { return top(of: index - 1, comingFrom: .below) }
        return range.lowerBound
    }

    private enum Approach { case above, below }

    /// Where to land on a neighbouring card: its top when arriving from
    /// above, and for a long card arrived at from below, its end — the place
    /// the reader left it.
    private func top(of index: Int, comingFrom approach: Approach) -> CGFloat {
        let clamped = min(max(index, 0), heights.count - 1)
        let range = restRange(clamped)
        return approach == .below ? range.upperBound : range.lowerBound
    }
}

struct StorySnapping: ScrollTargetBehavior {
    let layout: StoryLayout
    /// Where the reader's finger came down. The scroll system only reports
    /// where it lifted, which can be most of a card further on.
    let dragStart: CGFloat

    func updateTarget(_ target: inout ScrollTarget, context: TargetContext) {
        target.rect.origin.y = layout.rest(from: dragStart, proposed: target.rect.minY)
    }
}
