"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { STATUS, STATUS_KEYS, ST_ICON, REASONS, CAT_ICON, PRODI, initials, fmtJam, fmtLong, fmtWeekday, pad, dObj, rangeOf, sortByDate, todayJakarta, hrsOf } from "@/lib/utils";

/** Input NIM dengan animasi scan + lookup ber-debounce. lookup(nim) => Promise<student|null> */
export function NimField({ id, value, onValue, lookup, onResult, autoFocus, placeholder = "Ketik NIM kamu", registerHref }) {
  const [state, setState] = useState("idle");
  const timer = useRef();
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (raw) => {
    const v = raw.replace(/\D/g, "").slice(0, 15);
    onValue(v);
    clearTimeout(timer.current);
    onResult(null, v);
    if (v.length < 4) { setState("idle"); return; }
    setState("scanning");
    const my = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const st = await lookup(v);
        if (my !== seq.current) return;
        setState(st ? "ok" : v.length >= 8 ? "notfound" : "idle");
        onResult(st || null, v);
      } catch (e) {
        if (my !== seq.current) return;
        setState("error");
        onResult(null, v, e);
      }
    }, 550);
  };

  return (
    <>
      <div className={`nim-wrap ${state === "scanning" ? "scanning" : ""}`}>
        <Icon name="finger" />
        <input
          id={id}
          className="nim"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          maxLength={15}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => change(e.target.value)}
        />
        <div className="nim-state" aria-hidden="true">{state === "ok" ? <span className="ok"><Icon name="check" /></span> : null}</div>
        <div className="scan" />
      </div>
      {state === "notfound" ? (
        <div className="note err" style={{ flexWrap: "wrap" }}><Icon name="x" /><span>NIM {value} belum terdaftar.</span>
          {registerHref ? <a className="reg-link" href={registerHref}>Daftar sekarang <Icon name="arrow" /></a> : <span>Hubungi panitia untuk didaftarkan.</span>}
        </div>
      ) : null}
      {state === "error" ? <div className="note err"><Icon name="x" />Gagal memeriksa NIM. Cek koneksi lalu coba lagi.</div> : null}
    </>
  );
}

export function StudentCard({ st, jamLabel, jamValue, note, warn }) {
  if (!st) return null;
  return (
    <>
      <div className="idcard">
        <div className="idcard-in">
          <div className="avatar">{initials(st.nama)}</div>
          <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
            <div className="id-name">{st.nama}</div>
            <div className="id-meta"><span className="mono">{st.nim}</span><span>{PRODI[st.prodi] || st.prodi}</span><span>Semester {st.semester}</span></div>
          </div>
          <div className="id-jam"><b>{fmtJam(jamValue)}</b><small>{jamLabel}</small></div>
        </div>
      </div>
      {warn ? <div className="note warn"><Icon name="x" />{warn}</div> : note ? <div className="note"><Icon name="refresh" />{note}</div> : null}
    </>
  );
}

export function StatusPicker({ allowed = STATUS_KEYS, value, onChange, showKeys }) {
  return (
    <div className="status-grid" role="radiogroup" aria-label="Status kehadiran">
      {STATUS_KEYS.map((k, i) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className="st" data-s={k} disabled={!allowed.includes(k)} onClick={() => onChange(k)}>
          <span className="ic"><Icon name={ST_ICON[k]} /></span>
          <span><b>{STATUS[k]}</b></span>
          {showKeys ? <span className="kbd">{i + 1}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ReasonBox({ open, required, chip, onChip, text, onText, id = "reason" }) {
  return (
    <div className={`reason-box ${open ? "open" : ""}`}>
      <div>
        <label className="label" htmlFor={id}>Keterangan {required ? <span className="req">· wajib</span> : null}</label>
        <div className="reasons">
          {REASONS.map((r) => (
            <button key={r} type="button" className="rc" tabIndex={open ? 0 : -1} aria-pressed={chip === r} onClick={() => onChip(chip === r ? null : r)}>{r}</button>
          ))}
        </div>
        <textarea id={id} tabIndex={open ? 0 : -1} placeholder="Tulis alasan lain di sini" maxLength={280} value={text} onChange={(e) => onText(e.target.value)} />
      </div>
    </div>
  );
}

/** Overlay sukses dengan animasi centang + percikan. data: {status, big, sub, key} */
export function SuccessOverlay({ data }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!data) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), data.hold || 1900);
    return () => clearTimeout(t);
  }, [data]);
  if (!data) return <div className="success" />;
  const path = data.status === "hadir" ? "M32 51l12 12 24-26" : data.status === "tidak" ? "M36 36l28 28M64 36L36 64" : "M34 50h32";
  const sparks = data.status === "hadir" ? Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2, d = 70 + ((i * 37) % 50);
    return <i key={i} className="spark" style={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, "--rot": `${i * 47}deg`, background: i % 3 ? "var(--gold)" : "var(--maroon-2)" }} />;
  }) : null;
  return (
    <div className={`success ${show ? "show" : ""}`} aria-live="assertive" key={data.key}>
      <div>
        {sparks}
        <svg className="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" /><path d={path} /></svg>
        <div className="big">{data.big}</div>
        <p>{data.sub}</p>
      </div>
    </div>
  );
}

/** Dropdown pilih acara dengan ikon kategori. */
export function EventSelect({ id, events, value, onChange, sub, emptyText = "Belum ada acara aktif" }) {
  const cur = events.find((e) => e.id === value);
  return (
    <div className="ev-select">
      <span className="ico"><Icon name={CAT_ICON[cur?.category] || "calendar"} /></span>
      <select id={id} className="select" value={value || ""} disabled={!events.length} onChange={(e) => onChange(e.target.value)} aria-label="Pilih acara">
        {events.length ? events.map((e) => <option key={e.id} value={e.id}>{e.name}{sub ? ` · ${sub(e)}` : ""}</option>) : <option value="">{emptyText}</option>}
      </select>
    </div>
  );
}

export function DayStrip({ sessions, value, onChange, meta }) {
  const ref = useRef(null);
  const today = todayJakarta();
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-pressed="true"]');
    if (el && ref.current) {
      const box = ref.current;
      box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    }
  }, [value, sessions]);
  return (
    <div className="days" ref={ref}>
      {[...sessions].sort(sortByDate).map((s) => (
        <button key={s.id} type="button" className={`day ${s.tanggal === today ? "today" : ""} ${s.tanggal > today ? "future" : ""}`} aria-pressed={s.id === value} title={`${fmtLong(s.tanggal)} · ${rangeOf(s)}${s.lokasi ? ` · ${s.lokasi}` : ""}`} onClick={() => onChange(s.id)}>
          <span className="dw">{fmtWeekday(s.tanggal)}</span>
          <span className="dn">{pad(dObj(s.tanggal).getDate())}</span>
          <span className="dw">{meta ? meta(s) : `${fmtJam(hrsOf(s))} j`}</span>
        </button>
      ))}
    </div>
  );
}
