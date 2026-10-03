/*
 * Az-Zikra — lapisan data.
 *
 * Versi ini menyimpan seluruh data di localStorage browser agar website bisa
 * berjalan tanpa server (cocok untuk demo / GitHub Pages). Semua akses data
 * lewat objek `Store`, jadi untuk produksi cukup ganti implementasi di file
 * ini dengan pemanggilan API / Firebase / Supabase tanpa mengubah halaman.
 */

const CONFIG = {
  name: 'Az-Zikra',
  tagline: 'Bimbingan Belajar & Mengaji',
  phone: '081200000000', // ganti dengan nomor WhatsApp admin
  email: 'info@az-zikra.id',
  address: 'Sentul, Kabupaten Bogor, Jawa Barat',
  mapCenter: [-6.5629, 106.8655],
  // Rapor dibuat per 2 minggu, dihitung dari tanggal (Senin) ini
  raporAnchor: '2026-01-05',
  // Lokasi guru dianggap "live" bila diperbarui dalam rentang ini
  liveWindowMs: 5 * 60 * 1000,
};

const PROGRAMS = ['Iqro', 'Tahsin', 'Tahfidz', 'Bahasa Arab', 'Matematika'];

const RAPOR_ASPECTS = [
  { key: 'kelancaran', label: 'Kelancaran Membaca' },
  { key: 'tajwid', label: 'Tajwid / Ketepatan' },
  { key: 'hafalan', label: 'Hafalan' },
  { key: 'pemahaman', label: 'Pemahaman Materi' },
  { key: 'adab', label: 'Adab & Akhlak' },
  { key: 'keaktifan', label: 'Keaktifan' },
];

const ATTENDANCE_STATUS = {
  H: { label: 'Hadir', cls: 'ok' },
  I: { label: 'Izin', cls: 'info' },
  S: { label: 'Sakit', cls: 'warn' },
  A: { label: 'Alpa', cls: 'bad' },
};

const DB_KEY = 'azzikra_db_v1';
const SESSION_KEY = 'azzikra_session';

const Store = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(DB_KEY);
      this._cache = raw ? JSON.parse(raw) : null;
    } catch {
      this._cache = null;
    }
    if (!this._cache) {
      this._cache = buildSeed();
      this.save();
    }
    return this._cache;
  },

  /** Muat ulang dari localStorage (dipakai saat tab lain mengubah data) */
  refresh() {
    this._cache = null;
    return this.load();
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this._cache));
      return true;
    } catch (err) {
      console.error(err);
      toast('Penyimpanan browser penuh. Hapus beberapa laporan berfoto atau ekspor data.', 'error');
      return false;
    }
  },

  all(col) {
    return this.load()[col] || [];
  },

  find(col, id) {
    return this.all(col).find((x) => x.id === id) || null;
  },

  where(col, pred) {
    return this.all(col).filter(pred);
  },

  insert(col, obj) {
    const db = this.load();
    const row = { id: uid(col.slice(0, 3)), createdAt: Date.now(), ...obj };
    (db[col] = db[col] || []).push(row);
    if (!this.save()) {
      db[col].pop();
      return null;
    }
    return row;
  },

  update(col, id, patch) {
    const row = this.find(col, id);
    if (!row) return null;
    const backup = { ...row };
    Object.assign(row, patch, { updatedAt: Date.now() });
    if (!this.save()) {
      Object.keys(row).forEach((k) => delete row[k]);
      Object.assign(row, backup);
      return null;
    }
    return row;
  },

  remove(col, id) {
    const db = this.load();
    db[col] = (db[col] || []).filter((x) => x.id !== id);
    this.save();
  },

  /** Insert atau update berdasarkan kecocokan kunci */
  upsert(col, match, data) {
    const existing = this.all(col).find((x) => Object.keys(match).every((k) => x[k] === match[k]));
    return existing ? this.update(col, existing.id, data) : this.insert(col, { ...match, ...data });
  },

  reset() {
    this._cache = buildSeed();
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.teachers) || !Array.isArray(data.students)) {
      throw new Error('Format file tidak dikenali');
    }
    this._cache = data;
    this.save();
  },
};

