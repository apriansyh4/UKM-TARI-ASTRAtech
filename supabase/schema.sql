-- =====================================================================
--  STAMPTech Plus · Skema Supabase
--  Jalankan seluruh file ini sekali di Supabase → SQL Editor → Run.
--  Aman dijalankan ulang (idempotent) untuk tabel/fungsi/policy.
-- =====================================================================

-- gen_random_uuid() sudah bawaan PostgreSQL 13+ (Supabase)

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table if not exists public.students (
  nim        text primary key check (nim ~ '^[0-9]{4,15}$'),
  nama       text not null check (length(btrim(nama)) >= 3),
  prodi      text not null,
  semester   int  not null check (semester between 1 and 14),
  created_at timestamptz not null default now()
);

-- asal data mahasiswa: diinput admin atau daftar mandiri lewat form publik
alter table public.students add column if not exists registered_via text not null default 'admin';
alter table public.students drop constraint if exists students_registered_via_check;
alter table public.students add constraint students_registered_via_check check (registered_via in ('admin','mandiri'));

create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text not null default 'Latihan',
  location        text,
  statuses        text[] not null default '{hadir,tidak}',
  reason_required text[] not null default '{tidak}',
  counts_jam_plus boolean not null default true,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- satu baris per hari; jam boleh berbeda tiap hari
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  tanggal     date not null,
  jam_mulai   time not null,
  jam_selesai time not null,
  durasi_jam  numeric(5,2) generated always as
              (round((extract(epoch from (jam_selesai - jam_mulai)) / 3600)::numeric, 2)) stored,
  constraint sessions_jam_valid check (jam_selesai > jam_mulai),
  constraint sessions_event_tanggal_key unique (event_id, tanggal)
);
-- pengaman untuk database versi lama: kolom yang mungkin belum ada
alter table public.sessions add column if not exists durasi_jam numeric(5,2) generated always as
  (round((extract(epoch from (jam_selesai - jam_mulai)) / 3600)::numeric, 2)) stored;
alter table public.events add column if not exists counts_jam_plus boolean not null default true;
alter table public.events add column if not exists is_active boolean not null default true;
-- lokasi khusus per tanggal (kosong = pakai lokasi default acara)
alter table public.sessions add column if not exists lokasi text;
create index if not exists sessions_event_idx on public.sessions(event_id);
create index if not exists sessions_tanggal_idx on public.sessions(tanggal);

create table if not exists public.attendances (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  nim        text not null references public.students(nim) on update cascade on delete cascade,
  status     text not null,
  reason     text check (reason is null or length(reason) <= 280),
  source     text not null default 'admin' check (source in ('admin','form')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendances_session_nim_key unique (session_id, nim)
);
alter table public.attendances add column if not exists reason text;
alter table public.attendances add column if not exists source text not null default 'admin';
alter table public.attendances add column if not exists updated_at timestamptz not null default now();
-- status hanya Hadir / Tidak Hadir
update public.attendances set status = 'tidak' where status not in ('hadir','tidak');
alter table public.attendances drop constraint if exists attendances_status_check;
alter table public.attendances add constraint attendances_status_check check (status in ('hadir','tidak'));
alter table public.events alter column statuses set default '{hadir,tidak}';
alter table public.events alter column reason_required set default '{tidak}';
update public.events set statuses = '{hadir,tidak}', reason_required = array_remove(reason_required, 'abstain')
where statuses <> '{hadir,tidak}' or 'abstain' = any(reason_required);

-- prodi = 9 program studi Politeknik Astra (kode)
create or replace function public.prodi_valid(p text)
returns boolean language sql immutable as $$
  select p in ('P4','TPM','MI','MO','MK','TKBG','TRPAB','TRL','TRPL');
$$;
-- kode lama TPPM diganti TPM
update public.students set prodi = 'TPM' where prodi = 'TPPM';
alter table public.students drop constraint if exists students_prodi_check;
alter table public.students add constraint students_prodi_check check (public.prodi_valid(prodi)) not valid;

create index if not exists attendances_nim_idx on public.attendances(nim);
create index if not exists attendances_session_idx on public.attendances(session_id);

-- admin = user Supabase Auth yang terdaftar di tabel ini
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nama       text,
  created_at timestamptz not null default now()
);

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists attendances_touch on public.attendances;
create trigger attendances_touch before update on public.attendances
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.today_jakarta()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- ---------------------------------------------------------------------
-- Peserta per acara. Kalau events.peserta_only = true, hanya NIM di tabel ini
-- yang bisa diabsen untuk acara tersebut. Kalau false, semua mahasiswa boleh.
-- ---------------------------------------------------------------------
alter table public.events add column if not exists peserta_only boolean not null default false;

create table if not exists public.event_participants (
  event_id   uuid not null references public.events(id) on delete cascade,
  nim        text not null references public.students(nim) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, nim)
);
create index if not exists event_participants_nim_idx on public.event_participants(nim);

