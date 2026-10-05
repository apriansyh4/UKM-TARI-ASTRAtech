"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "../Icon";
import Modal from "../Modal";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { ConfirmDelete, Empty, Hero } from "./ui";
import PesertaModal, { PesertaPicker, syncPeserta } from "./Peserta";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { CATEGORIES, CAT_ICON, STATUS, STATUS_KEYS, WEEKDAYS, datesBetween, dObj, eventRange, fmtJam, fmtShort, hhmm, hrsOf, locSummary, pesertaLabel, rangeOf, sesLoc, shiftDate, todayJakarta } from "@/lib/utils";

const tmpId = () => `new-${Math.random().toString(36).slice(2, 9)}`;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function EventForm({ open, initial, onClose, onSaved }) {
  const toast = useToast();
  const today = todayJakarta();
  const blank = () => ({ name: "", category: "Latihan", location: "", reason_required: ["tidak"], counts_jam_plus: true, dStart: "15:00", dEnd: "18:00", addDate: today, from: today, to: shiftDate(today, 13), wd: [...ALL_DAYS] });
  const [f, setF] = useState(blank);
  const [draft, setDraft] = useState([]);
  const [bulk, setBulk] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState(null);
  const [only, setOnly] = useState(true);
  const [sel, setSel] = useState(new Set());

  // isi ulang form saat modal dibuka untuk acara lain
  const key = open ? initial?.id || "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setErr(""); setNote(""); setBulk(false);
      if (initial) {
        const ds = initial.sessions.map((s) => s.tanggal).sort();
        const last = ds.at(-1);
        setF({ ...blank(), name: initial.name, category: initial.category, location: initial.location || "", reason_required: initial.reason_required.filter((k) => STATUS_KEYS.includes(k)), counts_jam_plus: initial.counts_jam_plus, addDate: last ? shiftDate(last, 1) : today, from: last ? shiftDate(last, 1) : today, to: last ? shiftDate(last, 14) : shiftDate(today, 13) });
        setDraft(initial.sessions.map((s) => ({ id: s.id, tanggal: s.tanggal, jam_mulai: hhmm(s.jam_mulai), jam_selesai: hhmm(s.jam_selesai), lokasi: s.lokasi || "" })));
        setOnly(!!initial.peserta_only); setSel(new Set(initial.peserta || []));
      } else {
        setF(blank());
        setDraft([]);
        setOnly(true); setSel(new Set());
      }
    }
  }

  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const toggleArr = (k, v) => setF((o) => ({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v] }));
  const rows = [...draft].sort((a, b) => (a.tanggal || "9999").localeCompare(b.tanggal || "9999"));
  const totalH = rows.reduce((t, s) => t + hrsOf(s), 0);
  const dupDates = useMemo(() => { const c = new Map(); draft.forEach((s) => s.tanggal && c.set(s.tanggal, (c.get(s.tanggal) || 0) + 1)); return new Set([...c].filter(([, n]) => n > 1).map(([d]) => d)); }, [draft]);
  const newRow = (t) => ({ id: tmpId(), tanggal: t, jam_mulai: f.dStart || "15:00", jam_selesai: f.dEnd || "18:00", lokasi: "", isNew: true });

  const addOne = () => {
    const t = f.addDate;
    if (!t) return setNote("Pilih tanggalnya dulu.");
    if (draft.some((s) => s.tanggal === t)) return setNote(`${fmtShort(t)} sudah ada di jadwal.`);
    setDraft((l) => [...l, newRow(t)]);
    set("addDate", shiftDate(t, 1));
    setNote(`${fmtShort(t)} ditambahkan. Atur jam dan lokasinya di daftar bawah.`); setErr("");
  };
  const addRange = () => {
    if (!f.from) return setNote("Isi tanggal mulai.");
    const to = f.to || f.from;
    if (to < f.from) return setNote("Tanggal akhir harus setelah tanggal mulai.");
    if (!f.wd.length) return setNote("Pilih minimal satu hari.");
    const have = new Set(draft.map((s) => s.tanggal));
    const add = datesBetween(f.from, to).filter((t) => f.wd.includes(dObj(t).getDay()) && !have.has(t));
    if (!add.length) return setNote("Tidak ada tanggal baru di rentang itu.");
    setDraft((l) => [...l, ...add.map(newRow)]);
    setNote(`${add.length} tanggal ditambahkan. Hapus yang tidak dipakai, lalu atur jam & lokasi tiap tanggal.`); setErr("");
  };
  const applyDefaults = () => {
    setDraft((l) => l.map((s) => ({ ...s, jam_mulai: f.dStart || s.jam_mulai, jam_selesai: f.dEnd || s.jam_selesai })));
    setNote("Jam default diterapkan ke semua tanggal.");
  };
  const upd = (id, k, v) => setDraft((l) => l.map((s) => (s.id === id ? { ...s, [k]: v } : s)));

  const save = async (e) => {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) return setErr("Nama acara belum diisi.");
    if (!rows.length) return setErr("Tambahkan minimal satu tanggal latihan.");
    if (rows.some((s) => !s.tanggal)) return setErr("Ada baris jadwal yang tanggalnya kosong.");
    if (dupDates.size) return setErr(`Tanggal dobel: ${[...dupDates].map(fmtShort).join(", ")}. Satu tanggal hanya boleh satu sesi.`);
    if (rows.some((s) => hrsOf(s) <= 0)) return setErr("Ada sesi dengan jam selesai sebelum jam mulai.");
    if (only && !sel.size) return setErr("Pilih minimal satu peserta di bagian Peserta acara, atau pilih mode Semua mahasiswa.");
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const payload = { name, category: f.category, location: f.location.trim() || null, statuses: [...STATUS_KEYS], reason_required: STATUS_KEYS.filter((k) => f.reason_required.includes(k)), counts_jam_plus: f.counts_jam_plus, peserta_only: only };
    const sesRow = (s) => ({ tanggal: s.tanggal, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai, lokasi: s.lokasi.trim() || null });
    try {
      let evId = initial?.id;
      let removedSessions = false;
      if (evId) {
        const { error } = await sb.from("events").update(payload).eq("id", evId);
        if (error) throw error;
        const keepIds = new Set(rows.filter((s) => !s.isNew).map((s) => s.id));
        const removed = initial.sessions.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
        if (removed.length) {
          const { error: e1 } = await sb.from("sessions").delete().in("id", removed);
          if (e1) throw e1;
          removedSessions = true;
        }
        for (const s of rows.filter((x) => !x.isNew)) {
          const old = initial.sessions.find((o) => o.id === s.id);
          if (old && (old.tanggal !== s.tanggal || hhmm(old.jam_mulai) !== s.jam_mulai || hhmm(old.jam_selesai) !== s.jam_selesai || (old.lokasi || "") !== s.lokasi.trim())) {
            const { error: e2 } = await sb.from("sessions").update(sesRow(s)).eq("id", s.id);
            if (e2) throw e2;
          }
        }
      } else {
        const { data, error } = await sb.from("events").insert(payload).select("id").single();
        if (error) throw error;
        evId = data.id;
      }
      const fresh = rows.filter((s) => s.isNew).map((s) => ({ event_id: evId, ...sesRow(s) }));
      if (fresh.length) {
        const { error: e3 } = await sb.from("sessions").insert(fresh);
        if (e3) throw e3;
      }
      await syncPeserta(sb, evId, initial?.peserta || [], only ? sel : new Set(initial?.peserta || []));
      toast(`${initial ? "Acara diperbarui" : "Acara dibuat"}${only ? ` · ${sel.size} peserta` : ""}`);
      onSaved(removedSessions);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };

  const removedCount = initial ? initial.sessions.filter((s) => !draft.some((d) => d.id === s.id)).length : 0;
  const defLoc = f.location.trim();

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Ubah acara" : "Acara baru"} width={860} as="form" onSubmit={save}>
      <div className="fg">
        <div className="full"><label className="label" htmlFor="f-name">Nama acara</label><input className="inp" id="f-name" placeholder="Latihan Wisuda ASTRAtech 2026" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></div>
        <div><label className="label" htmlFor="f-cat">Jenis</label><select className="select" id="f-cat" value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="f-loc">Lokasi default</label><input className="inp" id="f-loc" placeholder="Auditorium" value={f.location} onChange={(e) => set("location", e.target.value)} /></div>
        <div><label className="label" htmlFor="f-start">Jam mulai default</label><input className="inp" type="time" id="f-start" value={f.dStart} onChange={(e) => set("dStart", e.target.value)} /></div>
        <div><label className="label" htmlFor="f-end">Jam selesai default</label><input className="inp" type="time" id="f-end" value={f.dEnd} onChange={(e) => set("dEnd", e.target.value)} /></div>
        <p className="hint-sm full" style={{ margin: "-4px 0 0" }}>Nilai default dipakai untuk tanggal yang baru ditambahkan. Setiap tanggal tetap bisa punya jam dan lokasi sendiri.</p>

        <div className="full">
          <div className="sched-top">
            <span className="label" style={{ margin: 0 }}>Jadwal latihan <span className="sched-sum">{rows.length ? `· ${rows.length} tanggal · ${fmtJam(totalH)} jam` : ""}</span></span>
            {rows.length > 1 ? <button type="button" className="btn btn-ghost btn-sm" onClick={applyDefaults}><Icon name="refresh" />Samakan jam default</button> : null}
          </div>

          <div className="sched-add">
            <div className="row">
              <label className="sr-only" htmlFor="f-add">Tanggal latihan</label>
              <input className="inp" type="date" id="f-add" value={f.addDate} onChange={(e) => set("addDate", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }} />
              <button type="button" className="btn btn-gold btn-sm" onClick={addOne}><Icon name="plus" />Tambah tanggal</button>
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={bulk} onClick={() => setBulk(!bulk)}><Icon name="calendar" />Banyak sekaligus</button>
            </div>
            {bulk ? (
              <div className="sched-bulk">
                <div className="row">
                  <div><label className="label" htmlFor="f-from">Dari</label><input className="inp" type="date" id="f-from" value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
                  <div><label className="label" htmlFor="f-to">Sampai</label><input className="inp" type="date" id="f-to" value={f.to} onChange={(e) => set("to", e.target.value)} /></div>
                </div>
                <div>
                  <span className="label">Hanya hari</span>
                  <div className="wd">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" aria-pressed={f.wd.includes(d)} onClick={() => toggleArr("wd", d)}>{WEEKDAYS[d]}</button>)}</div>
                </div>
                <div><button type="button" className="btn btn-ghost btn-sm" onClick={addRange}><Icon name="plus" />Tambahkan tanggal di rentang ini</button></div>
              </div>
            ) : null}
            {note ? <p className="hint-sm" style={{ margin: 0 }}>{note}</p> : null}
          </div>

          {rows.length ? <div className="srow-head" aria-hidden="true"><span>Tanggal</span><span>Mulai</span><span>Selesai</span><span>Lokasi</span><span className="r">Jam</span><span /></div> : null}
          <div className="sched">
            {rows.length ? rows.map((s) => (
              <div className={`srow ${dupDates.has(s.tanggal) ? "dup" : ""}`} key={s.id}>
                <div className="sd"><span className="wl">{s.tanggal ? WEEKDAYS[dObj(s.tanggal).getDay()] : "–"}</span><input className="inp" type="date" value={s.tanggal} onChange={(e) => upd(s.id, "tanggal", e.target.value)} aria-label="Tanggal" /></div>
                <input className="inp sa" type="time" value={s.jam_mulai} onChange={(e) => upd(s.id, "jam_mulai", e.target.value)} aria-label={`Mulai ${s.tanggal ? fmtShort(s.tanggal) : ""}`} />
                <input className="inp sb" type="time" value={s.jam_selesai} onChange={(e) => upd(s.id, "jam_selesai", e.target.value)} aria-label={`Selesai ${s.tanggal ? fmtShort(s.tanggal) : ""}`} />
                <input className="inp sl" value={s.lokasi} placeholder={defLoc || "Lokasi"} onChange={(e) => upd(s.id, "lokasi", e.target.value)} aria-label={`Lokasi ${s.tanggal ? fmtShort(s.tanggal) : ""}`} />
                <span className="h">{fmtJam(hrsOf(s))} j</span>
                <button type="button" className="del" onClick={() => setDraft((l) => l.filter((x) => x.id !== s.id))} aria-label={`Hapus ${s.tanggal ? fmtShort(s.tanggal) : "baris"}`}><Icon name="x" /></button>
              </div>
            )) : <Empty icon="calendar">Belum ada tanggal. Pilih tanggal latihan di atas lalu klik Tambah tanggal. Tanggal tidak harus berurutan.</Empty>}
          </div>
          {rows.length ? <p className="hint-sm" style={{ margin: "8px 0 0" }}>Lokasi yang dikosongkan memakai lokasi default{defLoc ? ` (${defLoc})` : ""}.</p> : null}
          {removedCount ? <p className="hint-sm" style={{ color: "var(--rose)", margin: "8px 0 0" }}>{removedCount} sesi akan dihapus beserta data absennya saat disimpan.</p> : null}
        </div>
        <div className="full"><span className="label">Keterangan wajib untuk</span><div className="checks">{STATUS_KEYS.map((k) => <label className="ck" key={k}><input type="checkbox" checked={f.reason_required.includes(k)} onChange={() => toggleArr("reason_required", k)} /> {STATUS[k]}</label>)}</div></div>
        <div className="full checks"><label className="ck"><input type="checkbox" checked={f.counts_jam_plus} onChange={(e) => set("counts_jam_plus", e.target.checked)} /> Kehadiran dihitung jam plus</label></div>
        <div className="full ev-pes">
          <div className="sched-top"><span className="label" style={{ margin: 0 }}>Peserta acara <span className="sched-sum">{only ? `· ${sel.size} dipilih` : "· semua mahasiswa"}</span></span></div>
          {open ? <PesertaPicker key={initial?.id || "new"} only={only} setOnly={setOnly} sel={sel} setSel={setSel} compact /> : null}
        </div>
      </div>
      {err ? <div className="err" style={{ marginTop: 16 }}><Icon name="x" />{err}</div> : null}
      <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 24 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? <><span className="spin-s" />Menyimpan…</> : "Simpan acara"}</button>
      </div>
    </Modal>
  );
}

