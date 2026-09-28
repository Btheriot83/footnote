"use client";
import { useEffect } from "react";

/** Sets each `.reveal` paper down on the desk as it scrolls into view. */
export function Reveal() {
  useEffect(() => {
    const arrivals = Array.from(document.querySelectorAll<HTMLElement>(".arrive:not(.is-in)"));
    requestAnimationFrame(() => requestAnimationFrame(() => arrivals.forEach((el) => el.classList.add("is-in"))));
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <noscript>
      <style>{`.reveal,.arrive{opacity:1!important;transform:none!important}`}</style>
    </noscript>
  );
}
