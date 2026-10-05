/* =====================================================================
   STAMPTech Plus · Import massal
   Parsing (Excel / CSV / tempel dari spreadsheet), pemetaan kolom,
   validasi per baris, dan template Excel. Tanpa dependensi framework,
   dipakai juga oleh demo HTML.
   ===================================================================== */

const pad2 = (n) => String(n).padStart(2, "0");
const norm = (v) => String(v ?? "").replace(/ /g, " ").trim();
const low = (v) => norm(v).toLowerCase();

export const BULK_TYPES = {
  mhs: {
    label: "Mahasiswa",
    icon: "users",
    desc: "Satu baris = satu mahasiswa. NIM yang sudah ada akan diperbarui.",
    cols: [["nim", "NIM"], ["nama", "Nama"], ["prodi", "Prodi"], ["semester", "Semester"]],
    aliases: {
      nim: ["nim", "no induk", "nomor induk", "nomor induk mahasiswa"],
      nama: ["nama", "nama lengkap", "nama mahasiswa", "name"],
      prodi: ["prodi", "program studi", "jurusan", "kode prodi"],
      semester: ["semester", "smt", "sem"],
    },
    example: [["0320260150", "Iwan Setiawan", "TRPL", 1], ["0320250151", "Siti Nur Aini", "TPM", 3]],
    widths: [14, 28, 10, 10],
  },
  acara: {
    label: "Acara & jadwal",
    icon: "calendar",
    desc: "Satu baris = satu tanggal latihan (tidak harus berurutan). Jam & lokasi boleh beda tiap baris. Nama acara yang sama digabung jadi satu acara.",
    cols: [["acara", "Nama Acara"], ["jenis", "Jenis"], ["lokasi", "Lokasi"], ["tanggal", "Tanggal"], ["mulai", "Jam Mulai"], ["selesai", "Jam Selesai"]],
    aliases: {
      acara: ["nama acara", "acara", "kegiatan", "nama kegiatan", "event"],
      jenis: ["jenis", "kategori", "jenis acara", "category"],
      lokasi: ["lokasi", "tempat", "location"],
      tanggal: ["tanggal", "tgl", "date", "hari tanggal"],
      mulai: ["jam mulai", "mulai", "start", "jam awal"],
      selesai: ["jam selesai", "selesai", "end", "jam akhir"],
    },
    example: [
      ["Latihan Pentas Seni", "Latihan", "Studio Tari", "2026-10-20", "15:00", "18:00"],
      ["Latihan Pentas Seni", "Latihan", "Studio Tari", "2026-10-21", "13:00", "17:00"],
    ],
    widths: [30, 14, 20, 14, 12, 12],
  },
  peserta: {
    label: "Peserta acara",
    icon: "idcard",
    desc: "Satu baris = satu peserta. Acara otomatis dibatasi: hanya NIM di daftar ini yang bisa diabsen.",
    cols: [["nim", "NIM"], ["acara", "Nama Acara"]],
    aliases: {
      nim: ["nim", "no induk", "nomor induk"],
      acara: ["nama acara", "acara", "kegiatan", "event"],
    },
    example: [["0320230012", "Latihan Acara Wisuda"], ["0320240041", "Latihan Acara Wisuda"]],
    widths: [14, 34],
  },
  absen: {
    label: "Absensi",
    icon: "check",
    desc: "Satu baris = satu kehadiran. Acara dan tanggal sesinya harus sudah ada.",
    cols: [["nim", "NIM"], ["acara", "Nama Acara"], ["tanggal", "Tanggal"], ["status", "Status"], ["keterangan", "Keterangan"]],
    aliases: {
      nim: ["nim", "no induk", "nomor induk"],
      acara: ["nama acara", "acara", "kegiatan", "event"],
      tanggal: ["tanggal", "tgl", "date"],
      status: ["status", "kehadiran", "hadir"],
      keterangan: ["keterangan", "alasan", "ket", "catatan"],
    },
    example: [
      ["0320230012", "Latihan Acara Wisuda", "2026-10-01", "Hadir", ""],
      ["0320250063", "Latihan Acara Wisuda", "2026-10-01", "Tidak Hadir", "Sakit"],
    ],
    widths: [14, 30, 14, 14, 28],
  },
};

const SHEET_HINT = { mhs: "mahasiswa", acara: "acara", peserta: "peserta", absen: "absen" };

/* ---------- pembacaan input ---------- */

