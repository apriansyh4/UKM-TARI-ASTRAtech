import "./globals.css";
import Background from "@/components/Background";
import { ToastProvider } from "@/components/Toast";
import SetupNotice from "@/components/SetupNotice";

export const metadata = {
  title: { default: "STAMPTech Plus · UKM TARI ASTRAtech", template: "%s · STAMPTech Plus" },
  description: "Sistem absensi jam plus UKM TARI ASTRAtech untuk setiap latihan dan acara.",
  applicationName: "STAMPTech Plus",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "STAMPTech Plus", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0407" },
    { media: "(prefers-color-scheme: light)", color: "#F6EFEA" },
  ],
};

// set tema sebelum render pertama supaya tidak berkedip
const themeScript = `try{var t=localStorage.getItem('stamptech-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

function supabaseProblem() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return "Variabel NEXT_PUBLIC_SUPABASE_URL dan/atau NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi saat aplikasi di-build.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url.trim()) && !/^https?:\/\//i.test(url.trim())) return "NEXT_PUBLIC_SUPABASE_URL tidak valid. Isi dengan Project URL, contoh https://abcdxyz.supabase.co (tanpa /rest/v1).";
  if (key.trim().split(".").length !== 3 && !key.trim().startsWith("sb_publishable_")) return "NEXT_PUBLIC_SUPABASE_ANON_KEY tidak valid. Salin anon public key (bukan service_role).";
  return "";
}

export default function RootLayout({ children }) {
  const problem = supabaseProblem();
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
      <body>
        <Background />
        <ToastProvider>{problem ? <SetupNotice problem={problem} /> : children}</ToastProvider>
      </body>
    </html>
  );
}
