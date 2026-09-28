"use client";
import { useEffect, useRef } from "react";

/**
 * A warm desk lamp over the papers. On a desktop it drifts toward the cursor on a
 * critically damped spring, so the light lags your hand a little, the way a real
 * pool of light would. Parked (and off under reduced motion) on touch screens.
 */
export function DeskLamp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let x = window.innerWidth * 0.36;
    let y = window.innerHeight * 0.2;
    let tx = x;
    let ty = y;
    let vx = 0;
    let vy = 0;
    let raf = 0;
    let last = 0;
    const place = () => {
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000 || 0.016);
      last = now;
      // Critically damped spring (stiffness k, damping 2*sqrt(k)).
      const k = 26;
      const c = 2 * Math.sqrt(k);
      vx += ((tx - x) * k - vx * c) * dt;
      vy += ((ty - y) * k - vy * c) * dt;
      x += vx * dt;
      y += vy * dt;
      place();
      if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.6) raf = requestAnimationFrame(step);
      else raf = 0;
    };
    const kick = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      kick();
    };
    const onLeave = () => {
      tx = window.innerWidth * 0.36;
      ty = window.innerHeight * 0.2;
      kick();
    };
    place();
    el.classList.add("is-on");
    const follow = fine.matches && !reduce.matches;
    if (follow) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <div ref={ref} className="desk-lamp" aria-hidden />;
}