-- true kalau mahasiswa boleh diabsen di acara ini
create or replace function public.is_peserta(p_event uuid, p_nim text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not e.peserta_only from public.events e where e.id = p_event), false)
      or exists (select 1 from public.event_participants p where p.event_id = p_event and p.nim = p_nim);
$$;

-- Jaga data: absen hanya boleh untuk peserta (kalau acara dibatasi peserta)
create or replace function public.attendance_peserta_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  if tg_op = 'UPDATE' and new.nim = old.nim and new.session_id = old.session_id then return new; end if;
  select event_id into v_event from public.sessions where id = new.session_id;
  if v_event is not null and not public.is_peserta(v_event, new.nim) then
    raise exception 'NIM % bukan peserta acara ini', new.nim;
  end if;
  return new;
end $$;
drop trigger if exists attendances_peserta_guard on public.attendances;
create trigger attendances_peserta_guard before insert or update on public.attendances
  for each row execute function public.attendance_peserta_guard();

-- ---------------------------------------------------------------------
-- View laporan (mengikuti RLS pemanggil)
-- ---------------------------------------------------------------------
create or replace view public.v_laporan_harian with (security_invoker = true) as
select e.id as event_id, e.name as event, s.id as session_id, s.tanggal, s.jam_mulai, s.jam_selesai, s.durasi_jam,
       a.nim, st.nama, st.prodi, st.semester, a.status, a.reason, a.source, a.updated_at,
       case when a.status = 'hadir' and e.counts_jam_plus then s.durasi_jam else 0 end as jam_plus,
       coalesce(nullif(trim(s.lokasi), ''), e.location) as lokasi
from public.attendances a
join public.sessions s  on s.id = a.session_id
join public.events e    on e.id = s.event_id
join public.students st on st.nim = a.nim;

-- ---------------------------------------------------------------------
-- RLS: tabel hanya bisa diakses admin. Publik lewat fungsi RPC di bawah.
-- ---------------------------------------------------------------------
alter table public.students    enable row level security;
alter table public.events      enable row level security;
alter table public.sessions    enable row level security;
alter table public.attendances enable row level security;
alter table public.admins      enable row level security;
alter table public.event_participants enable row level security;

drop policy if exists "admin kelola students"    on public.students;
drop policy if exists "admin kelola events"      on public.events;
drop policy if exists "admin kelola sessions"    on public.sessions;
drop policy if exists "admin kelola attendances" on public.attendances;
drop policy if exists "admin lihat diri"         on public.admins;
drop policy if exists "admin kelola peserta"     on public.event_participants;

create policy "admin kelola students"    on public.students    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin kelola events"      on public.events      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin kelola sessions"    on public.sessions    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin kelola attendances" on public.attendances for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin lihat diri"         on public.admins      for select to authenticated using (user_id = auth.uid());
create policy "admin kelola peserta"     on public.event_participants for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- RPC untuk form mahasiswa tanpa login
-- ---------------------------------------------------------------------

-- Acara aktif + sesi hari ini (atau sesi berikutnya)
drop function if exists public.public_open_events();
create function public.public_open_events()
returns table (
  event_id uuid, name text, category text, location text,
  statuses text[], reason_required text[], counts_jam_plus boolean,
  session_id uuid, tanggal date, jam_mulai time, jam_selesai time, durasi_jam numeric, is_today boolean,
  peserta_only boolean
)
language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.category, coalesce(nullif(trim(s.lokasi), ''), e.location), e.statuses, e.reason_required, e.counts_jam_plus,
         s.id, s.tanggal, s.jam_mulai, s.jam_selesai, s.durasi_jam,
         coalesce(s.tanggal = public.today_jakarta(), false),
         e.peserta_only
  from public.events e
  left join lateral (
    select x.* from public.sessions x
    where x.event_id = e.id and x.tanggal >= public.today_jakarta()
    order by x.tanggal asc limit 1
  ) s on true
  where e.is_active
  order by coalesce(s.tanggal = public.today_jakarta(), false) desc, s.tanggal asc nulls last, e.name;
$$;

-- Cari mahasiswa berdasarkan NIM (satu baris, bukan daftar)
drop function if exists public.lookup_student(text, uuid);
create function public.lookup_student(p_nim text, p_session uuid default null)
returns table (nim text, nama text, prodi text, semester int, total_jam numeric, existing_status text, existing_at timestamptz, is_peserta boolean)
language sql stable security definer set search_path = public as $$
  select st.nim, st.nama, st.prodi, st.semester,
         coalesce((
           select sum(case when a.status = 'hadir' and e.counts_jam_plus then s.durasi_jam else 0 end)
           from public.attendances a
           join public.sessions s on s.id = a.session_id
           join public.events e on e.id = s.event_id
           where a.nim = st.nim
         ), 0),
         (select a.status from public.attendances a where a.nim = st.nim and a.session_id = p_session),
         (select a.updated_at from public.attendances a where a.nim = st.nim and a.session_id = p_session),
         case when p_session is null then true
              else public.is_peserta((select x.event_id from public.sessions x where x.id = p_session), st.nim) end
  from public.students st
  where st.nim = btrim(p_nim);
