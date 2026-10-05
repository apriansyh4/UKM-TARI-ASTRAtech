"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../Icon";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { Empty, Hero, MiniAv } from "./ui";
import QrShare from "./QrShare";
import { DayStrip, EventSelect, NimField, ReasonBox, StatusPicker, StudentCard, SuccessOverlay } from "../checkin";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { REASONS, isPeserta, pesertaLabel, STATUS, STATUS_KEYS, eventRange, fmtJam, fmtLong, fmtShort, fmtTime, greeting, hrsOf, nowMinutesJakarta, pickSession, rangeOf, toMin, todayJakarta, dObj, clock, sesLoc } from "@/lib/utils";

function SessionProgress({ s }) {
  const [now, setNow] = useState(null);
  useEffect(() => { const f = () => setNow(nowMinutesJakarta()); f(); const id = setInterval(f, 15000); return () => clearInterval(id); }, []);
  if (!s || now === null) return null;
  const today = todayJakarta(), a = toMin(s.jam_mulai), b = toMin(s.jam_selesai);
  let pct = 0, txt = "", ic = "hourglass";
  const fmtM = (m) => `${Math.floor(m / 60) ? `${Math.floor(m / 60)} j ` : ""}${Math.round(m % 60)} mnt`;
  if (s.tanggal < today) { pct = 100; txt = "Sesi sudah selesai"; ic = "check"; }
  else if (s.tanggal > today) { const d = Math.round((dObj(s.tanggal) - dObj(today)) / 864e5); txt = `Mulai ${d} hari lagi`; }
  else if (now < a) txt = `Mulai dalam ${fmtM(a - now)}`;
  else if (now > b) { pct = 100; txt = "Sesi hari ini selesai"; ic = "check"; }
  else { pct = ((now - a) / (b - a)) * 100; txt = `Berlangsung · sisa ${fmtM(b - now)}`; ic = "pulse"; }
  return (
    <div className="ses-prog">
      <span className="ses-state"><Icon name={ic} />{txt}</span>
      <div className="track"><i style={{ width: `${pct}%` }} /></div>
      <div className="row"><span>{clock(s.jam_mulai)}</span><span>{fmtJam(hrsOf(s))} jam</span><span>{clock(s.jam_selesai)}</span></div>
    </div>
  );
}

