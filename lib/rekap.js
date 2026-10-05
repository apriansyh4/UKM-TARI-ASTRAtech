/* =====================================================================
   STAMPTech Plus · Rekap laporan
   - Rekap mahasiswa per acara (hadir, tidak hadir, belum diabsen, % hadir, jam)
   - Daftar mahasiswa per prodi (jumlah acara, kehadiran, jam plus)
   - Rekap semua mahasiswa (jam plus per acara + total)
   - Ringkasan per acara & per prodi
   Tanpa dependensi framework; dipakai juga oleh demo HTML.

   Bentuk data (sudah dinormalkan oleh pemanggil):
     students: [{ nim, nama, prodi, semester, via }]
     events:   [{ id, name, category, only, peserta:[nim], plus, sessions:[{ id, date:"YYYY-MM-DD", start:"HH:MM", end:"HH:MM" }] }]
     recs:     [{ ses, nim, status:"hadir"|"tidak" }]
   ===================================================================== */

const MONS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const hrsOf = (s) => Math.max(0, (toMin(s.end) - toMin(s.start)) / 60);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dmy = (iso) => { const [y, m, d] = iso.split("-"); return `${d} ${MONS[+m - 1]} ${y}`; };
/** NIM terkecil -> terbesar (numerik; aman untuk 0 di depan). */
const cmpNim = (a, b) => {
  const x = String(a ?? "").replace(/\D/g, "").replace(/^0+/, ""), y = String(b ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0) || String(a).localeCompare(String(b));
};
const byNim = (a, b) => cmpNim(a.nim, b.nim);
const FONT = "Barlow";

function index(events, recs) {
  const ses = new Map();
  events.forEach((e) => e.sessions.forEach((s) => ses.set(s.id, { s, e })));
  const jam = (r) => { const x = ses.get(r.ses); return x && x.e.plus && r.status === "hadir" ? hrsOf(x.s) : 0; };
  return { ses, jam };
}

/** Rekap satu acara: satu baris per mahasiswa (peserta, atau yang pernah diabsen kalau acara terbuka). */
export function rekapEvent(ev, students, recs, today) {
  const stu = new Map(students.map((s) => [s.nim, s]));
  const ids = new Set(ev.sessions.map((s) => s.id));
  const hrs = new Map(ev.sessions.map((s) => [s.id, hrsOf(s)]));
  const mine = recs.filter((r) => ids.has(r.ses));
  const done = ev.sessions.filter((s) => s.date <= today).length;
  const nims = [...new Set([...(ev.only ? ev.peserta || [] : []), ...mine.map((r) => r.nim)])].filter((n) => stu.has(n));
  const rows = nims.map((nim) => {
    const rs = mine.filter((r) => r.nim === nim);
    const hadir = rs.filter((r) => r.status === "hadir").length;
    const tidak = rs.filter((r) => r.status === "tidak").length;
    const jam = ev.plus ? rs.filter((r) => r.status === "hadir").reduce((t, r) => t + (hrs.get(r.ses) || 0), 0) : 0;
    return { st: stu.get(nim), hadir, tidak, belum: Math.max(0, done - hadir - tidak), pct: done ? Math.round((hadir / done) * 100) : 0, jam: r2(jam) };
  }).sort((a, b) => byNim(a.st, b.st));
  const tot = rows.reduce((t, r) => ({ hadir: t.hadir + r.hadir, tidak: t.tidak + r.tidak, belum: t.belum + r.belum, jam: t.jam + r.jam }), { hadir: 0, tidak: 0, belum: 0, jam: 0 });
  const dates = ev.sessions.map((s) => s.date).sort();
  return {
    ev, rows, done, sesi: ev.sessions.length, tot: { ...tot, jam: r2(tot.jam) },
    pct: rows.length && done ? Math.round((tot.hadir / (rows.length * done)) * 100) : 0,
    periode: dates.length ? (dates[0] === dates.at(-1) ? dmy(dates[0]) : `${dmy(dates[0])} – ${dmy(dates.at(-1))}`) : "Belum ada jadwal",
  };
}

