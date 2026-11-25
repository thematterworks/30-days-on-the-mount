import SwiftUI

/// The journey as the layouts draw it: one day per screen, full-bleed, no
/// cards. A day is its number, its title, and — for today — the practice;
/// everything else waits behind "Enter". Days fade into one another as they
/// pass, which is what conveys position in place of a scrollbar.
struct JourneyView: View {
    let zoomNamespace: Namespace.ID

    @Environment(AppModel.self) private var model
    @State private var focusedDay: Int?
    @State private var isPickingDay = false
    @State private var isRewatchingWelcome = false

    var body: some View {
        let journey = model.journey
        // The header has a row of its own: attached to the paging scroll
        // view, its buttons took several taps to answer.
        VStack(spacing: 0) {
            HubHeader { isPickingDay = true }
            pages(journey)
        }
        .fullScreenCover(isPresented: $isRewatchingWelcome) {
            WelcomeView { isRewatchingWelcome = false }
        }
        .sheet(isPresented: $isPickingDay) {
            DayPicker { day in withAnimation(.smooth(duration: 0.6)) { focusedDay = day } }
        }
    }

    private func pages(_ journey: JourneyStore) -> some View {
        ScrollView(.vertical) {
            // Not lazy: opening on a late day, a lazy stack has to guess the
            // heights above it and comes to rest between two pages.
            VStack(spacing: 0) {
                // One page above Day 1: the welcome, to watch again.
                WelcomeAgainPage { isRewatchingWelcome = true }
                    .containerRelativeFrame(.vertical)
                    .id(JourneyView.welcomeID)
                ForEach(journey.days) { day in
                    DayPage(day: day, zoomNamespace: zoomNamespace)
                        .containerRelativeFrame(.vertical)
                        .scrollTransition(.interactive, axis: .vertical) { content, phase in
                            content
                                .opacity(phase.isIdentity ? 1 : 0)
                                .offset(y: phase.value * 60)
                                .blur(radius: phase.isIdentity ? 0 : 6)
                        }
                        .id(day.dayNumber)
                }
                if journey.hasReachedSummit {
                    SummitPage()
                        .containerRelativeFrame(.vertical)
                        .id(JourneyView.summitID)
                }
            }
            .scrollTargetLayout()
        }
        // Snaps to the pages themselves; .paging counts in scroll-view
        // heights, which the header inset knocks out of step with the pages.
        .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
        .scrollPosition(id: $focusedDay, anchor: .top)
        .scrollIndicators(.hidden)
        .sensoryFeedback(.selection, trigger: focusedDay)
        .overlay(alignment: .bottom) { returnToToday }
        .overlay {
            DayScrubber(
                days: journey.days.filter { journey.canOpen($0.dayNumber) },
                current: focusedDay == Self.summitID ? nil : focusedDay
            ) { day in focusedDay = day }
        }
        // Once the pages are laid out, open on today.
        .task(id: journey.days.count) {
            await Task.yield()
            focusedDay = journey.progress.currentDay
        }
        .onChange(of: journey.progress.currentDay) { _, day in
            withAnimation(.smooth(duration: 0.8)) { focusedDay = day }
        }
    }

    static let summitID = 1_000
    static let welcomeID = 0

    /// Appears only when the participant has wandered away from today.
    @ViewBuilder
    private var returnToToday: some View {
        let today = model.journey.progress.currentDay
        if let focusedDay, focusedDay != today, focusedDay != Self.summitID, focusedDay != Self.welcomeID {
            Button {
                withAnimation(.smooth(duration: 0.9)) { self.focusedDay = today }
            } label: {
                Label(focusedDay > today ? "Back to today" : "Return to today",
                      systemImage: focusedDay > today ? "chevron.up" : "chevron.down")
                    .zoeLabelStyle(Zoe.ink)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .zoeGlass(in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.bottom, 16)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
            #if DEBUG
            .contextMenu { previewMenu }
            #endif
        } else {
            #if DEBUG
            Color.clear.frame(width: 120, height: 44).contentShape(Rectangle())
                .contextMenu { previewMenu }
                .padding(.bottom, 16)
            #endif
        }
    }

    #if DEBUG
    @ViewBuilder
    private var previewMenu: some View {
        let journey = model.journey
        Button("Advance a day (preview)", systemImage: "sunrise") {
            Task { await journey.advanceDayForPreview() }
        }
        if let today = journey.today {
            Button("Send evening check-in (preview)", systemImage: "moon.stars") {
                Task {
                    await model.liveActivity.beginEveningCheckIn(today, totalDays: journey.totalDays, prompt: "How did today's practice meet you?")
                    await model.notifications.scheduleCheckInPreview(dayNumber: today.dayNumber, prompt: "How did today's practice meet you?")
                }
            }
        }
    }
    #endif
}

/// One day, the whole screen.
private struct DayPage: View {
    let day: JourneyDay
    let zoomNamespace: Namespace.ID

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dawn = false
    @State private var showsReflection = false

