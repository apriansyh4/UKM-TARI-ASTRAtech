"use client";
import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { ConfirmDelete, Empty, Hero, MiniAv, SkeletonRows } from "./ui";
import { DayStrip } from "../checkin";
import Rekap from "./Rekap";
import { downloadExcel, matrixData } from "@/lib/excel";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { STATUS, cmpNim, pesertaLabel, clock, fmtJam, fmtLong, hrsOf, pad, pickSession, rangeOf, slug, todayJakarta, xlsDate } from "@/lib/utils";

export default function Laporan() {
  const { events, att, loading, stuMap, jamOf, removeAttLocal } = useData();
  const toast = useToast();
  const [evId, setEvId] = useState(null);
  const [sesId, setSesId] = useState(null);
  const [view, setView] = useState("harian");

  useEffect(() => { if (events.length && !events.some((e) => e.id === evId)) { const t = todayJakarta(); setEvId((events.find((e) => e.sessions.some((s) => s.tanggal === t)) || events[0]).id); } }, [events, evId]);
  const ev = events.find((e) => e.id === evId) || null;
  useEffect(() => { if (ev && !ev.sessions.some((s) => s.id === sesId)) setSesId(pickSession(ev)); }, [ev, sesId]);
  const ses = ev?.sessions.find((s) => s.id === sesId) || null;

  const countBySes = useMemo(() => { const m = new Map(); att.forEach((a) => m.set(a.session_id, (m.get(a.session_id) || 0) + 1)); return m; }, [att]);
  const rows = useMemo(() => att.filter((a) => a.session_id === sesId).map((a) => ({ ...a, st: stuMap.get(a.nim), j: jamOf(a) })).filter((r) => r.st).sort((a, b) => cmpNim(a.nim, b.nim)), [att, sesId, stuMap, jamOf]);
  const matrix = useMemo(() => (ev ? matrixData(ev, att, stuMap) : null), [ev, att, stuMap]);

  const del = async (id) => {
    try {
      const { error } = await supabaseBrowser().from("attendances").delete().eq("id", id);
      if (error) throw error;
      removeAttLocal(id);
      toast("Data absen dihapus", "trash");
    } catch (e) { toast(errMsg(e), "x"); }
  };

  const exportXlsx = async () => {
    if (!ev) return;
    try { await downloadExcel([ev], att, stuMap, `STAMPTech-Plus-${slug(ev.name)}.xlsx`); toast("File Excel diunduh", "download"); }
    catch (e) { toast("Gagal membuat Excel: " + (e.message || e), "x"); }
  };

  const today = todayJakarta();

  return (
    <section>
      <Hero kicker="Laporan" title="Laporan" hl="per tanggal">
        <select className="select" value={evId || ""} onChange={(e) => { setEvId(e.target.value); setSesId(null); }} aria-label="Pilih acara" style={{ width: "auto", minWidth: 220, maxWidth: "100%" }}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="btn btn-gold" onClick={exportXlsx} disabled={!ev}><Icon name="download" />Unduh Excel</button>
      </Hero>

      <div className="glass">
        <div className="card-head">
          <div className="seg">
            <button aria-pressed={view === "harian"} onClick={() => setView("harian")}><Icon name="calendar" />Per tanggal</button>
            <button aria-pressed={view === "matriks"} onClick={() => setView("matriks")}><Icon name="sheet" />Format Excel</button>
            <button aria-pressed={view === "rekap"} onClick={() => setView("rekap")}><Icon name="users" />Rekap</button>
          </div>
          <span className="meta">
            {view === "rekap" ? "per acara · per prodi · semua mahasiswa" : view === "harian" ? (ses ? `${rangeOf(ses)} · ${fmtJam(hrsOf(ses))} jam` : "") : matrix ? `${matrix.rows.length} mahasiswa · ${matrix.ss.length} sesi · kosong = tidak hadir` : ""}
          </span>
        </div>

        {view === "rekap" ? <Rekap evId={evId} /> : !loading && !events.length ? <Empty icon="calendar">Belum ada acara. Buat dulu di menu Acara.</Empty> : view === "harian" ? (
          <>
            {ev ? <DayStrip sessions={ev.sessions} value={sesId} onChange={setSesId} meta={(s) => `${countBySes.get(s.id) || 0} org`} /> : null}
            <div className="card-head" style={{ margin: "22px 0 10px" }}><h2 style={{ fontSize: "var(--t-md)" }}>{ses ? fmtLong(ses.tanggal) : ev ? "Belum ada jadwal" : ""}</h2></div>
            <div className="tbl">
              <table style={{ minWidth: 860 }}>
                <thead><tr><th>No</th><th>Mahasiswa</th><th>NIM</th><th>Prodi</th><th className="c">Smt</th><th>Jam latihan</th><th className="r">Jumlah jam</th><th>Status</th><th>Keterangan</th><th /></tr></thead>
                <tbody>
                  {loading ? <SkeletonRows cols={10} /> : rows.length ? rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="dim mono">{pad(i + 1)}</td>
                      <td><div className="who"><MiniAv st={r.st} /><span>{r.st.nama}</span></div></td>
                      <td className="mono dim">{r.nim}</td><td className="dim">{r.st.prodi}</td><td className="c mono">{r.st.semester}</td>
                      <td className="mono dim">{rangeOf(ses)}</td>
                      <td className="r"><span className={`jam ${r.j ? "" : "z"}`}>{r.j ? `${fmtJam(r.j)} jam` : "–"}</span></td>
                      <td><span className={`tag ${r.status}`}>{STATUS[r.status]}</span></td>
                      <td className="dim">{r.reason || ""}{r.source === "form" ? <span className="meta" style={{ marginLeft: 6 }}>· form</span> : null}</td>
                      <td className="r"><ConfirmDelete label={`Hapus absen ${r.st.nama}`} onConfirm={() => del(r.id)} /></td>
                    </tr>
                  )) : <tr><td colSpan={10}><Empty>{ses && ses.tanggal > today ? "Sesi ini belum berlangsung." : "Belum ada absen di tanggal ini."}</Empty></td></tr>}
                </tbody>
                {rows.length ? (
                  <tfoot><tr><td colSpan={6}>{rows.filter((r) => r.status === "hadir").length} hadir dari {rows.length} absen{ev?.peserta_only ? ` · ${pesertaLabel(ev)}, ${Math.max(0, (ev.peserta || []).length - rows.filter((r) => (ev.peserta || []).includes(r.nim)).length)} belum diabsen` : ""}</td><td className="r"><span className="jam">{fmtJam(rows.reduce((t, r) => t + r.j, 0))} jam</span></td><td colSpan={3} /></tr></tfoot>
                ) : null}
              </table>
            </div>
          </>
        ) : (
          <div className="tbl mx">
            {!matrix || !matrix.rows.length ? <Empty icon="sheet">Belum ada data untuk acara ini.</Empty> : (
              <table style={{ minWidth: 540 + matrix.ss.length * 124 }}>
                <thead><tr><th>No</th><th>NIM</th><th>Nama</th><th>Prodi</th><th className="c">Semester</th>
                  {matrix.ss.map((s) => <th key={s.id} className="dt"><b>{xlsDate(s.tanggal)}</b><span className="dt-line" />{clock(s.jam_mulai)} - {clock(s.jam_selesai)}</th>)}
                  <th className="r">Total</th></tr></thead>
                <tbody>
                  {matrix.rows.map((r, i) => (
                    <tr key={r.st.nim}>
                      <td className="dim mono">{i + 1}</td><td className="mono">{r.st.nim}</td><td style={{ whiteSpace: "nowrap" }}>{r.st.nama}</td><td className="dim">{r.st.prodi}</td><td className="c mono">{r.st.semester}</td>
                      {r.cells.map((v, k) => <td key={k} className="cell">{v ? <span className="cell-j">{fmtJam(v)} Jam</span> : null}</td>)}
                      <td className="r"><span className="jam">{fmtJam(r.total)} Jam</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td /><td colSpan={4}>Total</td>{matrix.colTot.map((v, k) => <td key={k} className="cell mono">{v ? `${fmtJam(v)} Jam` : ""}</td>)}<td className="r"><span className="jam">{fmtJam(matrix.grand)} Jam</span></td></tr></tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