const Auth = {
  login(username, password) {
    const user = Store.all('teachers').find(
      (t) => t.username.toLowerCase() === username.trim().toLowerCase() && t.password === password
    );
    if (!user) return null;
    sessionStorage.setItem(SESSION_KEY, user.id);
    return user;
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  current() {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id ? Store.find('teachers', id) : null;
  },
};

/* ---------- Periode rapor 2 mingguan ---------- */

const Periods = {
  indexOf(iso) {
    const diff = parseISO(iso) - parseISO(CONFIG.raporAnchor);
    return Math.floor(Math.round(diff / 86400000) / 14);
  },
  range(index) {
    const start = addDays(parseISO(CONFIG.raporAnchor), index * 14);
    return { index, start: toISO(start), end: toISO(addDays(start, 13)) };
  },
  current() {
    return this.range(this.indexOf(todayISO()));
  },
  /** Daftar periode terbaru (termasuk yang berjalan) */
  recent(count = 8) {
    const cur = this.indexOf(todayISO());
    return Array.from({ length: count }, (_, i) => this.range(cur - i));
  },
  label(p) {
    return `Periode ${p.index + 1}: ${fmtDate(p.start, { day: 'numeric', month: 'short' })} – ${fmtDate(p.end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  },
};

/* ---------- Data contoh ---------- */

function buildSeed() {
  // PRNG deterministik agar data contoh konsisten
  let s = 42;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  const now = Date.now();
  const teachers = [
    {
      id: 'admin', role: 'admin', name: 'Koordinator Az-Zikra', username: 'admin', password: 'admin123',
      subjects: [], phone: CONFIG.phone, area: 'Kantor Pusat', bio: '',
    },
    {
      id: 't1', role: 'guru', name: 'Ustadz Ahmad Fauzi', username: 'ahmad', password: 'guru123',
      subjects: ['Tahsin', 'Tahfidz'], phone: '081211110001', area: 'Sentul City',
      bio: 'Hafidz 30 juz, sanad qiraah Imam Ashim riwayat Hafs.',
      lat: -6.5600, lng: 106.8622, sharing: true, locationUpdatedAt: now - 60 * 1000,
    },
    {
      id: 't2', role: 'guru', name: 'Ustadzah Siti Aminah', username: 'siti', password: 'guru123',
      subjects: ['Iqro', 'Tahsin'], phone: '081211110002', area: 'Cibinong',
      bio: 'Spesialis mengaji anak usia dini dengan metode Iqro.',
      lat: -6.4817, lng: 106.8540, sharing: true, locationUpdatedAt: now - 3 * 60 * 1000,
    },
    {
      id: 't3', role: 'guru', name: 'Ustadz Rizki Maulana', username: 'rizki', password: 'guru123',
      subjects: ['Bahasa Arab'], phone: '081211110003', area: 'Bogor Tengah',
      bio: 'Lulusan LIPIA, mengajar nahwu-sharaf dan muhadatsah.',
      lat: -6.5971, lng: 106.8060, sharing: true, locationUpdatedAt: now - 40 * 60 * 1000,
    },
    {
      id: 't4', role: 'guru', name: 'Ustadzah Nur Hasanah', username: 'nur', password: 'guru123',
      subjects: ['Matematika', 'Iqro'], phone: '081211110004', area: 'Citeureup',
      bio: 'Pendamping belajar Matematika SD–SMP.',
      lat: -6.5170, lng: 106.8830, sharing: true, locationUpdatedAt: now - 2 * 60 * 1000,
    },
    {
      id: 't5', role: 'guru', name: 'Ustadz Hasan Basri', username: 'hasan', password: 'guru123',
      subjects: ['Tahfidz', 'Tahsin'], phone: '081211110005', area: 'Babakan Madang',
      bio: 'Pembina program tahfidz juz 30 & juz 29.',
      lat: -6.5805, lng: 106.9010, sharing: false, locationUpdatedAt: now - 5 * 3600 * 1000,
    },
  ];

  const students = [
    { id: 's1', name: 'Muhammad Alif', level: 'SD Kelas 3', program: 'Tahsin', teacherId: 't1', parent: 'Bpk. Yusuf', parentPhone: '081300000001' },
    { id: 's2', name: 'Aisyah Putri', level: 'SD Kelas 5', program: 'Tahfidz', teacherId: 't1', parent: 'Ibu Rahma', parentPhone: '081300000002' },
    { id: 's3', name: 'Zaid Abdullah', level: 'TK B', program: 'Iqro', teacherId: 't2', parent: 'Ibu Laila', parentPhone: '081300000003' },
    { id: 's4', name: 'Fatimah Azzahra', level: 'SD Kelas 1', program: 'Iqro', teacherId: 't2', parent: 'Bpk. Hamid', parentPhone: '081300000004' },
    { id: 's5', name: 'Umar Faruq', level: 'SMP Kelas 7', program: 'Bahasa Arab', teacherId: 't3', parent: 'Bpk. Salman', parentPhone: '081300000005' },
    { id: 's6', name: 'Khadijah Nur', level: 'SD Kelas 6', program: 'Matematika', teacherId: 't4', parent: 'Ibu Maryam', parentPhone: '081300000006' },
    { id: 's7', name: 'Hamzah Rafi', level: 'SD Kelas 4', program: 'Tahfidz', teacherId: 't5', parent: 'Bpk. Ilham', parentPhone: '081300000007' },
    { id: 's8', name: 'Salma Hanifah', level: 'SD Kelas 2', program: 'Tahsin', teacherId: 't1', parent: 'Ibu Dewi', parentPhone: '081300000008' },
  ];

  const chapterTitles = {
    Iqro: ['Iqro 1 — Huruf Hijaiyah', 'Iqro 2 — Huruf Bersambung', 'Iqro 3 — Harakat Kasrah & Dhammah', 'Iqro 4 — Tanwin & Sukun', 'Iqro 5 — Tasydid & Mad', 'Iqro 6 — Waqaf & Persiapan Al-Qur\'an'],
    Tahsin: ['Makharijul Huruf', 'Sifatul Huruf', 'Hukum Nun Sukun & Tanwin', 'Hukum Mim Sukun', 'Mad Thabi\'i & Far\'i', 'Qalqalah', 'Waqaf & Ibtida\''],
    Tahfidz: ['An-Naba\' – An-Nazi\'at', '\'Abasa – Al-Infithar', 'Al-Muthaffifin – Al-Buruj', 'Ath-Thariq – Al-Ghasyiyah', 'Al-Fajr – Asy-Syams', 'Al-Lail – An-Nas'],
    'Bahasa Arab': ['Mufradat Dasar', 'Isim, Fi\'il, Huruf', 'Jumlah Ismiyah', 'Jumlah Fi\'liyah', 'Muhadatsah Harian'],
    Matematika: ['Bilangan Bulat', 'Pecahan & Desimal', 'Perbandingan', 'Bangun Datar', 'Bangun Ruang', 'Statistika Dasar'],
  };
  const chapters = [];
  Object.entries(chapterTitles).forEach(([program, titles]) => {
    titles.forEach((title, i) => {
      chapters.push({ id: `c_${program.replace(/\W/g, '')}_${i + 1}`, program, order: i + 1, title, description: '' });
    });
  });

  // Jadwal: tiap siswa 2 sesi per minggu
  const slots = [
    ['s1', 't1', 1, '15:30', '16:30'], ['s1', 't1', 4, '15:30', '16:30'],
    ['s2', 't1', 2, '16:00', '17:00'], ['s2', 't1', 5, '16:00', '17:00'],
    ['s8', 't1', 3, '15:30', '16:30'], ['s8', 't1', 6, '09:00', '10:00'],
    ['s3', 't2', 1, '14:00', '15:00'], ['s3', 't2', 3, '14:00', '15:00'],
    ['s4', 't2', 2, '14:00', '15:00'], ['s4', 't2', 4, '14:00', '15:00'],
    ['s5', 't3', 2, '19:00', '20:00'], ['s5', 't3', 6, '10:00', '11:00'],
    ['s6', 't4', 1, '16:00', '17:30'], ['s6', 't4', 3, '16:00', '17:30'],
    ['s7', 't5', 4, '16:30', '17:30'], ['s7', 't5', 0, '08:00', '09:00'],
  ];
  const schedules = slots.map(([studentId, teacherId, day, start, end], i) => ({
    id: `sch${i + 1}`, studentId, teacherId, day, start, end,
    location: i % 3 === 0 ? 'Online (Zoom)' : 'Rumah siswa',
  }));

  // Absensi siswa 3 minggu terakhir sesuai jadwal
  const attendance = [];
  const teacherAttendance = [];
  const today = parseISO(todayISO());
  for (let back = 21; back >= 1; back--) {
    const date = addDays(today, -back);
    const iso = toISO(date);
    const activeTeachers = new Set();
    schedules.filter((sc) => sc.day === date.getDay()).forEach((sc) => {
      const r = rand();
      const status = r < 0.82 ? 'H' : r < 0.9 ? 'I' : r < 0.96 ? 'S' : 'A';
      attendance.push({ id: `att_${iso}_${sc.studentId}`, date: iso, studentId: sc.studentId, teacherId: sc.teacherId, status, note: '' });
      activeTeachers.add(sc.teacherId);
    });
    activeTeachers.forEach((tid) => {
      const t = teachers.find((x) => x.id === tid);
      const checkIn = new Date(date); checkIn.setHours(13 + Math.floor(rand() * 3), Math.floor(rand() * 60));
      const checkOut = new Date(checkIn.getTime() + (2 + rand() * 2) * 3600 * 1000);
      teacherAttendance.push({ id: `ta_${iso}_${tid}`, date: iso, teacherId: tid, checkIn: checkIn.getTime(), checkOut: checkOut.getTime(), lat: t.lat, lng: t.lng });
    });
  }

  // Progres bab
  const progress = [];
  students.forEach((st) => {
    const list = chapters.filter((c) => c.program === st.program);
    const done = 1 + Math.floor(rand() * Math.min(3, list.length - 1));
    list.forEach((c, i) => {
      if (i < done) progress.push({ id: `pg_${st.id}_${c.id}`, studentId: st.id, chapterId: c.id, status: 'selesai', date: toISO(addDays(today, -(done - i) * 6)) });
      else if (i === done) progress.push({ id: `pg_${st.id}_${c.id}`, studentId: st.id, chapterId: c.id, status: 'proses', date: toISO(addDays(today, -2)) });
    });
  });

  const photo = (emoji, label, c1, c2) =>
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><text x="320" y="230" font-size="140" text-anchor="middle">${emoji}</text><text x="320" y="330" font-size="30" font-family="sans-serif" fill="#fff" text-anchor="middle">${label}</text></svg>`
    );

  const reports = [
    {
      id: 'rep1', teacherId: 't1', studentId: 's1', date: toISO(addDays(today, -3)), chapterId: 'c_Tahsin_3',
      summary: 'Latihan hukum idzhar dan ikhfa pada QS. Al-Baqarah 1–10. Alif sudah bisa membedakan dengung ikhfa dengan baik.',
      parentNote: 'Mohon dibantu muraja\'ah 10 menit setiap selesai Maghrib.',
      photos: [photo('📖', 'Contoh foto: sesi tahsin', '#0f766e', '#134e4a'), photo('✍️', 'Contoh foto: latihan tajwid', '#c9971c', '#8a6510')], createdAt: now - 3 * 86400000,
    },
    {
      id: 'rep2', teacherId: 't2', studentId: 's3', date: toISO(addDays(today, -2)), chapterId: 'c_Iqro_2',
      summary: 'Zaid menyelesaikan halaman 12–15 Iqro 2. Masih tertukar antara huruf ba-ta-tsa.',
      parentNote: 'Ulangi kartu huruf di rumah ya, Bu.',
      photos: [photo('🧒', 'Contoh foto: belajar Iqro', '#2563eb', '#1e3a8a')], createdAt: now - 2 * 86400000,
    },
  ];

  return { version: 1, teachers, students, chapters, schedules, attendance, teacherAttendance, progress, reports, rapor: [] };
}