/** Rekap semua mahasiswa: jam plus per acara + total. */
export function rekapSemua(students, events, recs) {
  const { ses, jam } = index(events, recs);
  const rows = [...students].sort(byNim).map((st) => {
    const rs = recs.filter((r) => r.nim === st.nim && ses.has(r.ses));
    const perEv = events.map((e) => r2(rs.filter((r) => ses.get(r.ses).e.id === e.id).reduce((t, r) => t + jam(r), 0)));
    const hadir = rs.filter((r) => r.status === "hadir").length;
    const acara = new Set(rs.filter((r) => r.status === "hadir").map((r) => ses.get(r.ses).e.id)).size;
    return { st, perEv, hadir, tidak: rs.filter((r) => r.status === "tidak").length, acara, jam: r2(perEv.reduce((a, b) => a + b, 0)) };
  });
  return { events, rows, colTot: events.map((_, i) => r2(rows.reduce((t, r) => t + r.perEv[i], 0))), grand: r2(rows.reduce((t, r) => t + r.jam, 0)) };
}

/** Daftar mahasiswa per prodi, memakai hasil rekapSemua. */
export function rekapProdi(semua, PRODI) {
  const keys = [...new Set([...Object.keys(PRODI), ...semua.rows.map((r) => r.st.prodi)])];
  return keys.map((k) => {
    const rows = semua.rows.filter((r) => r.st.prodi === k);
    const jam = r2(rows.reduce((t, r) => t + r.jam, 0));
    const aktif = rows.filter((r) => r.jam > 0).length;
    return { kode: k, nama: PRODI[k] || k, rows, jam, aktif, rata: rows.length ? r2(jam / rows.length) : 0 };
  }).filter((g) => g.rows.length || PRODI[g.kode]);
}

/* ---------------------------------------------------------------- Excel */

const C = { maroon: "7A1C2B", ink: "1F0C11", muted: "77666A", zebra: "FBF7F3", foot: "FFF1C7", line: "D9CFC8" };

/**
 * Sheet bergaya STAMPTech Plus.
 * opts: { title, sub, head:[...], rows:[[...]], foot:[...]?, widths:[...], jamCols:Set(index), pctCols:Set, textCols:Set, leftCols:Set, freeze:{x,y}? }
 */
function styledSheet(XLSX, o) {
  const aoa = [["STAMPTech Plus · UKM TARI ASTRAtech"], [o.title], [o.sub || ""], [], o.head, ...o.rows];
  if (o.foot) aoa.push(o.foot);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const thin = { style: "thin", color: { rgb: C.line } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const n = o.head.length, H = 4, last = aoa.length - 1;
  for (let c = 0; c < n; c++) {
    const h = XLSX.utils.encode_cell({ r: H, c });
    ws[h].s = { font: { bold: true, color: { rgb: "FFFFFF" }, name: FONT, sz: 12 }, fill: { fgColor: { rgb: C.maroon } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border };
    for (let r = H + 1; r <= last; r++) {
      const a = XLSX.utils.encode_cell({ r, c });
      if (!ws[a]) ws[a] = { t: "s", v: "" };
      const foot = !!o.foot && r === last;
      ws[a].s = {
        border,
        font: { name: FONT, sz: 12, bold: foot || c === n - 1, color: { rgb: foot ? C.maroon : C.ink } },
        alignment: { horizontal: o.leftCols?.has(c) ? "left" : "center", vertical: "center" },
        ...(foot ? { fill: { fgColor: { rgb: C.foot } } } : (r - H) % 2 === 0 ? { fill: { fgColor: { rgb: C.zebra } } } : {}),
      };
      if (typeof ws[a].v === "number") {
        if (o.jamCols?.has(c)) ws[a].z = 'General" Jam"';
        else if (o.pctCols?.has(c)) ws[a].z = '0"%"';
      }
      if (o.textCols?.has(c) && !foot) { ws[a].t = "s"; ws[a].v = String(ws[a].v ?? ""); }
    }
  }
  ws.A1.s = { font: { bold: true, sz: 16, color: { rgb: C.maroon }, name: FONT } };
  ws.A2.s = { font: { bold: true, sz: 12, name: FONT } };
  ws.A3.s = { font: { sz: 12, color: { rgb: C.muted }, name: FONT } };
  ws["!merges"] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: Math.max(1, n - 1) } }));
  ws["!cols"] = o.widths.map((w) => ({ wch: w }));
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 16 }, { hpt: 8 }, { hpt: o.headH || 30 }];
  ws["!freeze"] = { xSplit: o.freeze?.x ?? 3, ySplit: H + 1 };
  return ws;
}