/** Teks tempelan (dari Excel/Sheets = tab) atau CSV (koma / titik koma). */
export function parseText(text) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const first = lines[0];
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  return lines.map((l) => {
    if (sep === "\t") return l.split("\t");
    const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

/** Baris dari file Excel. Memilih sheet yang namanya cocok dengan jenis data. */
export function sheetRows(XLSX, buffer, type) {
  const wb = XLSX.read(buffer, { type: "array" });
  const names = wb.SheetNames;
  const want = SHEET_HINT[type];
  const name = names.find((n) => low(n).includes(want)) || names.find((n) => !low(n).includes("petunjuk")) || names[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
  return { rows, sheet: name, sheets: names };
}

/* ---------- parser nilai ---------- */

const MONTHS = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nop: 11, november: 11, nopember: 11, des: 12, desember: 12, dec: 12, december: 12 };

function ymd(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Tanggal → "YYYY-MM-DD". Mendukung serial Excel, 2026-10-01, 01/10/2026 (DD/MM), "1 Okt 2026". */
export function parseDate(v) {
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 864e5));
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  if (v instanceof Date && !isNaN(v)) return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = norm(v).replace(/^[a-z]+,\s*/i, ""); // buang nama hari: "Kamis, 1 Okt 2026"
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return ymd(y, +m[2], +m[1]); }
  m = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s-]+(\d{2,4})$/i);
  if (m) { const mo = MONTHS[m[2].toLowerCase()]; let y = +m[3]; if (y < 100) y += 2000; if (mo) return ymd(y, mo, +m[1]); }
  return null;
}

