"use client";
import { clock, cmpNim, hrsOf, isKoor, locSummary, sortByDate, tugasOf, xlsDate } from "./utils";

/**
 * Data matriks satu acara: baris = koor + peserta acara (kalau dibatasi) + mahasiswa yang pernah absen, kolom = sesi.
 * Koor ditaruh paling atas, sisanya urut NIM terkecil ke terbesar.
 * Sel berisi jam plus (angka) atau null bila tidak hadir / tidak absen.
 */
export function matrixData(ev, att, stuMap) {
  const ss = [...(ev.sessions || [])].sort(sortByDate);
  const sesIds = new Set(ss.map((s) => s.id));
  const rowsAtt = att.filter((a) => sesIds.has(a.session_id));
  const key = new Map(rowsAtt.map((a) => [`${a.session_id}|${a.nim}`, a]));
  const nims = [...new Set([...(ev.koor || []), ...(ev.peserta_only ? ev.peserta || [] : []), ...rowsAtt.map((a) => a.nim)])]
    .filter((n) => stuMap.has(n))
    .sort((a, b) => isKoor(ev, b) - isKoor(ev, a) || cmpNim(a, b));
  const rows = nims.map((nim) => {
    let total = 0;
    const cells = ss.map((s) => {
      const a = key.get(`${s.id}|${nim}`);
      const j = a && a.status === "hadir" && ev.counts_jam_plus ? hrsOf(s) : 0;
      total += j;
      return j || null;
    });
    return { st: stuMap.get(nim), tugas: tugasOf(ev, nim), koor: isKoor(ev, nim), cells, total };
  });
  const colTot = ss.map((_, i) => rows.reduce((t, r) => t + (r.cells[i] || 0), 0));
  return { ss, rows, colTot, grand: colTot.reduce((a, b) => a + b, 0) };
}

const round2 = (n) => Math.round(n * 100) / 100;

const FIXED = 6; // No, NIM, Nama, Prodi, Tugas, Semester

function eventSheet(XLSX, ev, att, stuMap) {
  const m = matrixData(ev, att, stuMap);
  // judul tanggal: 3 baris (tanggal, garis, jam). Garis dibuat pendek supaya tidak terlipat jadi baris ke-4.
  const head = ["No", "NIM", "Nama", "Prodi", "Tugas", "Semester", ...m.ss.map((s) => `${xlsDate(s.tanggal)}\n──────────\n${clock(s.jam_mulai)} - ${clock(s.jam_selesai)}`), "Total Jam"];
  const nCol = head.length;
  const ds = m.ss.map((s) => s.tanggal);
  const aoa = [
    ["STAMPTech Plus · UKM TARI ASTRAtech"],
    [`Laporan Jam Plus · ${ev.name}`],
    [`${ds.length ? `${xlsDate(ds[0])} – ${xlsDate(ds.at(-1))}` : ""}${/^(-|\d+ lokasi)$/.test(locSummary(ev)) ? "" : ` · ${locSummary(ev)}`}`],
    [],
    head,
  ];
  const H = 5; // baris pertama data (0-based)
  m.rows.forEach((r, i) => aoa.push([i + 1, r.st.nim, r.st.nama, r.st.prodi, r.tugas, r.st.semester, ...r.cells.map((v) => (v == null ? "" : round2(v))), round2(r.total)]));
  aoa.push(["Total", "", "", "", "", "", ...m.colTot.map((v) => (v ? round2(v) : "")), round2(m.grand)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const thin = { style: "thin", color: { rgb: "D9CFC8" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const JAM = 'General" Jam"';
  const hdr = { font: { bold: true, color: { rgb: "FFFFFF" }, name: "Barlow", sz: 12 }, fill: { fgColor: { rgb: "7A1C2B" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border };
  const last = aoa.length - 1;
  for (let c = 0; c < nCol; c++) {
    ws[XLSX.utils.encode_cell({ r: 4, c })].s = hdr;
    for (let r = H; r <= last; r++) {
      const a = XLSX.utils.encode_cell({ r, c });
      if (!ws[a]) ws[a] = { t: "s", v: "" };
      const foot = r === last;
      ws[a].s = {
        border,
        font: { name: "Barlow", sz: 12, bold: foot || c === nCol - 1, color: { rgb: foot ? "7A1C2B" : "1F0C11" } },
        alignment: { horizontal: c === 2 ? "left" : "center", vertical: "center" },
        ...(foot ? { fill: { fgColor: { rgb: "FFF1C7" } } } : r % 2 === 0 ? { fill: { fgColor: { rgb: "FBF7F3" } } } : {}),
      };
      if (c >= FIXED && typeof ws[a].v === "number") ws[a].z = JAM;
      if (c === 1 && !foot) ws[a].t = "s"; // NIM tetap teks (nol di depan aman)
    }
  }
  ws.A1.s = { font: { bold: true, sz: 16, color: { rgb: "7A1C2B" }, name: "Barlow" } };
  ws.A2.s = { font: { bold: true, sz: 12, name: "Barlow" } };
  ws.A3.s = { font: { sz: 12, color: { rgb: "77666A" }, name: "Barlow" } };

  const merges = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: nCol - 1 } }));
  // kolom Tugas: baris "Tim Tari" yang berurutan digabung jadi satu sel
  let i = 0;
  while (i < m.rows.length) {
    let j = i;
    while (j + 1 < m.rows.length && m.rows[j + 1].tugas === m.rows[i].tugas) j++;
    if (j > i) {
      merges.push({ s: { r: H + i, c: 4 }, e: { r: H + j, c: 4 } });
      for (let k = i + 1; k <= j; k++) ws[XLSX.utils.encode_cell({ r: H + k, c: 4 })].v = "";
    }
    const top = ws[XLSX.utils.encode_cell({ r: H + i, c: 4 })];
    top.s = { ...top.s, fill: { fgColor: { rgb: m.rows[i].koor ? "FFF8E1" : "FBF7F3" } }, font: { ...top.s.font, bold: m.rows[i].koor } };
    i = j + 1;
  }
  merges.push({ s: { r: last, c: 0 }, e: { r: last, c: FIXED - 1 } }); // "Total" selebar kolom identitas
  ws["!merges"] = merges;

  const nameW = Math.min(40, Math.max(24, ...m.rows.map((r) => String(r.st.nama).length + 2)));
  ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: nameW }, { wch: 9 }, { wch: 12 }, { wch: 10 }, ...m.ss.map(() => ({ wch: 17 })), { wch: 13 }];
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 16 }, { hpt: 8 }, { hpt: 62 }, ...aoa.slice(H).map(() => ({ hpt: 20 }))];
  ws["!freeze"] = { xSplit: 3, ySplit: 5 };
  return ws;
}

/** Buat & unduh file Excel. Satu sheet per acara. */
export async function downloadExcel(events, att, stuMap, filename) {
  const mod = await import("xlsx-js-style");
  const XLSX = mod.default || mod;
  const wb = XLSX.utils.book_new();
  const used = new Set();
  events.forEach((ev) => {
    let n = ev.name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Acara";
    while (used.has(n)) n = `${n.slice(0, 27)}_${used.size}`;
    used.add(n);
    XLSX.utils.book_append_sheet(wb, eventSheet(XLSX, ev, att, stuMap), n);
  });
  XLSX.writeFile(wb, filename, { compression: true });
}
