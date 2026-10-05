"use client";
import { useMemo, useRef, useState } from "react";
import Icon from "../Icon";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { Empty, Hero, Kpi, MiniAv, SkeletonRows } from "./ui";
import { downloadExcel } from "@/lib/excel";
import { dObj, fmtJam, fmtLong, fmtShort, pad, slug, todayJakarta } from "@/lib/utils";

function sparkPath(vals, w = 200, h = 36) {
  if (vals.length < 2) return null;
  const m = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - (v / m) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <>
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill="rgba(255,201,60,.18)" />
      <path d={d} fill="none" stroke="#FFC93C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="3" fill="#FFC93C" />
    </>
  );
}

export default function Dashboard() {
  const { events, students, att, loading, sesMap, stuMap, jamOf, evMap } = useData();
  const toast = useToast();
  const [evId, setEvId] = useState("");
  const [q, setQ] = useState("");
  const [tip, setTip] = useState(null);
  const chartRef = useRef(null);
  const today = todayJakarta();

  const d = useMemo(() => {
    const evs = evId ? events.filter((e) => e.id === evId) : events;
    const recs = att.filter((a) => sesMap.has(a.session_id) && (!evId || sesMap.get(a.session_id).event.id === evId));
    const total = recs.reduce((t, a) => t + jamOf(a), 0);
    const per = new Map();
    recs.forEach((a) => {
      const p = per.get(a.nim) || { hadir: 0, plus: 0 };
      if (a.status === "hadir") p.hadir++;
      p.plus += jamOf(a);
      per.set(a.nim, p);
    });
    const rows = students.map((s) => ({ ...s, ...(per.get(s.nim) || { hadir: 0, plus: 0 }) }));
    const got = rows.filter((r) => r.plus > 0);
    const max = Math.max(1, ...rows.map((r) => r.plus));
    const sesRun = evs.reduce((t, e) => t + e.sessions.filter((s) => s.tanggal <= today).length, 0);
    const byDate = {};
    recs.forEach((a) => { const j = jamOf(a); if (!j) return; const t = sesMap.get(a.session_id).tanggal; byDate[t] = (byDate[t] || 0) + j; });
    const dates = [...new Set(evs.flatMap((e) => e.sessions.map((s) => s.tanggal)).filter((t) => t <= today))].sort().slice(-12);
    return { evs, total, rows, got, max, sesRun, byDate, dates };
  }, [events, students, att, evId, sesMap, jamOf, today]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.rows.filter((r) => !s || `${r.nim} ${r.nama} ${r.prodi}`.toLowerCase().includes(s)).sort((a, b) => b.plus - a.plus || a.nim.localeCompare(b.nim));
  }, [d.rows, q]);

  const exportXlsx = async () => {
    if (!d.evs.length) return toast("Belum ada acara untuk diekspor", "x");
    try {
      await downloadExcel(d.evs, att, stuMap, `STAMPTech-Plus-Rekap-${evId ? slug(evMap.get(evId).name) : "Semua-Acara"}.xlsx`);
      toast("File Excel diunduh", "download");
    } catch (e) { toast("Gagal membuat Excel: " + (e.message || e), "x"); }
  };

  // chart geometry
  const W = 760, H = 240, pl = 30, pr = 4, pt = 26, pb = 30;
  const m = Math.max(4, ...d.dates.map((t) => d.byDate[t] || 0));
  const stp = m <= 10 ? 2 : m <= 30 ? 5 : m <= 60 ? 10 : m <= 150 ? 25 : 50;
  const top = Math.ceil(m / stp) * stp;
  const bw = (W - pl - pr) / Math.max(1, d.dates.length);
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  const ticks = []; for (let v = 0; v <= top; v += stp) ticks.push(v);

  return (
    <section>
      <Hero kicker="Dashboard" title="Rekap" hl="jam plus">
        <select className="select" value={evId} onChange={(e) => setEvId(e.target.value)} aria-label="Filter acara" style={{ width: "auto", minWidth: 220, maxWidth: "100%" }}>
          <option value="">Semua acara</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="btn btn-gold" onClick={exportXlsx}><Icon name="download" />Unduh Excel</button>
      </Hero>

      <div className="bento">
        <Kpi className="s3" hero icon="bolt" label="Total jam plus" value={d.total} decimals={1} unit="jam">
          <svg className="spark-svg" viewBox="0 0 200 36" preserveAspectRatio="none">{sparkPath(d.dates.map((t) => d.byDate[t] || 0))}</svg>
        </Kpi>
        <Kpi icon="users" label="Dapat jam plus" value={d.got.length} unit={`/ ${students.length} mhs`} className="s3" />
        <Kpi icon="calendar" label="Sesi berjalan" value={d.sesRun} unit="sesi" className="s3" />
        <Kpi icon="trophy" label="Rata-rata" value={d.got.length ? d.total / d.got.length : 0} decimals={1} unit="jam / mhs" className="s3" />

        <div className="glass s8 chart" ref={chartRef}>
          <div className="card-head"><h2><Icon name="chart" />Jam plus per tanggal</h2><span className="meta">{d.dates.length ? `${fmtShort(d.dates[0])} – ${fmtShort(d.dates.at(-1))}` : ""}</span></div>
          {loading ? <div className="skel" style={{ height: 220 }} /> : !d.dates.length ? <Empty icon="chart">Belum ada sesi yang berjalan.</Empty> : (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik jam plus per tanggal">
              <defs>
                <linearGradient id="bgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFC93C" /><stop offset="1" stopColor="#D03C58" /></linearGradient>
                <linearGradient id="bgr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D03C58" /><stop offset="1" stopColor="#7A1C2B" /></linearGradient>
              </defs>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--stroke-2)" strokeDasharray={v ? "2 6" : "0"} />
                  <text x={pl - 8} y={y(v) + 4} textAnchor="end">{v}</text>
                </g>
              ))}
              {d.dates.map((t, i) => {
                const v = d.byDate[t] || 0, w = Math.min(40, bw * 0.5), x = pl + i * bw + (bw - w) / 2;
                return (
                  <g key={t}>
                    <rect className="b" x={x} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx="8" fill={`url(#${t === today ? "bgr" : "bgr2"})`} style={{ animationDelay: `${i * 60}ms` }}
                      onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(), h = chartRef.current.getBoundingClientRect(); setTip({ x: r.left - h.left + r.width / 2, y: r.top - h.top, v, t }); }}
                      onMouseLeave={() => setTip(null)} />
                    <text x={x + w / 2} y={H - 8} textAnchor="middle">{pad(dObj(t).getDate())}/{pad(dObj(t).getMonth() + 1)}</text>
                  </g>
                );
              })}
            </svg>
          )}
          <div className={`tip ${tip ? "on" : ""}`} style={tip ? { left: tip.x, top: tip.y } : undefined}>
            {tip ? <>{fmtJam(tip.v)} jam plus<small>{fmtLong(tip.t)}</small></> : null}
          </div>
        </div>

        <div className="glass s4">
          <div className="card-head"><h2><Icon name="trophy" />Paling rajin</h2><span className="meta">top 5</span></div>
          <div className="lb">
            {loading ? Array.from({ length: 5 }, (_, i) => <div key={i} className="skel" style={{ height: 38 }} />) :
              d.got.length ? [...d.got].sort((a, b) => b.plus - a.plus).slice(0, 5).map((r, i) => (
                <div className="lb-row" key={r.nim}>
                  <span className="rank">{pad(i + 1)}</span><MiniAv st={r} />
                  <div style={{ minWidth: 0 }}><div className="nm">{r.nama}</div><div className="bar"><i style={{ width: `${(r.plus / d.max) * 100}%`, animationDelay: `${i * 80}ms` }} /></div></div>
                  <span className="jam">{fmtJam(r.plus)} j</span>
                </div>
              )) : <Empty icon="trophy">Belum ada jam plus tercatat.</Empty>}
          </div>
        </div>

        <div className="glass s12">
          <div className="card-head">
            <h2><Icon name="users" />Semua mahasiswa</h2>
            <div className="search" style={{ maxWidth: 320 }}><Icon name="search" /><input className="inp" placeholder="Cari nama, NIM, prodi" aria-label="Cari mahasiswa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <div className="tbl">
            <table style={{ minWidth: 780 }}>
              <thead><tr><th>No</th><th>Mahasiswa</th><th>NIM</th><th>Prodi</th><th className="c">Smt</th><th className="r">Hadir</th><th style={{ width: "20%" }} /><th className="r">Total jam</th></tr></thead>
              <tbody>
                {loading ? <SkeletonRows cols={8} /> : list.length ? list.map((r, i) => (
                  <tr key={r.nim}>
                    <td className="dim mono">{pad(i + 1)}</td>
                    <td><div className="who"><MiniAv st={r} /><span>{r.nama}</span></div></td>
                    <td className="mono dim">{r.nim}</td><td className="dim">{r.prodi}</td><td className="c mono">{r.semester}</td>
                    <td className="r mono">{r.hadir}</td>
                    <td><div className="bar"><i style={{ width: `${(r.plus / d.max) * 100}%` }} /></div></td>
                    <td className="r"><span className={`jam ${r.plus ? "" : "z"}`}>{fmtJam(r.plus)} jam</span></td>
                  </tr>
                )) : <tr><td colSpan={8}><Empty icon="search">{students.length ? "Tidak ada yang cocok." : "Belum ada data mahasiswa."}</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