function useBigClock() {
  const [t, setT] = useState({ hm: "--:--", s: "--", date: "", greet: "Live check-in" });
  useEffect(() => {
    const f = () => {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
      const g = (k) => p.find((x) => x.type === k)?.value || "00";
      setT({ hm: `${g("hour")}:${g("minute")}`, s: g("second"), date: new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short" }), greet: greeting() });
    };
    f(); const id = setInterval(f, 1000); return () => clearInterval(id);
  }, []);
  return { t };
}


/** Daftar peserta sesi: panitia cukup tap Hadir / Tidak per orang, tanpa melibatkan mahasiswa. */
function Roster({ ev, ses }) {
  const { students, att, stuMap, upsertAttLocal } = useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const [open, setOpen] = useState(null); // nim yang sedang pilih keterangan
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const people = useMemo(() => {
    const base = ev.peserta_only ? (ev.peserta || []).map((n) => stuMap.get(n)).filter(Boolean) : students;
    return [...base].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [ev, students, stuMap]);
  const rec = useMemo(() => new Map(att.filter((a) => a.session_id === ses.id).map((a) => [a.nim, a])), [att, ses.id]);
  const n = { hadir: 0, tidak: 0, belum: 0 };
  people.forEach((p) => { const r = rec.get(p.nim); n[r ? r.status : "belum"]++; });
  const list = people.filter((p) => {
    const r = rec.get(p.nim); const st = r ? r.status : "belum";
    const s = q.trim().toLowerCase();
    return (show === "all" || show === st) && (!s || `${p.nim} ${p.nama}`.toLowerCase().includes(s));
  });
  const needReason = ev.reason_required.includes("tidak");

  const mark = async (nims, status, reason = null) => {
    setBusy((b) => new Set([...b, ...nims]));
    try {
      const rows = nims.map((nim) => ({ session_id: ses.id, nim, status, reason, source: "admin" }));
      const { data, error } = await supabaseBrowser().from("attendances").upsert(rows, { onConflict: "session_id,nim" }).select("id,session_id,nim,status,reason,source,created_at,updated_at");
      if (error) throw error;
      (data || []).forEach(upsertAttLocal);
      if (nims.length > 1) toast(`${nims.length} peserta ditandai ${STATUS[status].toLowerCase()}`, "check");
      setOpen(null); setTxt("");
    } catch (e) { toast(errMsg(e), "x"); }
    finally { setBusy((b) => { const c = new Set(b); nims.forEach((x) => c.delete(x)); return c; }); }
  };
  const rest = people.filter((p) => !rec.has(p.nim)).map((p) => p.nim);
  const markRest = () => { if (!bulkConfirm) { setBulkConfirm(true); setTimeout(() => setBulkConfirm(false), 3500); return; } setBulkConfirm(false); mark(rest, "hadir"); };

  return (
    <div className="glass s12 roster">
      <div className="card-head">
        <h2><Icon name="users" />Daftar peserta <span className="meta" style={{ marginLeft: 6 }}>{pesertaLabel(ev)}</span></h2>
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input className="inp" placeholder="Cari peserta" aria-label="Cari peserta" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {rest.length ? <button type="button" className={`btn ${bulkConfirm ? "btn-gold" : "btn-ghost"} btn-sm`} onClick={markRest}><Icon name="check" />{bulkConfirm ? `Yakin? ${rest.length} orang jadi Hadir` : `Tandai sisa hadir (${rest.length})`}</button> : null}
        </div>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {[["all", `Semua ${people.length}`], ["belum", `Belum ${n.belum}`], ["hadir", `Hadir ${n.hadir}`], ["tidak", `Tidak hadir ${n.tidak}`]].map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>)}
      </div>
      {!ev.peserta_only ? <p className="hint-sm" style={{ margin: "0 0 12px" }}>Acara ini terbuka untuk semua mahasiswa. Atur peserta di menu Acara supaya daftar ini hanya berisi yang ikut.</p> : null}
      <div className="rlist">
        {list.length ? list.map((p) => {
          const r = rec.get(p.nim); const b = busy.has(p.nim);
          return (
            <div key={p.nim} className={`rrow ${r ? r.status : ""}`}>
              <MiniAv st={p} />
              <div className="rn"><b>{p.nama}</b><small className="mono">{p.nim} · {p.prodi}{r?.reason ? ` · ${r.reason}` : ""}{r?.source === "form" ? " · form" : ""}</small></div>
              <div className="rbtn">
                <button type="button" className="h" aria-pressed={r?.status === "hadir"} disabled={b} onClick={() => mark([p.nim], "hadir")}><Icon name="check" />Hadir</button>
                <button type="button" className="t" aria-pressed={r?.status === "tidak"} disabled={b} onClick={() => { setOpen(open === p.nim ? null : p.nim); setTxt(r?.status === "tidak" ? r.reason || "" : ""); }}><Icon name="x" />Tidak</button>
              </div>
              {open === p.nim ? (
                <div className="rreason">
                  {REASONS.map((x) => <button key={x} type="button" className="rc" onClick={() => mark([p.nim], "tidak", x)}>{x}</button>)}
                  <input className="inp" placeholder="Keterangan lain" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (txt.trim() || !needReason)) mark([p.nim], "tidak", txt.trim() || null); }} />
                  <button type="button" className="btn btn-gold btn-sm" disabled={needReason && !txt.trim()} onClick={() => mark([p.nim], "tidak", txt.trim() || null)}>Simpan</button>
                </div>
              ) : null}
            </div>
          );
        }) : <Empty icon="users">{people.length ? "Tidak ada yang cocok." : "Belum ada peserta. Atur di menu Acara → tombol peserta."}</Empty>}
      </div>
    </div>
  );
}

