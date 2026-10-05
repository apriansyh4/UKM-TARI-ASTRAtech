"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "../Icon";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { Hero } from "./ui";
import { BULK_TYPES, buildTemplate, parseText, sheetRows, validateBulk } from "@/lib/bulk";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { CATEGORIES, PRODI, PRODI_KEYS, STATUS_KEYS } from "@/lib/utils";

const OPTIONAL = { acara: ["jenis", "lokasi"], absen: ["keterangan"] };
const AFTER = { mhs: "/admin/mahasiswa", acara: "/admin/acara", peserta: "/admin/acara", absen: "/admin/laporan" };
const loadXlsx = async () => { const m = await import("xlsx-js-style"); return m.default || m; };
const chunks = (arr, n = 500) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export default function Import() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { events, att, stuMap, loadStudents, loadEvents, loadAtt } = useData();
  const [type, setType] = useState(BULK_TYPES[params.get("type")] ? params.get("type") : "mhs");
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState(null);
  const [src, setSrc] = useState("");
  const [filter, setFilter] = useState("all");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const resRef = useRef(null);
  const T = BULK_TYPES[type];

  const ctx = useMemo(() => ({
    PRODI, CATEGORIES,
    students: stuMap,
    events: events.map((e) => ({ id: e.id, name: e.name, pesertaOnly: !!e.peserta_only, peserta: e.peserta || [], sessions: e.sessions.map((s) => ({ id: s.id, date: s.tanggal })) })),
    attKeys: new Set(att.map((a) => `${a.session_id}|${a.nim}`)),
  }), [events, att, stuMap]);

  const pickType = (k) => { setType(k); setResult(null); setSrc(""); setPaste(""); };

  const run = (rows, label) => {
    const r = validateBulk(type, rows, ctx);
    setResult(r); setSrc(label); setFilter("all");
    if (!r.items.length) toast("Tidak ada baris data yang terbaca", "x");
    else setTimeout(() => resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const readFile = async (f) => {
    if (!f) return;
    try {
      if (/\.(csv|txt)$/i.test(f.name)) return run(parseText(await f.text()), `File: ${f.name}`);
      const XLSX = await loadXlsx();
      const { rows, sheet, sheets } = sheetRows(XLSX, new Uint8Array(await f.arrayBuffer()), type);
      run(rows, `File: ${f.name}${sheets.length > 1 ? ` · sheet "${sheet}"` : ""}`);
    } catch {
      toast("File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv", "x");
    }
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await loadXlsx();
      XLSX.writeFile(buildTemplate(XLSX, PRODI, CATEGORIES), "Template-Import-STAMPTech-Plus.xlsx", { compression: true });
      toast("Template diunduh", "download");
    } catch (e) { toast("Gagal membuat template: " + (e.message || e), "x"); }
  };

  const commit = async () => {
    const items = (result?.items || []).filter((i) => i.ok);
    if (!items.length) return;
    setBusy(true);
    const sb = supabaseBrowser();
    try {
      let msg = "";
      if (type === "mhs") {
        const rows = items.map(({ data: d }) => ({ nim: d.nim, nama: d.nama, prodi: d.prodi, semester: d.semester }));
        for (const part of chunks(rows)) {
          const { error } = await sb.from("students").upsert(part, { onConflict: "nim" });
          if (error) throw error;
        }
        const upd = items.filter((i) => i.action === "Perbarui").length;
        msg = `${rows.length - upd} mahasiswa baru${upd ? `, ${upd} diperbarui` : ""}`;
        await loadStudents();
      }
      if (type === "acara") {
        const newNames = new Map();
        items.forEach(({ data: d }) => { if (!d.evId && !newNames.has(d.name.toLowerCase())) newNames.set(d.name.toLowerCase(), d); });
        const idByName = new Map();
        if (newNames.size) {
          const payload = [...newNames.values()].map((d) => ({ name: d.name, category: d.cat, location: d.loc || null, statuses: [...STATUS_KEYS], reason_required: ["tidak"], counts_jam_plus: true, is_active: true }));
          const { data, error } = await sb.from("events").insert(payload).select("id,name");
          if (error) throw error;
          data.forEach((e) => idByName.set(e.name.toLowerCase(), e.id));
        }
        const rows = items.map(({ data: d }) => ({ event_id: d.evId || idByName.get(d.name.toLowerCase()), tanggal: d.date, jam_mulai: d.start, jam_selesai: d.end, lokasi: d.loc || null }));
        for (const part of chunks(rows)) {
          const { error } = await sb.from("sessions").upsert(part, { onConflict: "event_id,tanggal" });
          if (error) throw error;
        }
        const upd = items.filter((i) => i.action === "Ubah sesi").length;
        msg = `${newNames.size} acara baru, ${rows.length - upd} sesi ditambahkan${upd ? `, ${upd} sesi diubah` : ""}`;
        await loadEvents();
      }
      if (type === "peserta") {
        const rows = items.map(({ data: d }) => ({ event_id: d.evId, nim: d.nim }));
        for (const part of chunks(rows)) {
          const { error } = await sb.from("event_participants").upsert(part, { onConflict: "event_id,nim", ignoreDuplicates: true });
          if (error) throw error;
        }
        const evIds = [...new Set(rows.map((r) => r.event_id))];
        const { error: e2 } = await sb.from("events").update({ peserta_only: true }).in("id", evIds);
        if (e2) throw e2;
        const already = items.filter((i) => i.action === "Sudah peserta").length;
        msg = `${rows.length - already} peserta ditambahkan ke ${evIds.length} acara${already ? `, ${already} sudah terdaftar` : ""}`;
        await loadEvents();
      }
      if (type === "absen") {
        const rows = items.map(({ data: d }) => ({ session_id: d.sesId, nim: d.nim, status: d.status, reason: d.reason, source: "admin" }));
        for (const part of chunks(rows)) {
          const { error } = await sb.from("attendances").upsert(part, { onConflict: "session_id,nim" });
          if (error) throw error;
        }
        const upd = items.filter((i) => i.action === "Perbarui").length;
        msg = `${rows.length - upd} absen baru${upd ? `, ${upd} diperbarui` : ""}`;
        await loadAtt();
      }
      const skipped = result.items.length - items.length;
      toast(`Berhasil: ${msg}${skipped ? ` · ${skipped} baris dilewati` : ""}`, "upload");
      setResult(null); setSrc(""); setPaste("");
      router.push(AFTER[type]);
    } catch (e) {
      toast(`Import gagal: ${errMsg(e)}. Sebagian data mungkin sudah tersimpan; import ulang aman karena data yang sama diperbarui, tidak dobel.`, "x");
    } finally {
      setBusy(false);
    }
  };

  const items = result?.items || [];
  const ok = items.filter((i) => i.ok), bad = items.filter((i) => !i.ok), warn = ok.filter((i) => i.warns.length);
  const list = items.filter((i) => filter === "all" || (filter === "ok" ? i.ok : !i.ok));
  const opt = OPTIONAL[type] || [];

  return (
    <section>
      <Hero kicker="Import" title="Import data" hl="massal" sub="Upload file Excel / CSV atau tempel langsung dari spreadsheet. Semua baris dicek dulu, baru disimpan. Tidak perlu input satu per satu.">
        <button className="btn btn-ghost" onClick={downloadTemplate}><Icon name="download" />Unduh template Excel</button>
      </Hero>

      <div className="bento">
        <div className="glass s12">
          <span className="label">1 · Pilih jenis data</span>
          <div className="imp-types">
            {Object.entries(BULK_TYPES).map(([k, t]) => (
              <button key={k} type="button" className="imp-type" aria-pressed={k === type} onClick={() => pickType(k)}>
                <span className="ic"><Icon name={t.icon} /></span><b>{t.label}</b><span className="d">{t.desc}</span>
              </button>
            ))}
          </div>
          <div className="imp-cols">
            <span>Kolom:</span>
            {T.cols.map(([k, l]) => <span key={k} className={`colchip ${opt.includes(k) ? "opt" : ""}`}>{l}{opt.includes(k) ? " (opsional)" : ""}</span>)}
            {type === "mhs" ? <span>· Prodi pakai kode: {PRODI_KEYS.join(", ")}</span> : null}
          </div>
        </div>

        <div className="glass s12">
          <span className="label">2 · Masukkan data</span>
          <div className="imp-input">
            <label className={`drop ${over ? "over" : ""}`}
              onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setOver(false); }} onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer?.files?.[0]); }}>
              <input type="file" accept=".xlsx,.xls,.csv,.txt" aria-label="Pilih file Excel atau CSV" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
              <span className="big-ic"><Icon name="upload" /></span>
              <b>Pilih file atau tarik ke sini</b>
              <span>Excel (.xlsx, .xls) atau CSV · sheet dipilih otomatis</span>
            </label>
            <div className="paste">
              <textarea aria-label="Tempel data dari spreadsheet" value={paste} onChange={(e) => setPaste(e.target.value)}
                placeholder={`Tempel dari Excel / Google Sheets (termasuk judul kolom), contoh:\n${T.cols.map(([, l]) => l).join("\t")}\n${T.example[0].join("\t")}`} />
              <button className="btn btn-gold" type="button" onClick={() => (paste.trim() ? run(parseText(paste), "Data tempelan") : toast("Tempel data dulu di kotak teks", "x"))}>
                <Icon name="search" />Cek data tempelan
              </button>
            </div>
          </div>
          {src ? <div className="imp-src meta"><Icon name="sheet" />{src}</div> : null}
        </div>

        {items.length ? (
          <div className="glass s12" ref={resRef}>
            <div className="card-head">
              <h2><Icon name="sheet" />3 · Pratinjau & hasil cek</h2>
              <div className="seg">
                {[["all", "Semua"], ["ok", "Valid"], ["bad", "Bermasalah"]].map(([f, l]) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{l}</button>)}
              </div>
            </div>
            <div className="imp-sum">
              <span className="sum-chip"><Icon name="sheet" />{items.length} baris</span>
              <span className="sum-chip ok"><Icon name="check" />{ok.length} valid</span>
              {bad.length ? <span className="sum-chip bad"><Icon name="x" />{bad.length} bermasalah</span> : null}
              {warn.length ? <span className="sum-chip warn"><Icon name="refresh" />{warn.length} disesuaikan otomatis</span> : null}
            </div>
            {result.missing.length ? (
              <div className="banner" style={{ marginBottom: 14 }}><Icon name="x" /><span>Kolom tidak ditemukan: <b>{result.missing.join(", ")}</b>. Pastikan baris pertama berisi judul kolom seperti di template, atau urutan kolom sama persis.</span></div>
            ) : null}
            <div className="tbl">
              <table>
                <thead><tr><th>Baris</th>{T.cols.map(([k, l]) => <th key={k}>{l}</th>)}<th>Aksi</th><th>Hasil cek</th></tr></thead>
                <tbody>
                  {list.length ? list.map((i) => (
                    <tr key={i.line} className={i.ok ? "" : "bad"}>
                      <td className="dim mono">{i.line}</td>
                      {i.cells.map((c, k) => <td key={k}>{c || <span className="dim">–</span>}</td>)}
                      <td>{i.ok ? <span className={`act-tag ${/baru|tambah/i.test(i.action) ? "new" : ""}`}>{i.action}</span> : <span className="dim">–</span>}</td>
                      <td>
                        <div className={`row-st ${i.ok ? "ok" : "bad"}`}>
                          {i.ok ? <span>Siap disimpan</span> : i.errs.map((e) => <span key={e}>{e}</span>)}
                          {i.warns.map((w) => <small key={w}>{w}</small>)}
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={T.cols.length + 3}><div className="empty">Tidak ada baris di filter ini.</div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="imp-actions">
              <button className="btn btn-ghost" type="button" onClick={() => { setResult(null); setSrc(""); setPaste(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="refresh" />Ulangi</button>
              <button className="btn btn-gold" type="button" disabled={!ok.length || busy} onClick={commit}>
                {busy ? <><span className="spin-s" />Menyimpan…</> : <><Icon name="upload" />{ok.length ? `Import ${ok.length} data valid` : "Belum ada data valid"}</>}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
