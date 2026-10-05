"use client";
import { useMemo, useState } from "react";
import Icon from "../Icon";
import Modal from "../Modal";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { Empty, MiniAv } from "./ui";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";

const chunks = (a, n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Simpan perubahan peserta sebuah acara (tambah/hapus selisihnya saja). */
export async function syncPeserta(sb, eventId, before, sel) {
  const prev = new Set(before || []);
  const add = [...sel].filter((n) => !prev.has(n));
  const rem = [...prev].filter((n) => !sel.has(n));
  for (const part of chunks(add)) {
    const { error } = await sb.from("event_participants").upsert(part.map((nim) => ({ event_id: eventId, nim })), { onConflict: "event_id,nim", ignoreDuplicates: true });
    if (error) throw error;
  }
  for (const part of chunks(rem, 200)) {
    const { error } = await sb.from("event_participants").delete().eq("event_id", eventId).in("nim", part);
    if (error) throw error;
  }
}

/**
 * Pemilih peserta (dipakai di form Acara baru/Ubah dan di jendela Peserta).
 * Mode "Semua mahasiswa": siapa pun yang terdaftar bisa diabsen.
 * Mode "Hanya peserta terpilih": hanya yang dicentang yang bisa diabsen (form publik & admin).
 */
export function PesertaPicker({ only, setOnly, sel, setSel, compact = false }) {
  const { students } = useData();
  const [q, setQ] = useState("");
  const [prodi, setProdi] = useState("");
  const [smt, setSmt] = useState("");
  const [show, setShow] = useState("all");
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");

  const prodis = useMemo(() => [...new Set(students.map((s) => s.prodi))].sort(), [students]);
  const smts = useMemo(() => [...new Set(students.map((s) => s.semester))].sort((a, b) => a - b), [students]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => (!prodi || x.prodi === prodi) && (!smt || String(x.semester) === smt)
      && (show === "all" || (show === "in" ? sel.has(x.nim) : !sel.has(x.nim)))
      && (!s || `${x.nim} ${x.nama}`.toLowerCase().includes(s)));
  }, [students, q, prodi, smt, show, sel]);

  const toggle = (nim) => setSel((o) => { const n = new Set(o); n.has(nim) ? n.delete(nim) : n.add(nim); return n; });
  const allShownIn = list.length > 0 && list.every((x) => sel.has(x.nim));
  const toggleShown = () => setSel((o) => { const n = new Set(o); list.forEach((x) => (allShownIn ? n.delete(x.nim) : n.add(x.nim))); return n; });

  const addPasted = () => {
    const tokens = paste.split(/[\s,;]+/).map((t) => t.replace(/\D/g, "")).filter(Boolean);
    if (!tokens.length) return setNote("Tempel daftar NIM dulu (satu per baris, atau dipisah koma/spasi).");
    const byNim = new Map(students.map((s) => [s.nim, s]));
    // Excel sering menghapus angka 0 di depan NIM: coba cocokkan dengan menambah 0
    const find = (t) => byNim.get(t) || byNim.get(t.padStart(10, "0")) || students.find((s) => s.nim.replace(/^0+/, "") === t.replace(/^0+/, ""));
    const found = [], missing = [];
    tokens.forEach((t) => { const s = find(t); s ? found.push(s.nim) : missing.push(t); });
    setSel((o) => new Set([...o, ...found]));
    setOnly(true);
    setPaste("");
    setNote(`${new Set(found).size} NIM ditambahkan sebagai peserta.${missing.length ? ` ${missing.length} tidak ditemukan: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}. Daftarkan dulu di menu Mahasiswa.` : ""}`);
  };

  return (
    <div className={compact ? "ppick compact" : "ppick"}>
      <div className="pmode" role="radiogroup" aria-label="Siapa yang bisa diabsen">
        <button type="button" role="radio" aria-checked={only} onClick={() => setOnly(true)}>
          <Icon name="check" /><span><b>Hanya peserta terpilih</b><small>Yang tidak dipilih tidak bisa absen</small></span>
        </button>
        <button type="button" role="radio" aria-checked={!only} onClick={() => setOnly(false)}>
          <Icon name="users" /><span><b>Semua mahasiswa</b><small>Siapa pun yang terdaftar bisa absen</small></span>
        </button>
      </div>

      {only ? (
        <>
          <div className="psum">
            <span><b>{sel.size}</b> dari {students.length} mahasiswa dipilih</span>
            <div className="seg" role="tablist">
              {[["all", "Semua"], ["in", "Peserta"], ["out", "Bukan peserta"]].map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>)}
            </div>
          </div>
          <div className="toolbar ptools">
            <div className="search"><Icon name="search" /><input className="inp" placeholder="Cari nama atau NIM" aria-label="Cari mahasiswa" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} /></div>
            <select className="select" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Filter prodi"><option value="">Semua prodi</option>{prodis.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select className="select" value={smt} onChange={(e) => setSmt(e.target.value)} aria-label="Filter semester"><option value="">Semua semester</option>{smts.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select>
          </div>
          <div className="plist">
            {list.length ? (
              <>
                <label className="prow all"><input type="checkbox" checked={allShownIn} onChange={toggleShown} /><span>{allShownIn ? "Batalkan semua yang tampil" : `Pilih semua yang tampil (${list.length})`}</span></label>
                {list.map((s) => (
                  <label key={s.nim} className={`prow ${sel.has(s.nim) ? "on" : ""}`}>
                    <input type="checkbox" checked={sel.has(s.nim)} onChange={() => toggle(s.nim)} />
                    <MiniAv st={s} />
                    <span className="pn"><b>{s.nama}</b><small className="mono">{s.nim} · {s.prodi} · Smt {s.semester}</small></span>
                  </label>
                ))}
              </>
            ) : <Empty icon="users">{students.length ? "Tidak ada yang cocok." : "Belum ada mahasiswa terdaftar. Tambahkan dulu di menu Mahasiswa."}</Empty>}
          </div>
          <details className="ppaste">
            <summary><Icon name="upload" />Tempel daftar NIM sekaligus</summary>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Contoh:\n0320230012\n0320240041\n0320250079"} aria-label="Daftar NIM peserta" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={addPasted}><Icon name="plus" />Tambahkan sebagai peserta</button>
          </details>
        </>
      ) : <p className="hint-sm" style={{ margin: "14px 0 0" }}>Semua {students.length} mahasiswa terdaftar bisa diabsen di acara ini. Pilih <b>Hanya peserta terpilih</b> kalau acara ini cuma untuk sebagian anggota.</p>}
      {note ? <p className="hint-sm" style={{ margin: "12px 0 0", color: "var(--gold-text)" }}>{note}</p> : null}
    </div>
  );
}

