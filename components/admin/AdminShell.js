"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Icon from "../Icon";
import ThemeToggle, { toggleTheme } from "../ThemeToggle";
import { DataProvider, useData } from "./DataProvider";
import { supabaseBrowser } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: "chart" },
  { href: "/admin/absen", label: "Absen", icon: "scan" },
  { href: "/admin/laporan", label: "Laporan", icon: "sheet" },
  { href: "/admin/acara", label: "Acara", icon: "calendar" },
  { href: "/admin/mahasiswa", label: "Mahasiswa", icon: "users" },
  { href: "/admin/import", label: "Import", icon: "upload" },
];

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

function NavClock() {
  const [t, setT] = useState("--:--");
  useEffect(() => {
    const f = () => setT(new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(".", ":"));
    f(); const id = setInterval(f, 15000); return () => clearInterval(id);
  }, []);
  return <span>{t} WIB</span>;
}

function LiveDot() {
  const { live } = useData();
  return <span className="live-dot" style={live ? undefined : { background: "var(--faint)", animation: "none" }} title={live ? "Realtime aktif" : "Menghubungkan realtime…"} />;
}

function ErrorBanner() {
  const { error, reload } = useData();
  if (!error) return null;
  return (
    <div className="banner" style={{ marginTop: 20, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ display: "flex", gap: 10 }}><Icon name="x" />Gagal memuat data: {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Coba lagi</button>
    </div>
  );
}

export default function AdminShell({ email, nama, children }) {
  const path = usePathname();
  const router = useRouter();
  const tabsRef = useRef(null);
  const [ind, setInd] = useState({ left: 0, width: 0 });
  const [menu, setMenu] = useState(false);

  const active = TABS.find((t) => (t.href === "/admin" ? path === "/admin" : path.startsWith(t.href)))?.href;

  useIso(() => {
    const move = () => {
      const el = tabsRef.current?.querySelector(`[data-href="${active}"]`);
      if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth });
    };
    move();
    window.addEventListener("resize", move);
    document.fonts?.ready.then(move);
    return () => window.removeEventListener("resize", move);
  }, [active]);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!e.target.closest?.(".user")) setMenu(false); };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  useEffect(() => {
    const onMove = (e) => {
      const g = e.target.closest?.(".glass");
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty("--mx", `${e.clientX - r.left}px`);
      g.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <DataProvider>
      <header className="nav">
        <div className="nav-in">
          <Link href="/admin" className="brand"><img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="34" height="34" /><span className="brand-t"><span>STAMP<b>Tech</b><i className="plus">plus</i></span><small className="org">UKM TARI ASTRAtech</small></span></Link>
          <nav className="tabs" aria-label="Menu admin" ref={tabsRef}>
            <span className="tab-ind" aria-hidden="true" style={{ left: ind.left, width: ind.width }} />
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} data-href={t.href} className="tab" aria-current={active === t.href ? "page" : undefined}>
                <Icon name={t.icon} /><span>{t.label}</span>
              </Link>
            ))}
          </nav>
          <div className="nav-right">
            <div className="chip-clock"><LiveDot /><NavClock /></div>
            <ThemeToggle />
            <div className="user">
              <button className="av-btn" aria-label="Menu akun" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>{initials(nama || email) || "AD"}</button>
              {menu ? (
                <div className="menu">
                  <div className="who-m"><b>{nama}</b><span>{email}</span></div>
                  <Link href="/" target="_blank" onClick={() => setMenu(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, fontSize: "var(--t-sm)", fontWeight: 600 }}><Icon name="external" />Buka form mahasiswa</Link>
                  <button type="button" onClick={() => { toggleTheme(); setMenu(false); }}><Icon name="moon" />Ganti tema</button>
                  <button type="button" className="danger" onClick={signOut}><Icon name="logout" />Keluar</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="wrap">
        <ErrorBanner />
        <div className="view" key={path}>{children}</div>
      </main>
    </DataProvider>
  );
}

