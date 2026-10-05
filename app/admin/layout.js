import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import SignOutButton from "@/components/admin/SignOutButton";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }) {
  const sb = supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await sb.from("admins").select("nama").eq("user_id", user.id).maybeSingle();

  if (!admin) {
    return (
      <main className="center-page">
        <div className="glass" style={{ width: "min(460px,100%)", display: "grid", gap: 16, textAlign: "center", padding: 32 }}>
          <img src="/logo.webp" alt="Logo STAMPTech Plus" width="72" height="72" style={{ borderRadius: 18, margin: "0 auto" }} />
          <h2 style={{ justifyContent: "center", fontSize: "var(--t-lg)" }}>Akun belum terdaftar sebagai admin</h2>
          <p className="sub" style={{ margin: 0 }}>
            Kamu masuk sebagai <b>{user.email}</b>, tapi akun ini belum ada di tabel <code>admins</code>. Minta admin utama menambahkan akunmu.
          </p>
          <div className="toolbar" style={{ justifyContent: "center" }}>
            <SignOutButton />
            <Link href="/" className="btn btn-gold">Ke form absen</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AdminShell email={user.email} nama={admin.nama || "Admin"}>
      {children}
    </AdminShell>
  );
}
