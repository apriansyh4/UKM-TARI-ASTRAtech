"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { useToast } from "./Toast";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [eye, setEye] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  const fail = (m) => { setErr(m); setShake((n) => n + 1); };

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return fail("Format email belum benar.");
    if (pass.length < 6) return fail("Kata sandi minimal 6 karakter.");
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: em, password: pass });
      if (error) throw error;
      const next = params.get("next");
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (e2) {
      fail(errMsg(e2));
      setBusy(false);
    }
  };

  const forgot = async () => {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return fail("Isi email dulu, lalu klik Lupa kata sandi.");
    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(em, { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      toast("Link reset kata sandi dikirim ke email kamu", "mail");
    } catch (e2) {
      fail(errMsg(e2));
    }
  };

  return (
    <main className="login">
      <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top,0px) + 16px)", right: 16, zIndex: 5 }}><ThemeToggle /></div>
      <div className="login-grid">
        <div className="login-art">
          <div className="logo-orb">
            <span className="orbit o1" /><span className="orbit o2"><i /></span>
            <img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="230" height="230" />
          </div>
          <div className="login-brand">STAMP<b>Tech</b><i className="plus">plus</i></div>
          <div className="login-org">UKM TARI ASTRAtech</div>
          <p>Sistem absensi jam plus untuk setiap latihan dan acara UKM Tari ASTRAtech. Sekali tap, jam langsung tercatat.</p>
          <div className="feat">
            <span><Icon name="calendar" />Multi-acara</span>
            <span><Icon name="clock" />Jam per sesi</span>
            <span><Icon name="sheet" />Export Excel</span>
          </div>
        </div>

        <form key={shake} className={`glass login-card ${shake ? "shake" : ""}`} onSubmit={submit} noValidate>
          <div>
            <h2>Masuk ke dashboard</h2>
            <p className="sub" style={{ marginTop: 6 }}>Khusus panitia dan admin acara.</p>
          </div>
          {err ? <div className="err"><Icon name="x" />{err}</div> : null}
          <div>
            <label className="label" htmlFor="lg-email">Email</label>
            <div className="field">
              <Icon name="mail" />
              <input className="inp" id="lg-email" type="email" autoComplete="username" placeholder="nama@kampus.ac.id" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="lg-pass">Kata sandi</label>
            <div className="field">
              <Icon name="lock" />
              <input className="inp" id="lg-pass" type={eye ? "text" : "password"} autoComplete="current-password" placeholder="Minimal 6 karakter" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button type="button" className="eye" onClick={() => setEye(!eye)} aria-label={eye ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}><Icon name={eye ? "eyeoff" : "eye"} /></button>
            </div>
          </div>
          <div className="login-row">
            <span className="hint-sm">Sesi tersimpan di perangkat ini.</span>
            <button type="button" className="btn-text" onClick={forgot}>Lupa kata sandi?</button>
          </div>
          <button className="btn btn-gold btn-xl" type="submit" disabled={busy}>{busy ? <><span className="spin-s" />Memeriksa…</> : "Masuk"}</button>
          <Link href="/" className="student-cta">
            <span className="ic"><Icon name="finger" /></span>
            <span><b>Saya mahasiswa</b><span>Absen langsung tanpa login</span></span>
            <Icon name="arrow" />
          </Link>
        </form>
      </div>
    </main>
  );
}
