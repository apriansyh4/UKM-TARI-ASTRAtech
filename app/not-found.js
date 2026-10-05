import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="glass" style={{ width: "min(420px,100%)", display: "grid", gap: 14, textAlign: "center", padding: 32 }}>
        <img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="64" height="64" style={{ borderRadius: 16, margin: "0 auto" }} />
        <h1 style={{ fontSize: "var(--t-lg)", margin: 0 }}>Halaman tidak ditemukan</h1>
        <p className="sub" style={{ margin: 0 }}>Link ini tidak ada atau sudah dipindah.</p>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-gold">Ke form absen</Link>
          <Link href="/login" className="btn btn-ghost">Masuk admin</Link>
        </div>
      </div>
    </main>
  );
}
