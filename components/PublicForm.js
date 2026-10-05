"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";
import { useToast } from "./Toast";
import { EventSelect, NimField, ReasonBox, StatusPicker, StudentCard, SuccessOverlay } from "./checkin";
import { supabaseBrowser, errMsg } from "@/lib/supabase/client";
import { MON, STATUS, fmtShort, fmtJam, fmtLong, fmtTime, greeting, hrsOf, pad, rangeOf, todayJakarta, dObj } from "@/lib/utils";

export default function PublicForm() {
  const toast = useToast();
  const [events, setEvents] = useState(null); // rows dari public_open_events
  const [loadErr, setLoadErr] = useState("");
  const [evId, setEvId] = useState(null);
  const [nim, setNim] = useState("");
  const [st, setSt] = useState(null);
  const [status, setStatus] = useState(null);
  const [chip, setChip] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [greet, setGreet] = useState("Absen tanpa login");

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowser().rpc("public_open_events");
      if (error) throw error;
      const rows = (data || []).map((r) => ({
        id: r.event_id, name: r.name, category: r.category, location: r.location,
        statuses: r.statuses || [], reason_required: r.reason_required || [], counts_jam_plus: r.counts_jam_plus,
        session: r.session_id ? { id: r.session_id, tanggal: r.tanggal, jam_mulai: r.jam_mulai, jam_selesai: r.jam_selesai } : null,
        isToday: !!r.is_today, peserta_only: !!r.peserta_only,
      }));
      setEvents(rows);
      setLoadErr("");
      setEvId((cur) => (rows.some((e) => e.id === cur) ? cur : (rows.find((e) => e.isToday) || rows[0])?.id || null));
    } catch (e) {
      setEvents([]);
      setLoadErr(errMsg(e));
    }
  }, []);

  useEffect(() => {
    setGreet(`${greeting()} · tanpa login`);
    load();
    const t = setInterval(load, 5 * 60 * 1000); // segarkan tiap 5 menit (pergantian hari / acara baru)
    return () => clearInterval(t);
  }, [load]);

  const ev = events?.find((e) => e.id === evId) || null;
  const ses = ev?.isToday ? ev.session : null;
  const required = !!(ev && status && ev.reason_required.includes(status));
  const reasonOpen = !!status && (status !== "hadir" || required);
  const notPeserta = !!(st && st.is_peserta === false);
  const ok = !!(ses && st && status && (!required || text.trim() || chip)) && !busy && !notPeserta;

  const lookup = useCallback(async (v) => {
    const { data, error } = await supabaseBrowser().rpc("lookup_student", { p_nim: v, p_session: ses?.id || null });
    if (error) throw error;
    return data?.[0] || null;
  }, [ses?.id]);

  // muat ulang info mahasiswa saat ganti acara (untuk cek sudah absen)
  useEffect(() => {
    if (!st) return;
    lookup(st.nim).then((r) => r && setSt(r)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evId]);

  const pickEvent = (id) => { setEvId(id); setStatus(null); setChip(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const reason = [chip, text.trim()].filter(Boolean).join(" — ") || null;
      const { data, error } = await supabaseBrowser().rpc("submit_attendance", { p_session: ses.id, p_nim: st.nim, p_status: status, p_reason: reason });
      if (error) throw error;
      const jam = Number(data?.jam || 0);
      setDone({ key: Date.now(), status, big: jam ? `+${fmtJam(jam)} jam` : STATUS[status], sub: `${st.nama} tercatat ${STATUS[status].toLowerCase()}${data?.updated ? " (diperbarui)" : ""}`, hold: 2600 });
      setNim(""); setSt(null); setStatus(null); setChip(null); setText("");
    } catch (err) {
      toast(errMsg(err), "x");
    } finally {
      setBusy(false);
    }
  };

  const d = ses ? dObj(ses.tanggal) : null;

  return (
    <main className="pub">
      <div className="pub-wrap">
        <div className="pub-head">
          <img src="/logo.webp" alt="Logo UKM Tari ASTRAtech" width="52" height="52" />
          <div className="t">STAMP<b>Tech</b><i className="plus">plus</i><small className="org">UKM TARI ASTRAtech</small></div>
          <ThemeToggle />
        </div>
        <div>
          <span className="kicker"><i /><span>{greet}</span></span>
          <h1>Isi absen kamu di sini.</h1>
          <p className="sub">Pilih acara, ketik NIM, lalu pilih status kehadiran. Data kamu terisi otomatis.</p>
        </div>

        <form className="glass pub-card" onSubmit={submit} noValidate>
          {loadErr ? <div className="banner"><Icon name="x" /><span>Tidak bisa memuat acara: {loadErr}</span></div> : null}
          <div>
            <label className="label" htmlFor="pEv">1 · Pilih acara</label>
            {events === null ? <div className="skel" style={{ height: 58, borderRadius: 16 }} /> : (
              <EventSelect id="pEv" events={events} value={evId} onChange={pickEvent} emptyText="Belum ada acara yang dibuka"
                sub={(e) => `${e.isToday ? "ada sesi hari ini" : e.session ? `berikutnya ${fmtShort(e.session.tanggal)}` : "selesai"}${e.peserta_only ? " · khusus peserta" : ""}`} />
            )}
          </div>

          {ev ? (
            ses ? (
              <div className="pub-ses">
                <div className="big"><b>{pad(d.getDate())}</b><small>{MON[d.getMonth()]}</small></div>
                <div className="info">
                  <b>{ev.name}</b>
                  <span>{fmtLong(ses.tanggal)} · {rangeOf(ses)}</span>
                  {ev.location ? <span><Icon name="pin" style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 4 }} />{ev.location}</span> : null}
                  <span style={{ color: "var(--gold-text)", fontWeight: 700 }}>{ev.counts_jam_plus ? `+${fmtJam(hrsOf(ses))} jam plus kalau hadir` : "Tidak dihitung jam plus"}</span>
                </div>
              </div>
            ) : (
              <div className="pub-ses none">
                <div className="big"><Icon name="calendar" /></div>
                <div className="info"><b>Belum ada sesi hari ini</b><span>{ev.session ? `Sesi berikutnya ${fmtLong(ev.session.tanggal)} · ${rangeOf(ev.session)}${ev.location ? ` · ${ev.location}` : ""}` : "Acara ini sudah selesai."}</span></div>
              </div>
            )
          ) : null}

          <div className={`form-gap ${ses ? "" : "pub-lock"}`} aria-disabled={!ses}>
            <div>
              <label className="label" htmlFor="pNim">2 · NIM</label>
              <NimField id="pNim" value={nim} onValue={setNim} lookup={lookup} onResult={(r) => setSt(r)} registerHref={`/daftar?nim=${nim}`} />
              <div style={{ marginTop: st ? 16 : 0 }}>
                <StudentCard
                  st={st}
                  jamValue={st?.total_jam}
                  jamLabel="total jam plus kamu"
                  warn={notPeserta ? "Kamu tidak terdaftar sebagai peserta acara ini. Hubungi panitia kalau seharusnya ikut." : null}
                  note={st?.existing_status ? `Kamu sudah absen ${STATUS[st.existing_status]} pukul ${fmtTime(st.existing_at)}. Kirim lagi kalau mau mengubah.` : null}
                />
              </div>
            </div>
            <div>
              <span className="label">3 · Status kehadiran</span>
              <StatusPicker allowed={ev?.statuses || []} value={status} onChange={setStatus} />
            </div>
            <ReasonBox id="pReason" open={reasonOpen} required={required} chip={chip} onChip={setChip} text={text} onText={setText} />
            <button className="btn btn-gold btn-xl" type="submit" disabled={!ok}>
              {busy ? <><span className="spin-s" />Mengirim…</> : status === "hadir" && ev?.counts_jam_plus && ses ? `Kirim absen · +${fmtJam(hrsOf(ses))} jam` : "Kirim absen"}
            </button>
          </div>
          <SuccessOverlay data={done} />
        </form>

        <Link href="/daftar" className="student-cta">
          <span className="ic"><Icon name="user" /></span>
          <span><b>Belum terdaftar?</b><span>Daftar mandiri dalam 1 menit, tanpa menunggu admin</span></span>
          <Icon name="arrow" />
        </Link>
        <p className="pub-foot">Panitia atau admin? <Link href="/login">Masuk ke dashboard</Link></p>
        <p className="pub-foot copy">© 2026 UKM TARI ASTRAtech · Politeknik Astra</p>
      </div>
    </main>
  );
}