function hm(h, m) { return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${pad2(h)}:${pad2(m)}` : null; }

/** Jam → "HH:MM". Mendukung 15:00, 15.00, 3:00 PM, 15, dan pecahan hari dari Excel. */
export function parseTime(v) {
  if (typeof v === "number") {
    if (v >= 0 && v < 1) { const mins = Math.round(v * 1440); return hm(Math.floor(mins / 60) % 24, mins % 60); }
    if (Number.isInteger(v)) return hm(v, 0);
    return null;
  }
  const s = low(v).replace(/\s+/g, "").replace(/wib$/, "");
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(am|pm)?$/);
  if (m) { let h = +m[1]; if (m[3] === "pm" && h < 12) h += 12; if (m[3] === "am" && h === 12) h = 0; return hm(h, +m[2]); }
  m = s.match(/^(\d{1,2})(am|pm)?$/);
  if (m) { let h = +m[1]; if (m[2] === "pm" && h < 12) h += 12; if (m[2] === "am" && h === 12) h = 0; return hm(h, 0); }
  return null;
}

const HADIR = ["hadir", "h", "1", "y", "ya", "yes", "v", "✓", "√", "present", "masuk", "ok"];
const TIDAK = ["tidak hadir", "tidak", "tdk hadir", "th", "t", "0", "n", "no", "absen", "alpha", "alpa", "a", "izin", "ijin", "i", "sakit", "s", "x", "✗", "-"];
/** Status → "hadir" | "tidak". Izin / Sakit dianggap Tidak Hadir (dan jadi keterangan). */
export function parseStatus(v) {
  const s = low(v).replace(/\s+/g, " ");
  if (HADIR.includes(s)) return "hadir";
  if (TIDAK.includes(s)) return "tidak";
  return null;
}

/** Prodi → kode resmi. Terima kode (TRPL) atau nama lengkap. */
export function parseProdi(v, PRODI) {
  const s = norm(v).toUpperCase().replace(/\s+/g, " ");
  if (!s) return null;
  if (s === "TPPM") return "TPM";
  if (PRODI[s]) return s;
  const clean = s.replace(/^(D3|D4|D-3|D-4|DIII|DIV|SARJANA TERAPAN)\s+/, "");
  if (PRODI[clean]) return clean;
  return Object.keys(PRODI).find((k) => PRODI[k].toUpperCase() === clean) || null;
}

function parseNim(v) {
  if (typeof v === "number") return { nim: Number.isInteger(v) ? String(v) : "", numeric: true };
  return { nim: norm(v).replace(/[\s.-]/g, ""), numeric: false };
}

/** Panjang NIM yang paling umum di data (untuk mengembalikan angka 0 yang hilang di Excel). */
function typicalNimLength(students) {
  const c = new Map(); let zero = 0, total = 0;
  for (const k of students?.keys?.() || []) { c.set(k.length, (c.get(k.length) || 0) + 1); total++; if (k[0] === "0") zero++; }
  let best = 0, n = 0; c.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return { len: best, leadingZero: total > 0 && zero / total > 0.5 };
}

/** "dewi LESTARI" → "Dewi Lestari": kata yang seluruhnya huruf kecil / kapital dirapikan. */
function tidyName(s) {
  return s.replace(/\s+/g, " ").trim().split(" ").map((w) =>
    w.length > 1 && (w === w.toLowerCase() || w === w.toUpperCase())
      ? w.toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase())
      : w
  ).join(" ");
}

/* ---------- pemetaan kolom ---------- */

const headKey = (h) => low(h).replace(/\(.*?\)/g, "").replace(/[*_:]+/g, " ").replace(/\s+/g, " ").trim();

function mapColumns(type, rows) {
  const T = BULK_TYPES[type];
  const head = (rows[0] || []).map(headKey);
  const idx = {}; let hit = 0;
  T.cols.forEach(([k]) => { const i = head.findIndex((h) => T.aliases[k].includes(h)); if (i > -1) { idx[k] = i; hit++; } });
  if (hit >= Math.min(2, T.cols.length)) return { idx, body: rows.slice(1), header: true };
  const pos = {}; T.cols.forEach(([k], i) => { pos[k] = i; });
  return { idx: pos, body: rows, header: false };
}

/* ---------- validasi ---------- */

/**
 * @param type "mhs" | "acara" | "peserta" | "absen"
 * @param rows array baris (array sel)
 * @param ctx { PRODI, CATEGORIES, students: Map(nim→mhs), events: [{id,name,pesertaOnly?,peserta?:[nim],sessions:[{id,date}]}], attKeys: Set("sesId|nim") }
 * @returns { items:[{line, ok, errs, warns, action, data, cells}], header:boolean, missing:[label] }
 */
export function validateBulk(type, rows, ctx) {
  const T = BULK_TYPES[type];
  const clean = rows.filter((r) => Array.isArray(r) && r.some((c) => norm(c) !== ""));
  if (!clean.length) return { items: [], header: false, missing: [] };
  const { idx, body, header } = mapColumns(type, clean);
  const missing = T.cols.filter(([k]) => idx[k] == null && !(type === "absen" && k === "keterangan") && !(type === "acara" && (k === "jenis" || k === "lokasi"))).map(([, l]) => l);
  const get = (r, k) => (idx[k] == null ? "" : r[idx[k]]);
  const seen = new Map();
  const evByName = new Map((ctx.events || []).map((e) => [low(e.name), e]));
  const cats = ctx.CATEGORIES || [];
  const { len: nimLen, leadingZero } = typicalNimLength(ctx.students);
  const fixNim = (nim, numeric, warns) => {
    if (!nim || !/^\d+$/.test(nim) || ctx.students?.has(nim)) return nim;
    if (nimLen && nim.length < nimLen) {
      const padded = nim.padStart(nimLen, "0");
      if (ctx.students?.has(padded) || (type !== "absen" && (numeric || (leadingZero && nim.length === nimLen - 1)))) { warns.push(`Angka 0 di depan NIM dikembalikan (${padded})`); return padded; }
    }
    return nim;
  };

  const items = body.map((r, i) => {
    const line = i + (header ? 2 : 1);
    const errs = [], warns = [];
    let data = null, action = "";
    const raw = T.cols.map(([k]) => norm(get(r, k)));
    let shown = null; // nilai yang akan disimpan (sudah dirapikan)

    if (type === "mhs") {
      const p = parseNim(get(r, "nim"));
      const nim = fixNim(p.nim, p.numeric, warns), numeric = p.numeric && nim === p.nim;
      const nama = tidyName(norm(get(r, "nama")));
      const prodi = parseProdi(get(r, "prodi"), ctx.PRODI);
      const smt = parseInt(String(get(r, "semester")).replace(/\D/g, ""), 10);
      if (!/^\d{4,15}$/.test(nim)) errs.push("NIM harus 4–15 digit angka");
      else if (numeric) warns.push("NIM terbaca sebagai angka, cek angka 0 di depan");
      if (nama.length < 3 || nama.length > 80) errs.push("Nama 3–80 karakter");
      else if (!/^[\p{L} .,'-]+$/u.test(nama)) errs.push("Nama hanya boleh huruf, spasi, titik, koma, tanda hubung");
      if (!prodi) errs.push(`Prodi tidak dikenal${norm(get(r, "prodi")) ? ` (“${norm(get(r, "prodi"))}”)` : ""}`);
      if (!(smt >= 1 && smt <= 14)) errs.push("Semester 1–14");
      if (nim) { if (seen.has(nim)) errs.push(`NIM dobel dengan baris ${seen.get(nim)}`); else seen.set(nim, line); }
      action = ctx.students?.has(nim) ? "Perbarui" : "Baru";
      data = { nim, nama, prodi, semester: smt };
      shown = [nim, nama, prodi, smt >= 1 && smt <= 14 ? String(smt) : null];
    }

    if (type === "acara") {
      const name = norm(get(r, "acara")).replace(/\s+/g, " ");
      const jRaw = norm(get(r, "jenis"));
      const cat = cats.find((c) => low(c) === low(jRaw)) || "Latihan";
      const loc = norm(get(r, "lokasi"));
      const date = parseDate(get(r, "tanggal"));
      const start = parseTime(get(r, "mulai"));
      const end = parseTime(get(r, "selesai"));
      if (name.length < 3) errs.push("Nama acara belum diisi");
      if (jRaw && !cats.some((c) => low(c) === low(jRaw))) warns.push(`Jenis “${jRaw}” tidak dikenal, dipakai “Latihan”`);
      if (!date) errs.push("Tanggal tidak terbaca (pakai 2026-10-20 atau 20/10/2026)");
      if (!start) errs.push("Jam mulai tidak terbaca");
      if (!end) errs.push("Jam selesai tidak terbaca");
      if (start && end && end <= start) errs.push("Jam selesai harus setelah jam mulai");
      const key = `${low(name)}|${date}`;
      if (name && date) { if (seen.has(key)) errs.push(`Sesi dobel dengan baris ${seen.get(key)}`); else seen.set(key, line); }
      const ev = evByName.get(low(name));
      action = !ev ? "Acara baru" : ev.sessions.some((s) => s.date === date) ? "Ubah sesi" : "Tambah sesi";
      data = { name, cat, loc, date, start, end, evId: ev?.id || null };
      shown = [name, cat, loc, date, start, end];
    }

    if (type === "peserta") {
      const p = parseNim(get(r, "nim"));
      const nim = fixNim(p.nim, p.numeric, warns), numeric = p.numeric && nim === p.nim;
      const name = norm(get(r, "acara")).replace(/\s+/g, " ");
      const st = ctx.students?.get(nim);
      const ev = evByName.get(low(name));
      if (!/^\d{4,15}$/.test(nim)) errs.push("NIM tidak valid");
      else if (!st) errs.push(numeric ? "NIM belum terdaftar (cek angka 0 di depan)" : "NIM belum terdaftar");
      if (!ev) errs.push(name ? `Acara “${name}” tidak ditemukan` : "Nama acara belum diisi");
      const key = ev ? `${ev.id}|${nim}` : "";
      if (key) { if (seen.has(key)) errs.push(`Dobel dengan baris ${seen.get(key)}`); else seen.set(key, line); }
      action = ev && (ev.peserta || []).includes(nim) ? "Sudah peserta" : "Tambah";
      data = { nim, evId: ev?.id || null };
      shown = [st ? `${nim} · ${st.nama}` : nim, ev?.name || name];
    }

    if (type === "absen") {
      const p = parseNim(get(r, "nim"));
      const nim = fixNim(p.nim, p.numeric, warns), numeric = p.numeric && nim === p.nim;
      const name = norm(get(r, "acara")).replace(/\s+/g, " ");
      const date = parseDate(get(r, "tanggal"));
      const stRaw = norm(get(r, "status"));
      const status = parseStatus(stRaw);
      let reason = norm(get(r, "keterangan"));
      if (!reason && status === "tidak" && /^(izin|ijin|sakit)$/i.test(stRaw)) reason = stRaw[0].toUpperCase() + stRaw.slice(1).toLowerCase();
      const st = ctx.students?.get(nim);
      const ev = evByName.get(low(name));
      const ses = ev && date ? ev.sessions.find((s) => s.date === date) : null;
      if (!/^\d{4,15}$/.test(nim)) errs.push("NIM tidak valid");
      else if (!st) errs.push(numeric ? "NIM belum terdaftar (cek angka 0 di depan)" : "NIM belum terdaftar");
      if (!ev) errs.push(name ? `Acara “${name}” tidak ditemukan` : "Nama acara belum diisi");
      if (!date) errs.push("Tanggal tidak terbaca");
      else if (ev && !ses) errs.push("Acara tidak punya sesi di tanggal ini");
      if (ev && st && ev.pesertaOnly && !(ev.peserta || []).includes(nim)) errs.push("Bukan peserta acara ini (tambahkan dulu di Peserta acara)");
      if (!status) errs.push("Status harus Hadir / Tidak Hadir");
      if (reason.length > 280) errs.push("Keterangan maksimal 280 karakter");
      const key = ses ? `${ses.id}|${nim}` : "";
      if (key) { if (seen.has(key)) errs.push(`Dobel dengan baris ${seen.get(key)}`); else seen.set(key, line); }
      action = key && ctx.attKeys?.has(key) ? "Perbarui" : "Baru";
      data = { nim, nama: st?.nama || "", evId: ev?.id || null, sesId: ses?.id || null, status, reason: reason || null };
      shown = [st ? `${nim} · ${st.nama}` : nim, ev?.name || name, date, status ? (status === "hadir" ? "Hadir" : "Tidak Hadir") : null, reason];
    }

    const cells = raw.map((v, k) => (shown && shown[k] != null && shown[k] !== "" ? String(shown[k]) : v));
    return { line, ok: errs.length === 0, errs, warns, action, data, cells };
  });

  return { items, header, missing };
}

/* ---------- template Excel ---------- */

/** Workbook template: sheet Mahasiswa, Acara, Absensi, dan Petunjuk. */
export function buildTemplate(XLSX, PRODI, CATEGORIES) {
  const wb = XLSX.utils.book_new();
  const thin = { style: "thin", color: { rgb: "D9CFC8" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const hdr = { font: { bold: true, color: { rgb: "FFFFFF" }, name: "Calibri", sz: 11 }, fill: { fgColor: { rgb: "7A1C2B" } }, alignment: { horizontal: "center", vertical: "center" }, border };
  const body = { font: { name: "Calibri", sz: 11 }, border, alignment: { vertical: "center" } };
  const names = { mhs: "Mahasiswa", acara: "Acara", peserta: "Peserta", absen: "Absensi" };

  Object.entries(BULK_TYPES).forEach(([key, T]) => {
    const aoa = [T.cols.map(([, l]) => l), ...T.example];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = 200;
    T.cols.forEach(([k], c) => {
      const h = XLSX.utils.encode_cell({ r: 0, c });
      ws[h].s = hdr;
      for (let r = 1; r <= range; r++) {
        const a = XLSX.utils.encode_cell({ r, c });
        if (!ws[a]) ws[a] = { t: "s", v: "" };
        if (k === "nim" || k === "tanggal" || k === "mulai" || k === "selesai") { ws[a].t = "s"; ws[a].v = String(ws[a].v ?? ""); ws[a].z = "@"; }
        ws[a].s = { ...body, numFmt: k === "nim" || k === "tanggal" || k === "mulai" || k === "selesai" ? "@" : undefined, ...(r <= T.example.length ? { font: { name: "Calibri", sz: 11, color: { rgb: "8A7A7E" }, italic: true } } : {}) };
      }
    });
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range, c: T.cols.length - 1 } });
    ws["!cols"] = T.widths.map((w) => ({ wch: w }));
    ws["!rows"] = [{ hpt: 24 }];
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, names[key]);
  });

  const guide = [
    ["STAMPTech Plus · UKM TARI ASTRAtech — Petunjuk import massal"],
    [],
    ["1. Isi sheet yang dibutuhkan (Mahasiswa / Acara / Peserta / Absensi). Hapus 2 baris contoh berwarna abu-abu."],
    ["   Urutan aman: Mahasiswa → Acara → Peserta → Absensi. Sheet Peserta membatasi acara hanya untuk NIM yang didaftarkan."],
    ["2. Di aplikasi: Admin → Import → pilih jenis data → upload file ini. Sheet dipilih otomatis sesuai jenis."],
    ["3. Bisa juga: blok data di Excel/Google Sheets (termasuk judul kolom) → Ctrl+C → tempel di kolom 'Tempel dari spreadsheet'."],
    ["4. Semua baris dicek dulu. Hanya baris valid yang disimpan; baris bermasalah ditampilkan alasannya."],
    [],
    ["Format"],
    ["Tanggal", "2026-10-20 atau 20/10/2026 atau 20 Okt 2026"],
    ["Jam", "15:00 atau 15.00 atau 3:00 PM"],
    ["Status", "Hadir / Tidak Hadir (Izin dan Sakit dianggap Tidak Hadir)"],
    ["NIM", "Ketik sebagai teks supaya angka 0 di depan tidak hilang (kolom NIM di template sudah format teks)"],
    ["Jenis acara", (CATEGORIES || []).join(", ")],
    [],
    ["Kode prodi", "Nama prodi"],
    ...Object.entries(PRODI).map(([k, v]) => [k, v]),
  ];
  const wsG = XLSX.utils.aoa_to_sheet(guide);
  wsG.A1.s = { font: { bold: true, sz: 14, color: { rgb: "7A1C2B" }, name: "Calibri" } };
  ["A8", "A15", "B15"].forEach((a) => { if (wsG[a]) wsG[a].s = { font: { bold: true, name: "Calibri" } }; });
  wsG["!cols"] = [{ wch: 16 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsG, "Petunjuk");
  return wb;
}
