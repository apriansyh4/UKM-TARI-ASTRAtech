export const STATUS = { hadir: "Hadir", tidak: "Tidak Hadir" };
export const STATUS_KEYS = ["hadir", "tidak"];
export const ST_ICON = { hadir: "check", tidak: "x" };
export const REASONS = ["Sakit", "Izin keluarga", "Bentrok jadwal kuliah", "Tugas organisasi lain"];
export const CATEGORIES = ["Latihan", "Kepanitiaan", "Kerja Bakti", "Rapat", "Kegiatan"];
export const CAT_ICON = { Latihan: "spark", Kepanitiaan: "users", "Kerja Bakti": "leaf", Rapat: "chat", Kegiatan: "flag" };
/** 9 program studi Politeknik Astra (kode → nama). */
export const PRODI = {
  P4: "Teknik Pembuatan Peralatan Perkakas Produksi",
  TPM: "Teknik Produksi dan Proses Manufaktur",
  MI: "Manajemen Informatika",
  MO: "Mesin Otomotif",
  MK: "Mekatronika",
  TKBG: "Teknologi Konstruksi Bangunan Gedung",
  TRPAB: "Teknologi Rekayasa Pemeliharaan Alat Berat",
  TRL: "Teknologi Rekayasa Logistik",
  TRPL: "Teknologi Rekayasa Perangkat Lunak",
};
export const PRODI_KEYS = Object.keys(PRODI);
export const MON = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export const pad = (n) => String(n).padStart(2, "0");

/** Tanggal hari ini di WIB (YYYY-MM-DD), apa pun zona waktu perangkat. */
export function todayJakarta() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return p; // en-CA => YYYY-MM-DD
}
/** Menit sejak tengah malam WIB. */
export function nowMinutesJakarta() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t) => Number(parts.find((x) => x.type === t)?.value || 0);
  return (g("hour") % 24) * 60 + g("minute") + g("second") / 60;
}

export const dObj = (iso) => new Date(iso + "T00:00:00");
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const shiftDate = (iso, n) => { const d = dObj(iso); d.setDate(d.getDate() + n); return isoOf(d); };
export function datesBetween(a, b, max = 400) {
  const out = []; let d = dObj(a); const e = dObj(b);
  while (d <= e && out.length < max) { out.push(isoOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export const hhmm = (t) => (t || "00:00").slice(0, 5);
export const toMin = (t) => { const [h, m] = hhmm(t).split(":").map(Number); return h * 60 + m; };
export const hrsOf = (s) => (s ? Math.max(0, (toMin(s.jam_selesai) - toMin(s.jam_mulai)) / 60) : 0);
export const clock = (t) => hhmm(t).replace(":", ".");
export const rangeOf = (s) => `${clock(s.jam_mulai)} – ${clock(s.jam_selesai)}`;
export const fmtJam = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 });
export const fmtLong = (iso) => dObj(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtShort = (iso) => dObj(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
export const fmtWeekday = (iso) => dObj(iso).toLocaleDateString("id-ID", { weekday: "short" });
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
export const xlsDate = (iso) => { const d = dObj(iso); return `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
export const initials = (n = "") => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
export function avatarStyle(nim = "") {
  let h = 0; for (const c of nim) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { background: `linear-gradient(135deg,hsl(${(h % 50) + 340} 55% 38%),hsl(${(h % 40) + 20} 80% 50%))`, color: "#FFF6EA" };
}
export const greeting = () => {
  const h = Math.floor(nowMinutesJakarta() / 60);
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
};
export const sortByDate = (a, b) => a.tanggal.localeCompare(b.tanggal);
/** Urutkan NIM dari angka terkecil ke terbesar (aman untuk NIM dengan 0 di depan / beda panjang). */
export function cmpNim(a, b) {
  const x = String(a ?? "").replace(/\D/g, "").replace(/^0+/, ""), y = String(b ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0) || String(a).localeCompare(String(b));
}
export const slug = (s) => s.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
export function eventRange(ev) {
  const d = (ev.sessions || []).map((s) => s.tanggal).sort();
  if (!d.length) return "Belum ada jadwal";
  return d[0] === d.at(-1) ? fmtShort(d[0]) : `${fmtShort(d[0])} – ${fmtShort(d.at(-1))}`;
}
/** Lokasi sebuah sesi: lokasi khusus tanggal itu, kalau kosong pakai lokasi default acara. */
export const sesLoc = (s, ev) => (s?.lokasi || "").trim() || ev?.location || "";
/** Ringkasan lokasi acara untuk kartu: satu nama, atau "N lokasi". */
export function locSummary(ev) {
  const set = new Set((ev.sessions || []).map((s) => sesLoc(s, ev)).filter(Boolean));
  if (!set.size) return ev.location || "-";
  return set.size === 1 ? [...set][0] : `${set.size} lokasi`;
}
/** Boleh diabsen di acara ini? (acara terbuka = semua mahasiswa; dibatasi = hanya peserta) */
export const isPeserta = (ev, nim) => !ev?.peserta_only || (ev.peserta || []).includes(nim);
/** Label kepesertaan untuk kartu acara. */
export const pesertaLabel = (ev) => (ev?.peserta_only ? `${(ev.peserta || []).length} peserta` : "Semua mahasiswa");
export const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
/** Sesi default: hari ini, kalau tidak ada sesi terdekat berikutnya, kalau tidak ada sesi terakhir. */
export function pickSession(ev) {
  if (!ev || !ev.sessions?.length) return null;
  const t = todayJakarta();
  const s = [...ev.sessions].sort(sortByDate);
  return (s.find((x) => x.tanggal === t) || s.find((x) => x.tanggal > t) || s.at(-1)).id;
}
