import SwiftUI
import WidgetKit

@main
struct MountWidgetsBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        DayLiveActivity()
    }
}
