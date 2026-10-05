/** Ditampilkan bila kunci Supabase belum diisi saat build (mis. env Vercel belum diset / belum Redeploy). */
export default function SetupNotice({ problem }) {
  const box = { background: "var(--glass-2)", border: "1px solid var(--stroke-2)", borderRadius: 12, padding: "10px 12px", fontFamily: "var(--f-mono)", fontSize: 12, overflowWrap: "anywhere" };
  return (
    <main className="center-page">
      <div className="glass" style={{ width: "min(560px,100%)", display: "grid", gap: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="52" height="52" style={{ borderRadius: 14 }} />
          <div>
            <div style={{ fontFamily: "var(--f-disp)", fontWeight: 700, letterSpacing: ".06em" }}>STAMP<b style={{ color: "var(--gold-text)" }}>Tech</b><i className="plus">plus</i></div>
            <small className="org">UKM TARI ASTRAtech</small>
          </div>
        </div>
        <h1 style={{ fontSize: "var(--t-lg)", margin: 0 }}>Aplikasi belum terhubung ke Supabase</h1>
        <p className="sub" style={{ margin: 0 }}>{problem}</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 10, fontSize: "var(--t-sm)", color: "var(--muted)" }}>
          <li>Buka Supabase → project kamu → <b>Project Settings → API</b>. Salin <b>Project URL</b> dan <b>anon public key</b>.</li>
          <li>Buka Vercel → project ini → <b>Settings → Environment Variables</b>, tambahkan dua variabel (centang Production, Preview, Development):
            <div style={{ ...box, marginTop: 8 }}>NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co<br />NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOi…</div>
          </li>
          <li>Buka tab <b>Deployments</b> → titik tiga di deployment terakhir → <b>Redeploy</b>. Variabel ini dibaca saat build, jadi wajib redeploy setelah diisi.</li>
        </ol>
      </div>
    </main>
  );
}