export default function AdminCheckin() {
  const { events, att, loading, stuMap, jamOf, upsertAttLocal } = useData();
  const toast = useToast();
  const { t: clockT } = useBigClock();
  const active = useMemo(() => events.filter((e) => e.is_active), [events]);
  const [evId, setEvId] = useState(null);
  const [sesId, setSesId] = useState(null);
  const [nim, setNim] = useState("");
  const [st, setSt] = useState(null);
  const [status, setStatus] = useState(null);
  const [chip, setChip] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!active.length) { setEvId(null); return; }
    if (!active.some((e) => e.id === evId)) { const t = todayJakarta(); setEvId((active.find((e) => e.sessions.some((s) => s.tanggal === t)) || active[0]).id); }
  }, [active, evId]);
  const ev = active.find((e) => e.id === evId) || null;
  useEffect(() => {
    if (!ev) { setSesId(null); return; }
    if (!ev.sessions.some((s) => s.id === sesId)) setSesId(pickSession(ev));
  }, [ev, sesId]);
  const ses = ev?.sessions.find((s) => s.id === sesId) || null;

  const required = !!(ev && status && ev.reason_required.includes(status));
  const reasonOpen = !!status && (status !== "hadir" || required);
  const ok = !!(ses && st && status && (!required || text.trim() || chip)) && !busy && !(ev && st && !isPeserta(ev, st.nim));

  const lookup = useCallback(async (v) => stuMap.get(v) || null, [stuMap]);

  const sesAtt = useMemo(() => att.filter((a) => a.session_id === sesId), [att, sesId]);
  const counts = useMemo(() => { const c = { hadir: 0, tidak: 0 }; sesAtt.forEach((a) => { if (a.status in c) c[a.status]++; }); return c; }, [sesAtt]);
  const sesJam = sesAtt.reduce((t, a) => t + jamOf(a), 0);
  const feed = useMemo(() => [...sesAtt].sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)).slice(0, 8), [sesAtt]);

  const stInfo = useMemo(() => {
    if (!st) return null;
    const mine = att.filter((a) => a.nim === st.nim);
    const evIds = new Set(ev?.sessions.map((s) => s.id));
    return {
      here: mine.filter((a) => evIds.has(a.session_id)).reduce((t, a) => t + jamOf(a), 0),
      all: mine.reduce((t, a) => t + jamOf(a), 0),
      dup: mine.find((a) => a.session_id === sesId),
      out: ev ? !isPeserta(ev, st.nim) : false,
    };
  }, [st, att, ev, sesId, jamOf]);

  // shortcut 1/2/3
  useEffect(() => {
    const onKey = (e) => {
      if (!st || !ev) return;
      const tg = e.target;
      if (tg.tagName === "TEXTAREA" || tg.tagName === "SELECT" || (tg.tagName === "INPUT" && tg.id !== "aNim")) return;
      const k = { 1: "hadir", 2: "tidak" }[e.key];
      if (k && ev.statuses.includes(k)) { e.preventDefault(); setStatus(k); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [st, ev]);

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const reason = [chip, text.trim()].filter(Boolean).join(" — ") || null;
      const { data, error } = await supabaseBrowser()
        .from("attendances")
        .upsert({ session_id: ses.id, nim: st.nim, status, reason, source: "admin" }, { onConflict: "session_id,nim" })
        .select("id,session_id,nim,status,reason,source,created_at,updated_at")
        .single();
      if (error) throw error;
      upsertAttLocal(data);
      const jam = status === "hadir" && ev.counts_jam_plus ? hrsOf(ses) : 0;
      setDone({ key: Date.now(), status, big: jam ? `+${fmtJam(jam)} jam` : STATUS[status], sub: `${st.nama} tercatat ${STATUS[status].toLowerCase()}` });
      if (stInfo?.dup) toast(`Absen ${st.nama.split(" ")[0]} diperbarui`, "refresh");
      setNim(""); setSt(null); setStatus(null); setChip(null); setText("");
      setTimeout(() => document.getElementById("aNim")?.focus(), 1900);
    } catch (err) {
      toast(errMsg(err), "x");
    } finally { setBusy(false); }
  };

  const R = 48, C = 2 * Math.PI * R, total = sesAtt.length, pct = total ? Math.round((counts.hadir / total) * 100) : 0;
  const colors = { hadir: "var(--gold)", tidak: "var(--maroon-2)" };
  let off = 0;

  return (
    <section>
      <Hero kicker={clockT.greet} title={<>Absen sekali tap,<br /></>} hl="jam plus langsung masuk.">
        <a className="btn btn-ghost" href="/" target="_blank" rel="noreferrer"><Icon name="external" />Buka form mahasiswa</a>
        <button className="btn btn-gold" onClick={() => setShare(true)}><Icon name="qr" />Bagikan form</button>
      </Hero>

      <div className="bento">
        <div className="glass s8">
          <div className="card-head"><h2><Icon name="spark" />Acara</h2><span className="meta">{active.length} aktif</span></div>
          {loading ? <div className="skel" style={{ height: 58, borderRadius: 16 }} /> : <EventSelect id="aEv" events={active} value={evId} onChange={(id) => { setEvId(id); setSesId(null); setStatus(null); }} sub={(e) => eventRange(e)} />}
          {ev ? (
            <>
              <div style={{ marginTop: 20 }}><span className="label">Tanggal sesi</span><DayStrip sessions={ev.sessions} value={sesId} onChange={setSesId} /></div>
              {ses ? (
                <div className="sesline">
                  <span><Icon name="calendar" /><b>{fmtLong(ses.tanggal)}</b></span>
                  <span><Icon name="clock" />{rangeOf(ses)}</span>
                  <span><Icon name="pin" />{sesLoc(ses, ev) || "-"}</span>
                  {ev.counts_jam_plus ? <span className="badge-g">+{fmtJam(hrsOf(ses))} jam plus</span> : <span>tanpa jam plus</span>}
                </div>
              ) : <Empty icon="calendar">Acara ini belum punya jadwal sesi.</Empty>}
            </>
          ) : null}
        </div>

        <div className="glass s4 clock-card">
          <div className="card-head" style={{ margin: 0 }}><h2><Icon name="clock" />Sekarang</h2><span className="meta">{clockT.date}</span></div>
          <div className="clock">{clockT.hm}<span>{clockT.s}</span></div>
          <SessionProgress s={ses} />
        </div>

        <form className="glass s7" onSubmit={submit} noValidate>
          <div className="steps"><div className={st ? "on" : ""}>01 · NIM</div><div className={st && status ? "on" : ""}>02 · Status</div><div className={ok ? "on" : ""}>03 · Kirim</div></div>
          <div className="form-gap">
            <div>
              <label className="label" htmlFor="aNim">Nomor Induk Mahasiswa</label>
              <NimField id="aNim" value={nim} onValue={setNim} lookup={lookup} onResult={(r) => setSt(r)} placeholder="Ketik NIM mahasiswa" />
              <div style={{ marginTop: st ? 16 : 0 }}>
                <StudentCard st={st} jamValue={stInfo?.here} jamLabel={`jam di acara ini · total ${fmtJam(stInfo?.all)}`}
                  warn={stInfo?.out ? "Bukan peserta acara ini. Tambahkan dulu lewat Acara → tombol peserta." : null}
                  note={stInfo?.dup ? `Sudah tercatat ${STATUS[stInfo.dup.status]} pukul ${fmtTime(stInfo.dup.updated_at || stInfo.dup.created_at)}. Kirim lagi untuk memperbarui.` : null} />
              </div>
            </div>
            <div><span className="label">Status kehadiran</span><StatusPicker allowed={ev?.statuses || []} value={status} onChange={setStatus} showKeys /></div>
            <ReasonBox id="aReason" open={reasonOpen} required={required} chip={chip} onChip={setChip} text={text} onText={setText} />
            <button className="btn btn-gold btn-xl" type="submit" disabled={!ok}>
              {busy ? <><span className="spin-s" />Menyimpan…</> : <><span>{status === "hadir" && ev?.counts_jam_plus && ses ? `Kirim absen · +${fmtJam(hrsOf(ses))} jam` : "Kirim absen"}</span><span className="kbd">Enter</span></>}
            </button>
          </div>
          <SuccessOverlay data={done} />
        </form>

        <div className="stack s5">
          <div className="glass">
            <div className="card-head"><h2><Icon name="pie" />Rekap sesi</h2><span className="meta">{ses ? fmtShort(ses.tanggal) : ""}</span></div>
            <div className="tally">
              <svg className="donut" viewBox="0 0 120 120" role="img" aria-label={`${pct}% hadir`}>
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--stroke-2)" strokeWidth="12" />
                {STATUS_KEYS.map((k) => {
                  const len = total ? (counts[k] / total) * C : 0; const o = off; off += len;
                  return len ? <circle key={k} cx="60" cy="60" r={R} fill="none" stroke={colors[k]} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-o} transform="rotate(-90 60 60)" /> : null;
                })}
                <text x="60" y="64" textAnchor="middle" fontSize="22" fontWeight="600">{pct}%</text>
                <text x="60" y="80" textAnchor="middle" fontSize="9" style={{ fontFamily: "var(--f-mono)", fill: "var(--muted)" }}>HADIR</text>
              </svg>
              <div className="legend">
                {STATUS_KEYS.map((k) => <div key={k}><span><i style={{ background: colors[k] }} />{STATUS[k]}</span><span className="num">{counts[k]}</span></div>)}
                <div className="tot"><span>Jam plus</span><span className="num">{fmtJam(sesJam)}</span></div>
              </div>
            </div>
          </div>
          <div className="glass">
            <div className="card-head"><h2><Icon name="pulse" />Baru masuk</h2><span className="meta">live</span></div>
            <ul className="feed">
              {feed.length ? feed.map((a) => {
                const s = stuMap.get(a.nim) || { nim: a.nim, nama: a.nim, prodi: "-" }; const j = jamOf(a);
                return (
                  <li key={a.id}>
                    <MiniAv st={s} />
                    <div style={{ minWidth: 0 }}><div className="nm">{s.nama}</div><div className="mt">{fmtTime(a.updated_at || a.created_at)} · {s.prodi}{a.source === "form" ? " · form" : ""}</div></div>
                    <span className={`tag ${a.status}`}>{j ? `+${fmtJam(j)} j` : STATUS[a.status]}</span>
                  </li>
                );
              }) : <li style={{ display: "block", background: "none", border: 0 }}><Empty>Belum ada absen di sesi ini.</Empty></li>}
            </ul>
          </div>
        </div>
      </div>
      {ev && ses ? <div className="bento" style={{ marginTop: 18 }}><Roster ev={ev} ses={ses} /></div> : null}
      <QrShare open={share} onClose={() => setShare(false)} path="/" title="Bagikan form absen" note="Tampilkan QR ini di layar saat latihan supaya mahasiswa bisa absen dari HP masing-masing." />
    </section>
  );
}