$$;

-- Kirim absen dari form publik (hanya sesi hari ini, acara aktif)
create or replace function public.submit_attendance(p_session uuid, p_nim text, p_status text, p_reason text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_s public.sessions%rowtype;
  v_e public.events%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_nim text := btrim(coalesce(p_nim, ''));
  v_existed boolean;
begin
  select * into v_s from public.sessions where id = p_session;
  if not found then raise exception 'Sesi tidak ditemukan'; end if;

  select * into v_e from public.events where id = v_s.event_id;
  if not v_e.is_active then raise exception 'Acara ini sedang ditutup'; end if;
  if v_s.tanggal <> public.today_jakarta() then raise exception 'Absen hanya bisa untuk sesi hari ini'; end if;
  if not exists (select 1 from public.students where nim = v_nim) then raise exception 'NIM belum terdaftar'; end if;
  if not public.is_peserta(v_e.id, v_nim) then raise exception 'Kamu tidak terdaftar sebagai peserta acara ini. Hubungi panitia.'; end if;
  if not (p_status = any (v_e.statuses)) then raise exception 'Status tidak tersedia untuk acara ini'; end if;
  if p_status = any (v_e.reason_required) and v_reason is null then raise exception 'Keterangan wajib diisi'; end if;
  if length(coalesce(v_reason, '')) > 280 then raise exception 'Keterangan maksimal 280 karakter'; end if;

  select exists (select 1 from public.attendances where session_id = p_session and nim = v_nim) into v_existed;

  insert into public.attendances (session_id, nim, status, reason, source)
  values (p_session, v_nim, p_status, v_reason, 'form')
  on conflict (session_id, nim)
  do update set status = excluded.status, reason = excluded.reason, source = 'form';

  return json_build_object(
    'updated', v_existed,
    'jam', case when p_status = 'hadir' and v_e.counts_jam_plus then v_s.durasi_jam else 0 end
  );
end $$;

-- Daftar kode prodi resmi (9 prodi Politeknik Astra)
create or replace function public.public_prodi_list()
returns setof text
language sql stable security definer set search_path = public as $$
  select unnest(array['P4','TPM','MI','MO','MK','TKBG','TRPAB','TRL','TRPL']);
$$;

-- Mahasiswa daftar sendiri (tanpa login). NIM yang sudah ada tidak bisa ditimpa.
create or replace function public.register_student(p_nim text, p_nama text, p_prodi text, p_semester int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_nim   text := btrim(coalesce(p_nim, ''));
  v_nama  text := regexp_replace(btrim(coalesce(p_nama, '')), '\s+', ' ', 'g');
  v_prodi text := upper(btrim(coalesce(p_prodi, '')));
begin
  if v_nim !~ '^[0-9]{4,15}$' then raise exception 'NIM harus 4–15 digit angka'; end if;
  if length(v_nama) < 3 or length(v_nama) > 80 then raise exception 'Nama lengkap harus 3–80 karakter'; end if;
  if v_nama !~ '^[[:alpha:] .,''-]+$' then raise exception 'Nama hanya boleh berisi huruf, spasi, titik, koma, atau tanda hubung'; end if;
  if not public.prodi_valid(v_prodi) then raise exception 'Prodi tidak dikenal. Pilih salah satu dari 9 prodi Politeknik Astra'; end if;
  if p_semester is null or p_semester < 1 or p_semester > 14 then raise exception 'Semester harus 1–14'; end if;
  if exists (select 1 from public.students where nim = v_nim) then raise exception 'NIM sudah terdaftar. Kamu bisa langsung absen.'; end if;

  insert into public.students (nim, nama, prodi, semester, registered_via)
  values (v_nim, v_nama, v_prodi, p_semester, 'mandiri');

  return json_build_object('nim', v_nim, 'nama', v_nama, 'prodi', v_prodi, 'semester', p_semester);
end $$;

revoke all on function public.public_prodi_list() from public;
revoke all on function public.register_student(text, text, text, int) from public;
grant execute on function public.public_prodi_list() to anon, authenticated;
grant execute on function public.register_student(text, text, text, int) to anon, authenticated;

revoke all on function public.public_open_events() from public;
revoke all on function public.lookup_student(text, uuid) from public;
revoke all on function public.submit_attendance(uuid, text, text, text) from public;
grant execute on function public.public_open_events() to anon, authenticated;
grant execute on function public.lookup_student(text, uuid) to anon, authenticated;
grant execute on function public.submit_attendance(uuid, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_peserta(uuid, text) from public;
grant execute on function public.is_peserta(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: feed "Baru masuk" di halaman admin
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendances'
  ) then
    alter publication supabase_realtime add table public.attendances;
  end if;
end $$;
