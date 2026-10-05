-- =====================================================================
--  STAMPTech Plus · Data contoh (opsional)
--  Jalankan setelah schema.sql bila ingin mencoba dengan data demo.
--  Tanggal sesi dibuat relatif terhadap hari ini (WIB).
-- =====================================================================

insert into public.students (nim, nama, prodi, semester) values
  ('0320230012','Raka Pratama Wijaya','TRPL',7),
  ('0320230027','Nadia Putri Salsabila','TRPL',7),
  ('0320240041','Aditya Fajar Nugroho','MI',5),
  ('0320240058','Keisha Amalia Rahman','MI',5),
  ('0320250063','Bima Arya Saputra','MK',3),
  ('0320250079','Zahra Aulia Ramadhani','TPM',3),
  ('0320250084','Dimas Haikal Firmansyah','TRPAB',3),
  ('0320260091','Alya Nur Fitriani','TRPL',1),
  ('0320260105','Farrel Kenzie Hidayat','TKBG',1),
  ('0320240116','Salsa Dwi Anggraini','TRL',5),
  ('0320230128','Gilang Maulana Akbar','MO',7),
  ('0320260134','Cantika Maharani','P4',1)
on conflict (nim) do nothing;

with ev as (
  insert into public.events (name, category, location, statuses, reason_required, counts_jam_plus)
  values ('Latihan Acara Wisuda','Latihan','Auditorium','{hadir,tidak}','{tidak}',true)
  returning id
), jadwal(i, mulai, selesai, lokasi) as (
  -- tanggal tidak harus berurutan; jam & lokasi boleh beda tiap tanggal (lokasi null = pakai lokasi default acara)
  values (0,'15:00','18:00',null),(1,'13:00','17:30','Komunal Kolaborasi'),(2,'15:00','18:00',null),(4,'08:00','12:00','Lapangan Basket'),
         (5,'16:00','19:00',null),(8,'15:30','18:00','Komunal Kolaborasi'),(9,'13:00','17:00',null),(11,'15:00','18:00',null),
         (14,'08:00','16:00','Gedung Serbaguna'),(19,'07:00','12:00','Gedung Serbaguna')
)
insert into public.sessions (event_id, tanggal, jam_mulai, jam_selesai, lokasi)
select ev.id, public.today_jakarta() - 2 + jadwal.i, jadwal.mulai::time, jadwal.selesai::time, jadwal.lokasi
from ev, jadwal;

with ev as (
  insert into public.events (name, category, location, statuses, reason_required, counts_jam_plus)
  values ('Kerja Bakti Lingkungan Kampus','Kerja Bakti','Area Parkir & Taman','{hadir,tidak}','{tidak}',true)
  returning id
)
insert into public.sessions (event_id, tanggal, jam_mulai, jam_selesai)
select ev.id, public.today_jakarta() - 8 + d.i, '07:00'::time, d.selesai::time
from ev, (values (0,'11:00'),(1,'10:30')) d(i, selesai);

-- latihan wisuda hanya untuk 8 penari terpilih (peserta acara)
update public.events set peserta_only = true where name = 'Latihan Acara Wisuda';
insert into public.event_participants (event_id, nim)
select e.id, st.nim from public.events e cross join public.students st
where e.name = 'Latihan Acara Wisuda'
  and st.nim in ('0320230012','0320230027','0320240041','0320240058','0320250063','0320250079','0320260091','0320260134')
on conflict do nothing;

-- contoh absen 2 hari pertama latihan wisuda
insert into public.attendances (session_id, nim, status, reason)
select s.id, st.nim,
       case when st.nim = '0320250063' and s.tanggal = public.today_jakarta() - 2 then 'tidak' else 'hadir' end,
       case when st.nim = '0320250063' and s.tanggal = public.today_jakarta() - 2 then 'Sakit' else null end
from public.sessions s
join public.events e on e.id = s.event_id and e.name = 'Latihan Acara Wisuda'
join public.event_participants st on st.event_id = e.id
where s.tanggal between public.today_jakarta() - 2 and public.today_jakarta() - 1
on conflict (session_id, nim) do nothing;