const sheetName = (used, raw) => {
  let n = String(raw).replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
  let i = 2; const base = n.slice(0, 28);
  while (used.has(n)) n = `${base}_${i++}`;
  used.add(n); return n;
};

function sheetEvent(XLSX, R) {
  return styledSheet(XLSX, {
    title: `Rekap Mahasiswa per Acara · ${R.ev.name}`,
    sub: `${R.periode} · ${R.sesi} sesi (${R.done} sudah berjalan) · ${R.ev.only ? `${(R.ev.peserta || []).length} peserta terdaftar` : "terbuka untuk semua mahasiswa"}`,
    head: ["No", "NIM", "Nama", "Prodi", "Semester", "Hadir", "Tidak Hadir", "Belum Diabsen", "% Kehadiran", "Total Jam"],
    rows: R.rows.map((r, i) => [i + 1, r.st.nim, r.st.nama, r.st.prodi, r.st.semester, r.hadir, r.tidak, r.belum, r.pct, r.jam]),
    foot: ["", "Total", `${R.rows.length} mahasiswa`, "", "", R.tot.hadir, R.tot.tidak, R.tot.belum, R.pct, R.tot.jam],
    widths: [5, 14, 28, 9, 10, 9, 12, 14, 13, 12], jamCols: new Set([9]), pctCols: new Set([8]), textCols: new Set([1]), leftCols: new Set([2]),
  });
}

function sheetSemua(XLSX, S, title = "Rekap Semua Mahasiswa", rows = S.rows) {
  const evs = S.events;
  const colTot = evs.map((_, i) => r2(rows.reduce((t, r) => t + r.perEv[i], 0)));
  return styledSheet(XLSX, {
    title, sub: `${rows.length} mahasiswa · ${evs.length} acara · kolom acara berisi jam plus`,
    head: ["No", "NIM", "Nama", "Prodi", "Semester", ...evs.map((e) => e.name), "Acara Diikuti", "Total Hadir", "Total Jam"],
    rows: rows.map((r, i) => [i + 1, r.st.nim, r.st.nama, r.st.prodi, r.st.semester, ...r.perEv.map((v) => v || ""), r.acara, r.hadir, r.jam]),
    foot: ["", "Total", "", "", "", ...colTot.map((v) => v || ""), "", rows.reduce((t, r) => t + r.hadir, 0), r2(rows.reduce((t, r) => t + r.jam, 0))],
    widths: [5, 14, 28, 9, 10, ...evs.map(() => 16), 13, 12, 12],
    jamCols: new Set([...evs.map((_, i) => 5 + i), 7 + evs.length]), textCols: new Set([1]), leftCols: new Set([2]), headH: 44,
  });
}

function sheetProdiList(XLSX, G, PRODI) {
  return styledSheet(XLSX, {
    title: `Daftar Mahasiswa per Prodi · ${G.kode}`,
    sub: `${G.nama} · ${G.rows.length} mahasiswa · ${G.aktif} sudah dapat jam plus`,
    head: ["No", "NIM", "Nama", "Semester", "Terdaftar via", "Acara Diikuti", "Total Hadir", "Total Jam"],
    rows: G.rows.map((r, i) => [i + 1, r.st.nim, r.st.nama, r.st.semester, r.st.via === "mandiri" ? "Daftar mandiri" : "Admin", r.acara, r.hadir, r.jam]),
    foot: ["", "Total", `${G.rows.length} mahasiswa`, "", "", "", G.rows.reduce((t, r) => t + r.hadir, 0), G.jam],
    widths: [5, 14, 30, 10, 15, 13, 12, 12], jamCols: new Set([7]), textCols: new Set([1]), leftCols: new Set([2]),
  });
}

