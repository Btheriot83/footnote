"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/sample/acme-renewal.mp3";
let shared: HTMLAudioElement | null = null;
let owner = 0;

/**
 * The landing page's "hear it": plays a few seconds of the sample call without
 * pulling the app's audio stack into the landing bundle. The file is only fetched
 * on the first press.
 */
export function useSampleClip() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const [id] = useState(() => ++owner);
  const me = useRef(id);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (shared && owner === me.current) shared.pause();
    setPlaying(null);
    setProgress(0);
  }, []);

  const play = useCallback(
    async (key: string, fromMs: number, toMs: number) => {
      if (playing === key) {
        stop();
        return;
      }
      cancelAnimationFrame(raf.current);
      if (!shared) {
        shared = new Audio(SRC);
        shared.preload = "auto";
      }
      owner = me.current;
      const a = shared;
      a.pause();
      setPlaying(key);
      setProgress(0);
      try {
        if (a.readyState < 1) {
          await new Promise<void>((ok, fail) => {
            a.addEventListener("loadedmetadata", () => ok(), { once: true });
            a.addEventListener("error", () => fail(new Error("audio")), { once: true });
          });
        }
        a.currentTime = fromMs / 1000;
        await a.play();
        const tick = () => {
          if (owner !== me.current) {
            setPlaying(null);
            setProgress(0);
            return;
          }
          const pos = a.currentTime * 1000;
          setProgress(Math.min(1, Math.max(0, (pos - fromMs) / (toMs - fromMs))));
          if (pos >= toMs || a.paused) {
            a.pause();
            setPlaying(null);
            setProgress(0);
            return;
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      } catch {
        setPlaying(null);
      }
    },
    [playing, stop],
  );

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    if (shared && owner === me.current) shared.pause();
  }, []);

  return { playing, progress, play, stop };
}
