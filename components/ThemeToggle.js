"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

export function currentTheme() {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("stamptech-theme", next); } catch {}
  window.dispatchEvent(new Event("stamptech-theme"));
  return next;
}

export default function ThemeToggle({ className = "icon-btn" }) {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    sync();
    window.addEventListener("stamptech-theme", sync);
    return () => window.removeEventListener("stamptech-theme", sync);
  }, []);
  return (
    <button type="button" className={className} onClick={() => setTheme(toggleTheme())} aria-label="Ganti tema terang atau gelap">
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