export default function Acara() {
  const { events, att, loading, jamOf, loadEvents, loadAtt } = useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState({ open: false, ev: null });
  const [pes, setPes] = useState(null);
  const today = todayJakarta();
  const maxH = Math.max(1, ...events.flatMap((e) => e.sessions.map(hrsOf)));

  const stats = useMemo(() => {
    const m = new Map();
    events.forEach((e) => {
      const ids = new Set(e.sessions.map((s) => s.id));
      const rs = att.filter((a) => ids.has(a.session_id));
      m.set(e.id, { n: rs.length, jam: rs.reduce((t, a) => t + jamOf(a), 0) });
    });
    return m;
  }, [events, att, jamOf]);

  const list = events.filter((e) => !q.trim() || `${e.name} ${e.category} ${e.location || ""} ${e.sessions.map((x) => x.lokasi || "").join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));

  const toggle = async (e) => {
    try {
      const { error } = await supabaseBrowser().from("events").update({ is_active: !e.is_active }).eq("id", e.id);
      if (error) throw error;
      await loadEvents();
      toast(!e.is_active ? "Acara dibuka untuk absen" : "Acara ditutup dari absen", !e.is_active ? "check" : "minus");
    } catch (err) { toast(errMsg(err), "x"); }
  };
  const remove = async (e) => {
    try {
      const { error } = await supabaseBrowser().from("events").delete().eq("id", e.id);
      if (error) throw error;
      await Promise.all([loadEvents(), loadAtt()]);
      toast("Acara dan data absennya dihapus", "trash");
    } catch (err) { toast(errMsg(err), "x"); }
  };

  return (
    <section>
      <Hero kicker="Acara" title="Kelola" hl="acara & sesi" sub="Satu acara bisa punya tanggal latihan bebas (tidak harus berurutan), dengan jam dan lokasi berbeda tiap tanggal. Durasi tiap sesi menjadi jam plus bagi yang hadir.">
        <div className="search" style={{ minWidth: 220 }}><Icon name="search" /><input className="inp" placeholder="Cari acara" aria-label="Cari acara" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Link className="btn btn-ghost" href="/admin/import?type=acara"><Icon name="upload" />Import</Link>
        <button className="btn btn-gold" onClick={() => setModal({ open: true, ev: null })}><Icon name="plus" />Acara baru</button>
      </Hero>

      <div className="ev-grid">
        {loading ? Array.from({ length: 3 }, (_, i) => <div key={i} className="glass"><div className="skel" style={{ height: 200 }} /></div>) : list.map((e) => {
          const s = stats.get(e.id) || { n: 0, jam: 0 };
          const tot = e.sessions.reduce((t, x) => t + hrsOf(x), 0);
          return (
            <article key={e.id} className={`glass ev-card ${e.is_active ? "" : "off"}`}>
              <div className="ev-top">
                <div className="ev-ico"><Icon name={CAT_ICON[e.category] || "flag"} /></div>
                <label className="switch" title="Buka untuk absen"><input type="checkbox" checked={e.is_active} onChange={() => toggle(e)} aria-label={`Buka ${e.name} untuk absen`} /><span /></label>
              </div>
              <div><div className="meta">{e.category.toUpperCase()}{e.counts_jam_plus ? " · JAM PLUS" : ""}{e.is_active ? "" : " · DITUTUP"}</div><div className="ev-name" style={{ marginTop: 4 }}>{e.name}</div></div>
              <div className="ev-info">
                <span><Icon name="calendar" />{eventRange(e)} · {e.sessions.length} sesi</span>
                <span><Icon name="pin" />{locSummary(e)}</span>
                <button type="button" className={`pes-chip ${e.peserta_only ? "on" : ""}`} onClick={() => setPes(e.id)} title="Atur peserta acara"><Icon name="users" />{pesertaLabel(e)}<Icon name="edit" /></button>
              </div>
              <div className="timeline" aria-hidden="true">
                {e.sessions.map((x) => <i key={x.id} className={x.tanggal <= today ? "past" : ""} style={{ height: 12 + (hrsOf(x) / maxH) * 36 }} title={`${fmtShort(x.tanggal)} · ${rangeOf(x)}${sesLoc(x, e) ? ` · ${sesLoc(x, e)}` : ""}`} />)}
              </div>
              <div className="ev-foot">
                <span className="meta">{s.n} absen · <span className="jam">{fmtJam(s.jam)}</span> / {fmtJam(tot)} j</span>
                <div className="row-act">
                  <ConfirmDelete label={`Hapus ${e.name}`} confirmLabel={s.n ? `Hapus + ${s.n} absen?` : "Yakin hapus?"} onConfirm={() => remove(e)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal({ open: true, ev: e })}><Icon name="edit" />Ubah</button>
                </div>
              </div>
            </article>
          );
        })}
        {!loading ? (
          <button className="glass add-card" type="button" onClick={() => setModal({ open: true, ev: null })}>
            <div><div className="plus"><Icon name="plus" /></div><b>Buat acara baru</b><div className="meta" style={{ marginTop: 4 }}>latihan, rapat, kepanitiaan</div></div>
          </button>
        ) : null}
      </div>
      {!loading && events.length && !list.length ? <Empty icon="search">Tidak ada acara yang cocok.</Empty> : null}

      <PesertaModal open={!!pes} ev={events.find((x) => x.id === pes) || null} onClose={() => setPes(null)} onSaved={async () => { setPes(null); await loadEvents(); }} />
      <EventForm open={modal.open} initial={modal.ev} onClose={() => setModal({ open: false, ev: null })}
        onSaved={async (removed) => { setModal({ open: false, ev: null }); await loadEvents(); if (removed) await loadAtt(); }} />
    </section>
  );
}