/** Jendela atur peserta dari kartu acara (untuk mengedit peserta acara yang sudah ada). */
export default function PesertaModal({ open, ev, onClose, onSaved }) {
  const toast = useToast();
  const [only, setOnly] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState(null);

  const key = open ? ev?.id : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open && ev) { setOnly(!!ev.peserta_only); setSel(new Set(ev.peserta || [])); setErr(""); }
  }

  const save = async () => {
    if (!ev) return;
    if (only && !sel.size) return setErr("Pilih minimal satu peserta, atau ubah ke mode Semua mahasiswa.");
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      await syncPeserta(sb, ev.id, ev.peserta, sel);
      if (!!ev.peserta_only !== only) {
        const { error } = await sb.from("events").update({ peserta_only: only }).eq("id", ev.id);
        if (error) throw error;
      }
      toast(only ? `${sel.size} peserta disimpan` : "Acara terbuka untuk semua mahasiswa", "users");
      onSaved();
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={ev ? `Peserta · ${ev.name}` : "Peserta"} width={780}>
      {open && ev ? <PesertaPicker key={ev.id} only={only} setOnly={setOnly} sel={sel} setSel={setSel} /> : null}
      {err ? <div className="err" style={{ marginTop: 14 }}><Icon name="x" />{err}</div> : null}
      <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 20 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button type="button" className="btn btn-gold" onClick={save} disabled={busy}>{busy ? <><span className="spin-s" />Menyimpan…</> : only ? `Simpan ${sel.size} peserta` : "Simpan"}</button>
      </div>
    </Modal>
  );
}
