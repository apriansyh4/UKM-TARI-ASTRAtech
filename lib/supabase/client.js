"use client";
import { createBrowserClient } from "@supabase/ssr";

let client;

/** Supabase client untuk komponen browser. Panggil di dalam effect/handler, bukan saat render. */
export function supabaseBrowser() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
    }
    client = createBrowserClient(url, key);
  }
  return client;
}

/** Ambil semua baris (melewati batas 1000 baris PostgREST). */
export async function fetchAll(buildQuery, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

/** Ubah error Supabase/Postgres jadi kalimat yang enak dibaca. */
export function errMsg(e) {
  const m = (e && (e.message || e.error_description)) || String(e || "Terjadi kesalahan");
  if (/duplicate key/i.test(m) && /students_pkey/.test(m)) return "NIM sudah terdaftar.";
  if (/sessions_event_tanggal_key/.test(m)) return "Ada dua sesi di tanggal yang sama.";
  if (/sessions_jam_valid/.test(m)) return "Jam selesai harus setelah jam mulai.";
  if (/Invalid login credentials/i.test(m)) return "Email atau kata sandi salah.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Koneksi bermasalah. Cek internet lalu coba lagi.";
  return m;
}
