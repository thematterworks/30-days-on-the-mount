"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { DayCard, type DayState } from "./DayCard";

export interface JourneyDay {
  day_number: number;
  title: string;
}

/**
 * The home screen: a full-viewport vertical stack of day cards with
 * magnetic snap-scroll. Native CSS scroll-snap does the physics (60fps, no
 * JS scroll-jank); Framer Motion only drives the "mountain scale" — cards
 * shrink and dim as they leave the vertical center, so distant days feel
 * far without a flat gray-out. On open, the active day is scrolled to
 * center.
 */
export function JourneyStack({ days, currentDay }: { days: JourneyDay[]; currentDay: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="journey-scroll h-dvh snap-y snap-mandatory overflow-y-scroll">
      {days.map((day) => {
        const state: DayState =
          day.day_number < currentDay ? "completed" : day.day_number === currentDay ? "active" : "locked";
        return (
          <StackItem
            key={day.day_number}
            day={day}
            state={state}
            isActive={state === "active"}
            containerRef={containerRef}
          />
        );
      })}
    </div>
  );
}

function StackItem({
  day,
  state,
  isActive,
  containerRef,
}: {
  day: JourneyDay;
  state: DayState;
  isActive: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  // Center the active day on first paint, so the participant opens the app
  // already looking at today rather than Day 1.
  useEffect(() => {
    if (isActive) {
      itemRef.current?.scrollIntoView({ block: "center" });
    }
  }, [isActive]);

  const { scrollYProgress } = useScroll({
    target: itemRef,
    container: containerRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.86, 1, 0.86]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.45, 1, 0.45]);

  return (
    <div ref={itemRef} className="flex h-dvh snap-center items-center justify-center px-6">
      <motion.div style={{ scale, opacity }} className="w-full max-w-sm">
        <DayCard dayNumber={day.day_number} title={day.title} state={state} />
      </motion.div>
    </div>
  );
}