    var body: some View {
        let journey = model.journey
        let state = journey.state(of: day.dayNumber)
        let finished = journey.hasFinished(day.dayNumber)
        let reflection = journey.reflections[day.dayNumber]

        VStack(spacing: 0) {
            Spacer(minLength: 40)

            ZStack {
                // The mountain from the lockup, faint behind the title —
                // the layouts' signature composition.
                Image("MountainLine")
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFit()
                    .foregroundStyle(Zoe.ink.opacity(state == .locked ? 0.08 : 0.2))
                    .padding(.horizontal, 8)
                    .offset(y: -10)
                    .scaleEffect(dawn ? 1.04 : 1)

                // Dawn: the first time a newly opened day is seen, peach light
                // gathers behind the title and settles.
                RadialGradient(colors: [Zoe.peach.opacity(dawn ? 0.35 : 0), .clear], center: .center, startRadius: 0, endRadius: 220)
                    .allowsHitTesting(false)

                VStack(spacing: 6) {
                    Text("Day \(day.dayNumber)")
                        .font(.zoeDisplay(34, relativeTo: .title))
                        .foregroundStyle(state == .locked ? Zoe.inkMuted : Zoe.peach)
                    Text(day.title)
                        .font(.zoeDisplay(54))
                        .foregroundStyle(state == .locked ? Zoe.inkMuted : Zoe.ink)
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                        .lineLimit(3)
                }
                .padding(.horizontal, 28)
            }
            .matchedTransitionSource(id: day.dayNumber, in: zoomNamespace)

            Group {
                if state == .active {
                    Text(day.practiceTitle)
                        .font(.zoeSerif(.title3).italic())
                        .foregroundStyle(Zoe.ink.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .padding(.top, 28)
                        .padding(.horizontal, 40)
                } else if state == .completed && !finished {
                    // Grace over streaks: a day that passed unentered isn't
                    // missed or failed. It waits.
                    Text("The mountain is still here.")
                        .font(.zoeSerif(.title3).italic())
                        .foregroundStyle(Zoe.ink.opacity(0.8))
                        .padding(.top, 28)
                } else if state == .completed {
                    Text(day.scriptureReference)
                        .zoeLabelStyle()
                        .padding(.top, 28)
                }
            }

            Spacer(minLength: 40)

            action(state: state, finished: finished, hasReflection: reflection != nil)
                // Room beneath for the "Return to today" pill.
                .padding(.bottom, 76)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
        .onAppear(perform: playDawnIfNeeded)
        .sheet(isPresented: $showsReflection) {
            if let reflection { ReflectionRecord(day: day, reflection: reflection) }
        }
    }

    @ViewBuilder
    private func action(state: DayState, finished: Bool, hasReflection: Bool) -> some View {
        switch state {
        case .locked:
            Label(day.dayNumber == model.journey.progress.currentDay + 1 ? "Opens tomorrow" : "Opens in its time", systemImage: "lock")
                .zoeLabelStyle()
        case .active, .completed:
            VStack(spacing: 18) {
                Button {
                    model.open(.day(day.dayNumber))
                } label: {
                    Text(state == .active ? (finished ? "Return to today" : "Enter") : (finished ? "Revisit" : "Enter"))
                        .font(.zoeSerif(.title3))
                        .padding(.horizontal, 44)
                        .frame(minHeight: 52)
                        .background(state == .active && !finished ? Zoe.peach : .clear, in: Capsule())
                        .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.7)))
                        .foregroundStyle(state == .active && !finished ? Zoe.navy : Zoe.peach)
                }
                .buttonStyle(.plain)

                if hasReflection {
                    Button("What you wrote") { showsReflection = true }
                        .font(.footnote)
                        .foregroundStyle(Zoe.inkMuted)
                } else if finished {
                    Text("Carried into today").zoeLabelStyle(Zoe.peach)
                }
            }
        }
    }

    private func playDawnIfNeeded() {
        guard model.journey.state(of: day.dayNumber) == .active,
              model.journey.claimDawn(for: day.dayNumber),
              !reduceMotion else { return }
        withAnimation(.easeOut(duration: 1.6).delay(0.3)) { dawn = true }
        withAnimation(.easeInOut(duration: 2.2).delay(2.2)) { dawn = false }
    }
}

/// A day's saved reflection and the question it drew — the participant's own
/// record of the day, read back in the journal voice.
private struct ReflectionRecord: View {
    let day: JourneyDay
    let reflection: SavedReflection

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("Day \(day.dayNumber) · \(day.title)").zoeLabelStyle(Zoe.peach)
                Text("You wrote").zoeLabelStyle()
                Text(reflection.text)
                    .font(.body)
                    .foregroundStyle(Zoe.ink.opacity(0.88))
                    .lineSpacing(5)
                Rectangle().fill(Zoe.locked).frame(height: 1)
                Text("The question you were asked").zoeLabelStyle()
                Text(reflection.question)
                    .font(.zoeSerif(.title3))
                    .lineSpacing(5)
            }
            .padding(28)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground { ZoeAtmosphere(glow: 0.3) }
    }
}

/// Above Day 1: where it began. The welcome, to watch again whenever.
private struct WelcomeAgainPage: View {
    let onWatch: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image("MountainLine")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 120)
                .foregroundStyle(Zoe.ink.opacity(0.7))
            Text("Where it began").zoeLabelStyle(Zoe.peach)
            Text("The welcome")
                .font(.zoeDisplay(44))
            Text("Return to the beginning: what this is, how the days work, and the film.")
                .font(.zoeSerif(.body).italic())
                .foregroundStyle(Zoe.inkMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: onWatch) {
                Text("Watch again")
                    .font(.zoeSerif(.title3))
                    .padding(.horizontal, 30)
                    .frame(minHeight: 50)
                    .overlay(Capsule().strokeBorder(Zoe.peach.opacity(0.6)))
                    .foregroundStyle(Zoe.peach)
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
            Spacer()
            Label("Day 1 is below", systemImage: "chevron.down")
                .zoeLabelStyle()
                .padding(.bottom, 24)
        }
        .padding(.horizontal, 36)
        .frame(maxWidth: .infinity)
    }
}