function sheetRingkasan(XLSX, events, R, P) {
  const thin = { style: "thin", color: { rgb: C.line } };
  const ws1 = styledSheet(XLSX, {
    title: "Ringkasan",
    sub: "Ringkasan per acara dan per prodi",
    head: ["No", "Acara", "Periode", "Sesi", "Peserta", "Total Hadir", "Tidak Hadir", "% Kehadiran", "Total Jam"],
    rows: R.map((x, i) => [i + 1, x.ev.name, x.periode, x.sesi, x.ev.only ? (x.ev.peserta || []).length : `${x.rows.length} (terbuka)`, x.tot.hadir, x.tot.tidak, x.pct, x.tot.jam]),
    foot: ["", "Total", "", R.reduce((t, x) => t + x.sesi, 0), "", R.reduce((t, x) => t + x.tot.hadir, 0), R.reduce((t, x) => t + x.tot.tidak, 0), "", r2(R.reduce((t, x) => t + x.tot.jam, 0))],
    widths: [5, 32, 28, 8, 14, 12, 12, 13, 12], jamCols: new Set([8]), pctCols: new Set([7]), leftCols: new Set([1, 2]), freeze: { x: 2 },
  });
  // tabel prodi di bawahnya
  const start = R.length + 8;
  const head = ["No", "Kode", "Program Studi", "Mahasiswa", "Dapat Jam Plus", "Total Jam", "Rata-rata Jam"];
  const rows = P.map((g, i) => [i + 1, g.kode, g.nama, g.rows.length, g.aktif, g.jam, g.rata]);
  XLSX.utils.sheet_add_aoa(ws1, [["Per Prodi"], head, ...rows], { origin: { r: start, c: 0 } });
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  ws1[XLSX.utils.encode_cell({ r: start, c: 0 })].s = { font: { bold: true, sz: 12, color: { rgb: C.maroon }, name: FONT } };
  head.forEach((_, c) => {
    ws1[XLSX.utils.encode_cell({ r: start + 1, c })].s = { font: { bold: true, color: { rgb: "FFFFFF" }, name: FONT, sz: 12 }, fill: { fgColor: { rgb: C.maroon } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border };
    rows.forEach((_, i) => {
      const a = XLSX.utils.encode_cell({ r: start + 2 + i, c });
      ws1[a].s = { border, font: { name: FONT, sz: 12 }, alignment: { horizontal: c === 2 ? "left" : "center" }, ...(i % 2 ? { fill: { fgColor: { rgb: C.zebra } } } : {}) };
      if ((c === 5 || c === 6) && typeof ws1[a].v === "number") ws1[a].z = 'General" Jam"';
    });
  });
  return ws1;
}

/**
 * Buat workbook rekap.
 * kind: "acara" (opts.eventId → satu acara, kosong → semua acara), "prodi" (opts.prodi → satu prodi, kosong → semua),
 *       "semua", atau "lengkap" (Ringkasan + Semua + per prodi + per acara).
 */
export function buildRekapWorkbook(XLSX, kind, { students, events, recs, PRODI, today, eventId = "", prodi = "" }) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const add = (ws, name) => XLSX.utils.book_append_sheet(wb, ws, sheetName(used, name));
  const S = rekapSemua(students, events, recs);
  const P = rekapProdi(S, PRODI);
  const evs = eventId ? events.filter((e) => e.id === eventId) : events;
  const R = evs.map((e) => rekapEvent(e, students, recs, today));

  if (kind === "lengkap") {
    add(sheetRingkasan(XLSX, events, events.map((e) => rekapEvent(e, students, recs, today)), P), "Ringkasan");
    add(sheetSemua(XLSX, S), "Semua Mahasiswa");
    P.filter((g) => g.rows.length).forEach((g) => add(sheetProdiList(XLSX, g, PRODI), `Prodi ${g.kode}`));
    events.forEach((e) => add(sheetEvent(XLSX, rekapEvent(e, students, recs, today)), `Acara ${e.name}`));
  } else if (kind === "acara") {
    R.forEach((x) => add(sheetEvent(XLSX, x), x.ev.name));
  } else if (kind === "prodi") {
    const gs = prodi ? P.filter((g) => g.kode === prodi) : P.filter((g) => g.rows.length);
    if (!prodi) add(sheetSemua(XLSX, S, "Daftar Semua Mahasiswa", S.rows), "Semua Prodi");
    gs.forEach((g) => add(sheetProdiList(XLSX, g, PRODI), g.kode));
  } else {
    add(sheetSemua(XLSX, S), "Semua Mahasiswa");
  }
  if (!wb.SheetNames.length) add(XLSX.utils.aoa_to_sheet([["Belum ada data"]]), "Kosong");
  return wb;
}
