"use client";
import { useEffect, useRef } from "react";

/** Aurora maroon–kuning yang bergerak pelan + grid + grain. */
export default function Background() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const x = c.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, cols = {};
    const readCols = () => {
      const cs = getComputedStyle(document.documentElement);
      cols = { a: cs.getPropertyValue("--blob-a").trim(), b: cs.getPropertyValue("--blob-b").trim(), c: cs.getPropertyValue("--blob-c").trim() };
    };
    const size = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const blobs = [
      { k: "a", r: 0.55, sx: 0.18, sy: 0.12, ox: 0.15, oy: 0.1, p: 0 },
      { k: "b", r: 0.42, sx: 0.13, sy: 0.17, ox: 0.85, oy: 0.2, p: 2 },
      { k: "c", r: 0.5, sx: 0.1, sy: 0.09, ox: 0.6, oy: 0.9, p: 4 },
    ];
    const draw = (t) => {
      x.clearRect(0, 0, w, h);
      const m = Math.max(w, h);
      for (const b of blobs) {
        const cx = (b.ox + Math.sin((t * b.sx) / 1000 + b.p) * 0.12) * w;
        const cy = (b.oy + Math.cos((t * b.sy) / 1000 + b.p) * 0.1) * h;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, b.r * m);
        g.addColorStop(0, cols[b.k] || "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }
    };
    const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduced) raf = requestAnimationFrame(loop); };
    const onResize = () => { size(); if (reduced) draw(0); };
    const obs = new MutationObserver(() => { readCols(); if (reduced) draw(0); });

    size(); readCols();
    if (reduced) draw(0); else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onScheme = () => { readCols(); if (reduced) draw(0); };
    mq.addEventListener?.("change", onScheme);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      obs.disconnect();
      mq.removeEventListener?.("change", onScheme);
    };
  }, []);

  return (
    <>
      <canvas id="bg" ref={ref} aria-hidden="true" />
      <div className="gridfx" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
