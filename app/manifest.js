export default function manifest() {
  return {
    name: "STAMPTech Plus · UKM TARI ASTRAtech",
    short_name: "STAMPTech",
    description: "Sistem absensi jam plus UKM TARI ASTRAtech untuk setiap latihan dan acara.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0407",
    theme_color: "#0A0407",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
