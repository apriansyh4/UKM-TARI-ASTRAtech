"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icon";
import { avatarStyle, fmtJam, initials } from "@/lib/utils";

export function Hero({ kicker, title, hl, sub, children }) {
  return (
    <div className="hero">
      <div>
        <span className="kicker"><i />{kicker}</span>
        <h1>{title} {hl ? <span className="hl">{hl}</span> : null}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {children ? <div className="toolbar">{children}</div> : null}
    </div>
  );
}

export function MiniAv({ st }) {
  return <div className="mini-av" style={avatarStyle(st?.nim)}>{initials(st?.nama)}</div>;
}

export function Empty({ icon = "inbox", children }) {
  return <div className="empty"><Icon name={icon} />{children}</div>;
}

/** Angka yang beranimasi naik. */
export function CountUp({ value, decimals = 0 }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current, end = Number(value) || 0;
    if (reduced || start === end) { setV(end); from.current = end; return; }
    let raf; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3);
      const cur = start + (end - start) * e;
      setV(decimals ? cur : Math.round(cur));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);
  return <>{fmtJam(v)}</>;
}

export function Kpi({ icon, label, value, unit, decimals = 0, hero, className = "", children }) {
  return (
    <div className={`glass kpi ${hero ? "hero-k" : ""} ${className}`}>
      <div className="top"><small>{label}</small><span className="ic"><Icon name={icon} /></span></div>
      <div className="v"><CountUp value={value} decimals={decimals} /><span>{unit}</span></div>
      {children}
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 6 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>{Array.from({ length: cols }, (_, j) => <td key={j}><div className="skel" style={{ height: 14, width: j === 1 ? "80%" : "50%" }} /></td>)}</tr>
  ));
}

/** Tombol hapus 2 langkah (tanpa dialog browser). */
export function ConfirmDelete({ onConfirm, label = "Hapus", confirmLabel = "Yakin hapus?", iconOnly = true, className = "del" }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3500); return () => clearTimeout(t); }, [arm]);
  return (
    <button type="button" className={`${className} ${arm ? "confirm" : ""}`} aria-label={label} onClick={() => (arm ? (setArm(false), onConfirm()) : setArm(true))}>
      {arm ? confirmLabel : iconOnly ? <Icon name="trash" /> : <><Icon name="trash" />{label}</>}
    </button>
  );
}
