"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser, fetchAll, errMsg } from "@/lib/supabase/client";
import { hrsOf, sortByDate } from "@/lib/utils";

const Ctx = createContext(null);

const ATT_COLS = "id,session_id,nim,status,reason,source,created_at,updated_at";

export function DataProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [att, setAtt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  const loadEvents = useCallback(async () => {
    const sb = supabaseBrowser();
    const rows = await fetchAll(() => sb.from("events").select("*, sessions(*), event_participants(nim)").order("created_at", { ascending: true }));
    setEvents(rows.map(({ event_participants: ep, ...e }) => ({ ...e, sessions: [...(e.sessions || [])].sort(sortByDate), peserta: (ep || []).map((p) => p.nim) })));
  }, []);
  const loadStudents = useCallback(async () => {
    const sb = supabaseBrowser();
    setStudents(await fetchAll(() => sb.from("students").select("*").order("nim")));
  }, []);
  const loadAtt = useCallback(async () => {
    const sb = supabaseBrowser();
    setAtt(await fetchAll(() => sb.from("attendances").select(ATT_COLS).order("created_at")));
  }, []);

  const reload = useCallback(async () => {
    setError("");
    try {
      await Promise.all([loadEvents(), loadStudents(), loadAtt()]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [loadEvents, loadStudents, loadAtt]);

  useEffect(() => {
    reload();
    const sb = supabaseBrowser();
    const ch = sb
      .channel("attendances-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendances" }, (p) => {
        if (p.eventType === "DELETE") {
          setAtt((l) => l.filter((a) => a.id !== p.old?.id));
        } else if (p.new?.id) {
          setAtt((l) => {
            const i = l.findIndex((a) => a.id === p.new.id);
            if (i === -1) return [...l, p.new];
            const c = l.slice(); c[i] = { ...c[i], ...p.new }; return c;
          });
        }
      })
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    const onFocus = () => document.visibilityState === "visible" && loadAtt().catch(() => {});
    document.addEventListener("visibilitychange", onFocus);
    return () => { sb.removeChannel(ch); document.removeEventListener("visibilitychange", onFocus); };
  }, [reload, loadAtt]);

  const value = useMemo(() => {
    const evMap = new Map(events.map((e) => [e.id, e]));
    const sesMap = new Map();
    events.forEach((e) => e.sessions.forEach((s) => sesMap.set(s.id, { ...s, event: e })));
    const stuMap = new Map(students.map((s) => [s.nim, s]));
    const jamOf = (a) => {
      const s = sesMap.get(a.session_id);
      return s && s.event.counts_jam_plus && a.status === "hadir" ? hrsOf(s) : 0;
    };
    const upsertAttLocal = (row) => setAtt((l) => { const i = l.findIndex((a) => a.id === row.id || (a.session_id === row.session_id && a.nim === row.nim)); if (i === -1) return [...l, row]; const c = l.slice(); c[i] = row; return c; });
    const removeAttLocal = (id) => setAtt((l) => l.filter((a) => a.id !== id));
    return { events, students, att, loading, error, live, evMap, sesMap, stuMap, jamOf, reload, loadEvents, loadStudents, loadAtt, upsertAttLocal, removeAttLocal };
  }, [events, students, att, loading, error, live, reload, loadEvents, loadStudents, loadAtt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
export const DataContext = Ctx;
