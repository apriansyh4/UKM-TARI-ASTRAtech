"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { PRODI, PRODI_KEYS, initials } from "@/lib/utils";


export default function RegisterForm() {
  const params = useSearchParams();
  const [f, setF] = useState({ nim: "", nama: "", prodi: "", semester: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    const n = (params.get("nim") || "").replace(/\D/g, "").slice(0, 15);
    if (n) setF((o) => ({ ...o, nim: n }));
  }, [params]);

  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const fail = (m) => { setErr(m); setShake((n) => n + 1); };
  const prodi = f.prodi;

  const submit = async (e) => {
    e.preventDefault();
    const nim = f.nim.trim(), nama = f.nama.trim().replace(/\s+/g, " ");
    if (!/^\d{4,15}$/.test(nim)) return fail("NIM harus 4–15 digit angka.");
    if (nama.length < 3) return fail("Nama lengkap belum diisi.");
    if (!/^[\p{L} .,'-]+$/u.test(nama)) return fail("Nama hanya boleh berisi huruf, spasi, titik, koma, atau tanda hubung.");
    if (!PRODI_KEYS.includes(prodi)) return fail("Pilih prodi kamu.");
    if (!f.semester) return fail("Pilih semester kamu.");
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabaseBrowser().rpc("register_student", { p_nim: nim, p_nama: nama, p_prodi: prodi, p_semester: Number(f.semester) });
      if (error) throw error;
      setDone(data || { nim, nama, prodi, semester: Number(f.semester) });
    } catch (e2) {
      fail(errMsg(e2));
    } finally { setBusy(false); }
  };

  const reset = () => { setDone(null); setF({ nim: "", nama: "", prodi: "", semester: "" }); setErr(""); };

  return (
    <main className="pub">
      <div className="pub-wrap">
        <div className="pub-head">
          <img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="52" height="52" />
          <div className="t">STAMP<b>Tech</b><i className="plus">plus</i><small className="org">UKM TARI ASTRAtech</small></div>
          <ThemeToggle />
        </div>

        {done ? (
          <div className="glass pub-card" style={{ textAlign: "center", justifyItems: "center" }}>
            <svg className="ring done-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /><path d="M32 51l12 12 24-26" /></svg>
            <div>
              <h1 style={{ margin: 0 }}>Kamu sudah terdaftar.</h1>
              <p className="sub" style={{ margin: "8px auto 0" }}>Sekarang kamu bisa absen di setiap acara cukup dengan mengetik NIM.</p>
            </div>
            <div className="idcard" style={{ width: "100%", marginTop: 0 }}>
              <div className="idcard-in" style={{ textAlign: "left" }}>
                <div className="avatar">{initials(done.nama)}</div>
                <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
                  <div className="id-name">{done.nama}</div>
                  <div className="id-meta"><span className="mono">{done.nim}</span><span>{PRODI[done.prodi] || done.prodi}</span><span>Semester {done.semester}</span></div>
                </div>
              </div>
            </div>
            <div className="toolbar" style={{ justifyContent: "center", width: "100%" }}>
              <Link href="/" className="btn btn-gold btn-xl" style={{ flex: "1 1 200px" }}><Icon name="finger" />Lanjut absen</Link>
              <button type="button" className="btn btn-ghost" onClick={reset}><Icon name="plus" />Daftarkan orang lain</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <span className="kicker"><i /><span>Daftar mandiri · tanpa login</span></span>
              <h1>Belum terdaftar? Daftar di sini.</h1>
              <p className="sub">Isi sekali saja. Setelah terdaftar, data kamu otomatis muncul setiap kali absen.</p>
            </div>

            <form key={shake} className={`glass pub-card ${shake ? "shake" : ""}`} onSubmit={submit} noValidate>
              {err ? <div className="err"><Icon name="x" /><span style={{ minWidth: 0 }}>{err}</span></div> : null}
              <div>
                <label className="label" htmlFor="r-nim">NIM</label>
                <div className="field"><Icon name="idcard" /><input className="inp mono" id="r-nim" inputMode="numeric" autoComplete="off" maxLength={15} placeholder="Contoh: 0320260150" value={f.nim} onChange={(e) => set("nim", e.target.value.replace(/\D/g, ""))} /></div>
              </div>
              <div>
                <label className="label" htmlFor="r-nama">Nama lengkap</label>
                <div className="field"><Icon name="user" /><input className="inp" id="r-nama" autoComplete="name" autoCapitalize="words" maxLength={80} placeholder="Sesuai KTM" value={f.nama} onChange={(e) => set("nama", e.target.value)} /></div>
              </div>
              <div className="fg">
                <div>
                  <label className="label" htmlFor="r-prodi">Prodi</label>
                  <select className="select" id="r-prodi" value={f.prodi} onChange={(e) => set("prodi", e.target.value)}>
                    <option value="" disabled>Pilih prodi</option>
                    {PRODI_KEYS.map((p) => <option key={p} value={p}>{PRODI[p]} ({p})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="r-smt">Semester</label>
                  <select className="select" id="r-smt" value={f.semester} onChange={(e) => set("semester", e.target.value)}>
                    <option value="" disabled>Pilih semester</option>
                    {Array.from({ length: 14 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-gold btn-xl" type="submit" disabled={busy}>{busy ? <><span className="spin-s" />Mendaftarkan…</> : <><Icon name="check" />Daftar sekarang</>}</button>
              <p className="hint-sm" style={{ margin: 0, textAlign: "center" }}>Pastikan NIM benar. Kalau salah input, hubungi panitia untuk diperbaiki.</p>
            </form>
          </>
        )}

        <p className="pub-foot">Sudah terdaftar? <Link href="/">Langsung absen</Link></p>
        <p className="pub-foot copy">© 2026 UKM TARI ASTRAtech · Politeknik Astra</p>
      </div>
    </main>
  );
}
