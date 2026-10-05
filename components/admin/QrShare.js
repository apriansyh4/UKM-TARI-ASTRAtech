"use client";
import { useEffect, useState } from "react";
import Icon from "../Icon";
import Modal from "../Modal";
import { useToast } from "../Toast";

/** Modal QR + link untuk halaman publik (form absen / form daftar). */
export default function QrShare({ open, onClose, path = "/", title = "Bagikan form absen", desc, note }) {
  const toast = useToast();
  const [img, setImg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!open) return;
    const u = `${window.location.origin}${path}`;
    setUrl(u); setImg("");
    import("qrcode")
      .then((QR) => (QR.default || QR).toDataURL(u, { width: 480, margin: 1, color: { dark: "#4A0F1B", light: "#FFFFFF" }, errorCorrectionLevel: "M" }))
      .then(setImg)
      .catch(() => setImg(""));
  }, [open, path]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link disalin", "copy"); }
    catch { toast("Salin manual dari kolom link", "copy"); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} width={460}>
      <p className="sub" style={{ margin: "0 0 18px" }}>{desc || "Mahasiswa cukup scan QR atau buka link ini. Tidak perlu login."}</p>
      <div className="qr-box">{img ? <img src={img} alt={`QR code ${title}`} width="220" height="220" /> : <div className="skel" style={{ width: 220, height: 220 }} />}</div>
      <div className="linkrow" style={{ marginTop: 18 }}>
        <input className="inp" readOnly value={url} aria-label="Link" onFocus={(e) => e.target.select()} />
        <button className="btn btn-gold btn-sm" type="button" onClick={copy}><Icon name="copy" />Salin</button>
      </div>
      {note ? <p className="meta" style={{ margin: "14px 0 0" }}>{note}</p> : null}
    </Modal>
  );
}
