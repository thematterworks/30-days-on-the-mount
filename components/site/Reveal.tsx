"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Arrives as it scrolls into view — the app's soft arrival: up a little,
 * out of a blur. `delay` staggers neighbours.
 */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`site-reveal ${shown ? "is-shown" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
