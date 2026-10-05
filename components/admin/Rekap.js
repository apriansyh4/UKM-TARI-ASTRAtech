"use client";
import { useMemo, useState } from "react";
import Icon from "../Icon";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { Empty, MiniAv } from "./ui";
import { PRODI, fmtJam, hhmm, pad, slug, todayJakarta } from "@/lib/utils";
import { buildRekapWorkbook, rekapEvent, rekapProdi, rekapSemua } from "@/lib/rekap";

const KINDS = [["acara", "Per acara", "calendar"], ["prodi", "Per prodi", "idcard"], ["semua", "Semua mahasiswa", "users"]];

/** Rekap: per acara, per prodi, dan semua mahasiswa. Bisa diunduh per jenis atau sekaligus. */
export default function Rekap({ evId }) {
  const { events, students, att, loading } = useData();
  const toast = useToast();
  const [kind, setKind] = useState("acara");
  const [prodi, setProdi] = useState("");
  const [evSel, setEvSel] = useState("");
  const [q, setQ] = useState("");
  const today = todayJakarta();

  const data = useMemo(() => ({
    students: students.map((s) => ({ nim: s.nim, nama: s.nama, prodi: s.prodi, semester: s.semester, via: s.registered_via || "admin" })),
    events: events.map((e) => ({ id: e.id, name: e.name, category: e.category, only: !!e.peserta_only, peserta: e.peserta || [], plus: e.counts_jam_plus,
      sessions: e.sessions.map((s) => ({ id: s.id, date: s.tanggal, start: hhmm(s.jam_mulai), end: hhmm(s.jam_selesai) })) })),
    recs: att.map((a) => ({ ses: a.session_id, nim: a.nim, status: a.status })),
  }), [events, students, att]);

  const activeEv = evSel || evId || data.events[0]?.id || "";
  const S = useMemo(() => rekapSemua(data.students, data.events, data.recs), [data]);
  const P = useMemo(() => rekapProdi(S, PRODI), [S]);
  const R = useMemo(() => { const e = data.events.find((x) => x.id === activeEv); return e ? rekapEvent(e, data.students, data.recs, today) : null; }, [data, activeEv, today]);

  const match = (st) => { const s = q.trim().toLowerCase(); return !s || `${st.nim} ${st.nama}`.toLowerCase().includes(s); };

  const download = async (k) => {
    try {
      const mod = await import("xlsx-js-style");
      const XLSX = mod.default || mod;
      const wb = buildRekapWorkbook(XLSX, k, { ...data, PRODI, today, eventId: k === "acara" ? activeEv : "", prodi: k === "prodi" ? prodi : "" });
      const evName = data.events.find((e) => e.id === activeEv)?.name || "Acara";
      const name = { lengkap: "Laporan-Lengkap", acara: `Rekap-${slug(evName)}`, prodi: prodi ? `Mahasiswa-Prodi-${prodi}` : "Mahasiswa-per-Prodi", semua: "Rekap-Semua-Mahasiswa" }[k];
      XLSX.writeFile(wb, `STAMPTech-Plus-${name}.xlsx`, { compression: true });
      toast("File Excel diunduh", "download");
    } catch (e) { toast("Gagal membuat Excel: " + (e.message || e), "x"); }
  };

  return (
    <div>
      <div className="rk-top">
        <div className="seg">
          {KINDS.map(([k, l, ic]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}><Icon name={ic} />{l}</button>)}
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(kind)}><Icon name="download" />Unduh rekap ini</button>
          <button type="button" className="btn btn-gold btn-sm" onClick={() => download("lengkap")}><Icon name="sheet" />Laporan lengkap</button>
        </div>
      </div>

      <div className="toolbar rk-filter">
        {kind === "acara" ? (
          <select className="select" value={activeEv} onChange={(e) => setEvSel(e.target.value)} aria-label="Pilih acara">
            {data.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        ) : null}
        {kind === "prodi" ? (
          <select className="select" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Pilih prodi">
            <option value="">Semua prodi</option>
            {P.map((g) => <option key={g.kode} value={g.kode}>{g.kode} · {g.nama} ({g.rows.length})</option>)}
          </select>
        ) : null}
        <div className="search"><Icon name="search" /><input className="inp" placeholder="Cari nama atau NIM" aria-label="Cari mahasiswa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {loading ? <div className="skel" style={{ height: 220, borderRadius: 16 }} /> : kind === "acara" ? (
        !R ? <Empty icon="calendar">Belum ada acara.</Empty> : (
          <>
            <div className="rk-kpi">
              <div><small>Periode</small><b>{R.periode}</b></div>
              <div><small>Sesi berjalan</small><b>{R.done} / {R.sesi}</b></div>
              <div><small>{R.ev.only ? "Peserta" : "Mahasiswa"}</small><b>{R.rows.length}</b></div>
              <div><small>Kehadiran</small><b>{R.pct}%</b></div>
              <div><small>Total jam plus</small><b>{fmtJam(R.tot.jam)}</b></div>
            </div>
            <div className="tbl">
              <table style={{ minWidth: 820 }}>
                <thead><tr><th>No</th><th>Mahasiswa</th><th>NIM</th><th>Prodi</th><th className="c">Smt</th><th className="c">Hadir</th><th className="c">Tidak</th><th className="c">Belum</th><th>Kehadiran</th><th className="r">Total jam</th></tr></thead>
                <tbody>
                  {R.rows.filter((r) => match(r.st)).map((r, i) => (
                    <tr key={r.st.nim}>
                      <td className="dim mono">{pad(i + 1)}</td>
                      <td><div className="who"><MiniAv st={r.st} /><span>{r.st.nama}</span></div></td>
                      <td className="mono dim">{r.st.nim}</td><td className="dim">{r.st.prodi}</td><td className="c mono">{r.st.semester}</td>
                      <td className="c mono">{r.hadir}</td><td className="c mono">{r.tidak}</td><td className="c mono dim">{r.belum}</td>
                      <td><div className="rk-bar"><i style={{ width: `${r.pct}%` }} /><span>{r.pct}%</span></div></td>
                      <td className="r"><span className={`jam ${r.jam ? "" : "z"}`}>{fmtJam(r.jam)} jam</span></td>
                    </tr>
                  ))}
                  {!R.rows.length ? <tr><td colSpan={10}><Empty>Belum ada peserta atau absen di acara ini.</Empty></td></tr> : null}
                </tbody>
                {R.rows.length ? <tfoot><tr><td colSpan={5}>{R.rows.length} mahasiswa</td><td className="c">{R.tot.hadir}</td><td className="c">{R.tot.tidak}</td><td className="c">{R.tot.belum}</td><td>{R.pct}%</td><td className="r"><span className="jam">{fmtJam(R.tot.jam)} jam</span></td></tr></tfoot> : null}
              </table>
            </div>
          </>
        )
      ) : kind === "prodi" ? (
        <>
          <div className="rk-prodi">
            {P.map((g) => (
              <button key={g.kode} type="button" className="rk-pc" aria-pressed={prodi === g.kode} onClick={() => setProdi(prodi === g.kode ? "" : g.kode)}>
                <b>{g.kode}</b><span>{g.rows.length} mhs</span><small>{fmtJam(g.jam)} jam</small>
              </button>
            ))}
          </div>
          {P.filter((g) => (!prodi || g.kode === prodi) && g.rows.some((r) => match(r.st))).map((g) => (
            <div key={g.kode} className="rk-group">
              <div className="rk-gh"><b>{g.kode}</b><span>{g.nama}</span><span className="meta">{g.rows.length} mahasiswa · {g.aktif} dapat jam plus · {fmtJam(g.jam)} jam</span></div>
              <div className="tbl">
                <table style={{ minWidth: 720 }}>
                  <thead><tr><th>No</th><th>Mahasiswa</th><th>NIM</th><th className="c">Smt</th><th>Terdaftar via</th><th className="c">Acara diikuti</th><th className="c">Total hadir</th><th className="r">Total jam</th></tr></thead>
                  <tbody>
                    {g.rows.filter((r) => match(r.st)).map((r, i) => (
                      <tr key={r.st.nim}>
                        <td className="dim mono">{pad(i + 1)}</td>
                        <td><div className="who"><MiniAv st={r.st} /><span>{r.st.nama}</span></div></td>
                        <td className="mono dim">{r.st.nim}</td><td className="c mono">{r.st.semester}</td>
                        <td className="dim">{r.st.via === "mandiri" ? "Daftar mandiri" : "Admin"}</td>
                        <td className="c mono">{r.acara}</td><td className="c mono">{r.hadir}</td>
                        <td className="r"><span className={`jam ${r.jam ? "" : "z"}`}>{fmtJam(r.jam)} jam</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!students.length ? <Empty icon="users">Belum ada mahasiswa.</Empty> : null}
        </>
      ) : (
        <div className="tbl mx">
          {!S.rows.length ? <Empty icon="users">Belum ada mahasiswa.</Empty> : (
            <table style={{ minWidth: 640 + S.events.length * 130 }}>
              <thead><tr><th>No</th><th>NIM</th><th>Nama</th><th>Prodi</th><th className="c">Smt</th>
                {S.events.map((e) => <th key={e.id} className="dt"><b style={{ whiteSpace: "normal" }}>{e.name}</b></th>)}
                <th className="c">Acara</th><th className="c">Hadir</th><th className="r">Total</th></tr></thead>
              <tbody>
                {S.rows.filter((r) => match(r.st)).map((r, i) => (
                  <tr key={r.st.nim}>
                    <td className="dim mono">{i + 1}</td><td className="mono">{r.st.nim}</td><td style={{ whiteSpace: "nowrap" }}>{r.st.nama}</td><td className="dim">{r.st.prodi}</td><td className="c mono">{r.st.semester}</td>
                    {r.perEv.map((v, k) => <td key={k} className="cell">{v ? <span className="cell-j">{fmtJam(v)} Jam</span> : null}</td>)}
                    <td className="c mono">{r.acara}</td><td className="c mono">{r.hadir}</td>
                    <td className="r"><span className="jam">{fmtJam(r.jam)} Jam</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td /><td colSpan={4}>Total</td>{S.colTot.map((v, k) => <td key={k} className="cell mono">{v ? `${fmtJam(v)} Jam` : ""}</td>)}<td /><td /><td className="r"><span className="jam">{fmtJam(S.grand)} Jam</span></td></tr></tfoot>
            </table>
          )}
        </div>
      )}
      <p className="hint-sm" style={{ margin: "14px 0 0" }}><b>Laporan lengkap</b> berisi sheet Ringkasan, Semua Mahasiswa, satu sheet per prodi, dan satu sheet rekap per acara dalam satu file Excel.</p>
    </div>
  );
}
