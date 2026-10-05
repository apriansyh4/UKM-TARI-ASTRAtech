"use client";
import { useEffect } from "react";
import Icon from "./Icon";

export default function Modal({ open, title, onClose, children, width = 700, as = "div", onSubmit }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const Tag = as;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <Tag className="glass modal-in" style={{ width: `min(${width}px,100%)` }} onSubmit={onSubmit} noValidate={as === "form" ? true : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="x" /></button>
        </div>
        {children}
      </Tag>
    </div>
  );
}
