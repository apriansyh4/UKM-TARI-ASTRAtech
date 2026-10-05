"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "../Icon";
import Modal from "../Modal";
import { useToast } from "../Toast";
import { useData } from "./DataProvider";
import { ConfirmDelete, Empty, Hero, Kpi, MiniAv, SkeletonRows } from "./ui";
import QrShare from "./QrShare";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { PRODI, PRODI_KEYS, fmtJam, pad } from "@/lib/utils";

function StudentForm({ open, initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ nim: "", nama: "", prodi: "", semester: 1 });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState(null);
  const key = open ? initial?.nim || "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) { setErr(""); setF(initial ? { nim: initial.nim, nama: initial.nama, prodi: initial.prodi, semester: initial.semester } : { nim: "", nama: "", prodi: "", semester: 1 }); }
  }
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    const nim = f.nim.trim(), nama = f.nama.trim().replace(/\s+/g, " "), prodi = f.prodi;
    if (!/^\d{4,15}$/.test(nim)) return setErr("NIM harus 4–15 digit angka.");
    if (nama.length < 3) return setErr("Nama lengkap belum diisi.");
    if (!PRODI_KEYS.includes(prodi)) return setErr("Pilih prodi.");
    setBusy(true); setErr("");
    try {
      const sb = supabaseBrowser();
      const row = { nim, nama, prodi, semester: Number(f.semester) };
      const { error } = initial ? await sb.from("students").update(row).eq("nim", initial.nim) : await sb.from("students").insert(row);
      if (error) throw error;
      toast(initial ? "Data mahasiswa diperbarui" : `${nama.split(" ")[0]} ditambahkan`, initial ? "check" : "user");
      onSaved(initial && initial.nim !== nim);
    } catch (e2) { setErr(errMsg(e2)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Ubah data mahasiswa" : "Tambah mahasiswa"} width={520} as="form" onSubmit={save}>
      <div className="fg">
        <div className="full"><label className="label" htmlFor="s-nim">NIM</label><input className="inp mono" id="s-nim" inputMode="numeric" maxLength={15} placeholder="0920250058" value={f.nim} onChange={(e) => set("nim", e.target.value.replace(/\D/g, ""))} autoFocus={!initial} /></div>
        <div className="full"><label className="label" htmlFor="s-nama">Nama lengkap</label><input className="inp" id="s-nama" placeholder="Nama sesuai KTM" value={f.nama} onChange={(e) => set("nama", e.target.value)} autoFocus={!!initial} /></div>
        <div>
          <label className="label" htmlFor="s-prodi">Prodi</label>
          <select className="select" id="s-prodi" value={f.prodi} onChange={(e) => set("prodi", e.target.value)}>
            <option value="" disabled>Pilih prodi</option>
            {f.prodi && !PRODI[f.prodi] ? <option value={f.prodi}>{f.prodi} (lama)</option> : null}
            {PRODI_KEYS.map((p) => <option key={p} value={p}>{PRODI[p]} ({p})</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="s-smt">Semester</label><select className="select" id="s-smt" value={f.semester} onChange={(e) => set("semester", e.target.value)}>{Array.from({ length: 14 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}</select></div>
      </div>
      {initial ? <p className="hint-sm" style={{ margin: "14px 0 0" }}>Kalau NIM diubah, data absen lamanya ikut pindah ke NIM baru.</p> : null}
      {err ? <div className="err" style={{ marginTop: 16 }}><Icon name="x" />{err}</div> : null}
      <div className="toolbar" style={{ justifyContent: "flex-end", marginTop: 24 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? <><span className="spin-s" />Menyimpan…</> : "Simpan"}</button>
      </div>
    </Modal>
  );
}


export default function Mahasiswa() {
  const { students, att, loading, jamOf, loadStudents, loadAtt } = useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [prodi, setProdi] = useState("");
  const [modal, setModal] = useState({ open: false, st: null });
  const [via, setVia] = useState("");
  const [share, setShare] = useState(false);

  const prodis = useMemo(() => [...new Set([...PRODI_KEYS, ...students.map((s) => s.prodi)])], [students]);
  const per = useMemo(() => { const m = new Map(); att.forEach((a) => { const p = m.get(a.nim) || { n: 0, jam: 0 }; p.n++; p.jam += jamOf(a); m.set(a.nim, p); }); return m; }, [att, jamOf]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => (!prodi || x.prodi === prodi) && (!via || (x.registered_via || "admin") === via) && (!s || `${x.nim} ${x.nama}`.toLowerCase().includes(s)));
  }, [students, q, prodi, via]);
  const mandiri = students.filter((s) => s.registered_via === "mandiri").length;
  const withJam = students.filter((s) => (per.get(s.nim)?.jam || 0) > 0).length;

  const remove = async (s) => {
    try {
      const { error } = await supabaseBrowser().from("students").delete().eq("nim", s.nim);
      if (error) throw error;
      await Promise.all([loadStudents(), loadAtt()]);
      toast(`${s.nama.split(" ")[0]} dihapus`, "trash");
    } catch (e) { toast(errMsg(e), "x"); }
  };


  return (
    <section>
      <Hero kicker="Mahasiswa" title="Data" hl="mahasiswa" sub="Dua cara input: admin menambahkan di sini (satu per satu atau import CSV), atau mahasiswa daftar sendiri lewat form daftar mandiri.">
        <button className="btn btn-ghost" onClick={() => setShare(true)}><Icon name="qr" />Link daftar mandiri</button>
        <Link className="btn btn-ghost" href="/admin/import?type=mhs"><Icon name="upload" />Import massal</Link>
        <button className="btn btn-gold" onClick={() => setModal({ open: true, st: null })}><Icon name="plus" />Tambah mahasiswa</button>
      </Hero>

      <div className="bento">
        <Kpi className="s4" hero icon="users" label="Total mahasiswa" value={students.length} unit="terdaftar" />
        <Kpi className="s4" icon="user" label="Daftar mandiri" value={mandiri} unit="mahasiswa" />
        <Kpi className="s4" icon="bolt" label="Sudah dapat jam plus" value={withJam} unit="mahasiswa" />
        <div className="glass s12">
          <div className="card-head">
            <h2><Icon name="idcard" />Daftar mahasiswa</h2>
            <div className="toolbar">
              <div className="search" style={{ minWidth: 220 }}><Icon name="search" /><input className="inp" placeholder="Cari nama atau NIM" aria-label="Cari mahasiswa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select className="select" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Filter prodi" style={{ width: "auto" }}>
                <option value="">Semua prodi</option>{prodis.map((p) => <option key={p} value={p}>{PRODI[p] ? `${p} · ${PRODI[p]}` : p}</option>)}
              </select>
              <select className="select" value={via} onChange={(e) => setVia(e.target.value)} aria-label="Filter cara input" style={{ width: "auto" }}>
                <option value="">Semua cara input</option><option value="admin">Diinput admin</option><option value="mandiri">Daftar mandiri</option>
              </select>
            </div>
          </div>
          <div className="tbl">
            <table style={{ minWidth: 760 }}>
              <thead><tr><th>No</th><th>Mahasiswa</th><th>NIM</th><th>Prodi</th><th className="c">Smt</th><th className="r">Total jam plus</th><th className="r">Aksi</th></tr></thead>
              <tbody>
                {loading ? <SkeletonRows cols={7} /> : list.length ? list.map((s, i) => {
                  const p = per.get(s.nim) || { n: 0, jam: 0 };
                  return (
                    <tr key={s.nim}>
                      <td className="dim mono">{pad(i + 1)}</td>
                      <td><div className="who"><MiniAv st={s} /><span>{s.nama}</span>{s.registered_via === "mandiri" ? <span className="src-badge" title="Daftar sendiri lewat form publik">mandiri</span> : null}</div></td>
                      <td className="mono dim">{s.nim}</td><td className="dim" title={PRODI[s.prodi] || ""}>{s.prodi}</td><td className="c mono">{s.semester}</td>
                      <td className="r"><span className={`jam ${p.jam ? "" : "z"}`}>{fmtJam(p.jam)} jam</span></td>
                      <td><div className="row-act">
                        <button className="del edit" onClick={() => setModal({ open: true, st: s })} aria-label={`Ubah ${s.nama}`}><Icon name="edit" /></button>
                        <ConfirmDelete label={`Hapus ${s.nama}`} confirmLabel={p.n ? `Hapus + ${p.n} absen?` : "Yakin hapus?"} onConfirm={() => remove(s)} />
                      </div></td>
                    </tr>
                  );
                }) : <tr><td colSpan={7}><Empty icon="users">{students.length ? "Tidak ada yang cocok." : "Belum ada mahasiswa. Tambah satu per satu atau import CSV."}</Empty></td></tr>}
              </tbody>
            </table>
          </div>
          <p className="hint-sm" style={{ margin: "14px 0 0" }}>Punya banyak data? Pakai <Link href="/admin/import?type=mhs" style={{ color: "var(--gold-text)", fontWeight: 700 }}>Import massal</Link> dari Excel, CSV, atau tempel langsung dari spreadsheet.</p>
        </div>
      </div>

      <QrShare open={share} onClose={() => setShare(false)} path="/daftar" title="Link daftar mandiri" desc="Bagikan link atau QR ini supaya mahasiswa baru bisa mendaftarkan dirinya sendiri, tanpa menunggu admin." note="NIM yang sudah terdaftar tidak bisa ditimpa lewat form ini. Data yang salah bisa diperbaiki admin di halaman ini." />
      <StudentForm open={modal.open} initial={modal.st} onClose={() => setModal({ open: false, st: null })}
        onSaved={async (nimChanged) => { setModal({ open: false, st: null }); await loadStudents(); if (nimChanged) await loadAtt(); }} />
    </section>
  );
}
