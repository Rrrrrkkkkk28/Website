/* Az-Zikra — Portal Guru */
(() => {
  const me = Auth.current();
  if (!me) {
    location.replace('login.html');
    return;
  }
  const isAdmin = me.role === 'admin';

  /* ==========================================================
     Helper data
     ========================================================== */
  const gurus = () => Store.where('teachers', (t) => t.role === 'guru');
  const myStudents = () =>
    Store.all('students')
      .filter((s) => isAdmin || s.teacherId === me.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  const mySchedules = () => Store.where('schedules', (s) => isAdmin || s.teacherId === me.id);
  const studentById = (id) => Store.find('students', id);
  const teacherName = (id) => Store.find('teachers', id)?.name || '-';
  const studentName = (id) => studentById(id)?.name || '(siswa dihapus)';
  const chapterById = (id) => Store.find('chapters', id);
  const chaptersOf = (program) => Store.where('chapters', (c) => c.program === program).sort((a, b) => a.order - b.order);
  const byTime = (a, b) => a.start.localeCompare(b.start);
  const canEditReport = (r) => isAdmin || r.teacherId === me.id;

  function predikat(avg) {
    if (avg >= 90) return { grade: 'A', label: 'Mumtaz (Istimewa)', cls: 'ok' };
    if (avg >= 80) return { grade: 'B', label: 'Jayyid Jiddan (Sangat Baik)', cls: 'primary' };
    if (avg >= 70) return { grade: 'C', label: 'Jayyid (Baik)', cls: 'warn' };
    return { grade: 'D', label: 'Perlu Bimbingan', cls: 'bad' };
  }

  function raporAverage(r) {
    const vals = RAPOR_ASPECTS.map((a) => Number(r.scores?.[a.key])).filter((v) => !Number.isNaN(v));
    return vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : 0;
  }

  /** Rekap otomatis siswa pada suatu rentang tanggal */
  function periodSummary(studentId, start, end) {
    const inRange = (d) => d >= start && d <= end;
    const att = Store.where('attendance', (a) => a.studentId === studentId && inRange(a.date));
    const count = (st) => att.filter((a) => a.status === st).length;
    const hadir = count('H');
    return {
      sessions: att.length,
      H: hadir, I: count('I'), S: count('S'), A: count('A'),
      percent: att.length ? Math.round((hadir / att.length) * 100) : 0,
      chaptersDone: Store.where('progress', (p) => p.studentId === studentId && p.status === 'selesai' && p.date && inRange(p.date)),
      reports: Store.where('reports', (r) => r.studentId === studentId && inRange(r.date)).length,
    };
  }

  function studentOptions(list, selected, placeholder) {
    return (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
      list.map((s) => `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)} — ${esc(s.program)}</option>`).join('');
  }

  function teacherOptions(selected) {
    return gurus().map((t) => `<option value="${esc(t.id)}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  }

  const empty = (icon, text) => `<div class="empty"><div class="icon">${icon}</div>${text}</div>`;

  function pageHead(title, subtitle, actions = '') {
    return `<div class="page-head"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div>${actions}</div></div>`;
  }

  /* ==========================================================
     Modal
     ========================================================== */
  function openModal(html, { wide = false } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="card modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => e.key === 'Escape' && close();
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    return { el: backdrop.firstElementChild, close };
  }

  /* ==========================================================
     Live location (tetap aktif selama portal terbuka)
     ========================================================== */
  const Live = {
    watchId: null,
    heartbeat: null,
    last: null, // { lat, lng, accuracy, ts }
    lastSaved: 0,
    listeners: new Set(),

    start() {
      if (!('geolocation' in navigator)) {
        toast('Browser tidak mendukung lokasi', 'error');
        return false;
      }
      if (this.watchId != null) return true;
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.onPosition(pos),
        (err) => {
          toast(err.code === 1 ? 'Izin lokasi ditolak browser' : 'Gagal membaca lokasi GPS', 'error');
          this.stop(true);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
      );
      // Detak berkala agar status "online" tetap terjaga walau guru diam di tempat
      this.heartbeat = setInterval(() => this.persist(true), 60000);
      return true;
    },

    stop(markOff = true) {
      if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
      clearInterval(this.heartbeat);
      this.watchId = null;
      this.heartbeat = null;
      if (markOff) Store.update('teachers', me.id, { sharing: false });
      this.emit();
    },

    get active() {
      return this.watchId != null;
    },

    onPosition(pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const prev = this.last;
      this.last = { lat, lng, accuracy, ts: Date.now() };
      const moved = !prev || haversine(prev.lat, prev.lng, lat, lng) > 0.02;
      this.persist(moved);
      this.emit();
    },

    persist(force) {
      if (!this.last) return;
      // Batasi penulisan: maksimal tiap 10 detik kecuali berpindah tempat
      if (!force && Date.now() - this.lastSaved < 10000) return;
      this.lastSaved = Date.now();
      Store.update('teachers', me.id, { lat: this.last.lat, lng: this.last.lng, sharing: true, locationUpdatedAt: Date.now() });
    },

    emit() {
      this.listeners.forEach((fn) => fn());
    },
  };

  // Lanjutkan berbagi lokasi otomatis bila sebelumnya aktif & izin sudah diberikan
  if (!isAdmin && me.sharing && navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then((p) => {
      if (p.state === 'granted') Live.start();
    }).catch(() => {});
  }

  /* ==========================================================
     VIEW: Dashboard
     ========================================================== */
  const Dashboard = {
    render() {
      const students = myStudents();
      const today = todayISO();
      const dow = new Date().getDay();
      const todaySessions = mySchedules().filter((s) => s.day === dow).sort(byTime);
      const weekAgo = toISO(addDays(new Date(), -6));
      const reports = Store.where('reports', (r) => (isAdmin || r.teacherId === me.id)).sort((a, b) => b.createdAt - a.createdAt);
      const weekReports = reports.filter((r) => r.date >= weekAgo).length;
      const period = Periods.current();
      const pending = students.filter((s) => !Store.all('rapor').some((r) => r.studentId === s.id && r.periodIndex === period.index));
      const daysLeft = Math.round((parseISO(period.end) - parseISO(today)) / 86400000);
      const checkIn = !isAdmin && Store.all('teacherAttendance').find((a) => a.teacherId === me.id && a.date === today);

      return `
        ${pageHead(`Assalamu'alaikum, ${esc(me.name.split(' ').slice(0, 2).join(' '))} 👋`, fmtDateLong(today))}

        <div class="stats">
          <div class="card stat"><div class="icon">🧒</div><div><strong>${students.length}</strong><span>Siswa ${isAdmin ? 'terdaftar' : 'binaan'}</span></div></div>
          <div class="card stat"><div class="icon">🗓️</div><div><strong>${todaySessions.length}</strong><span>Sesi hari ini</span></div></div>
          <div class="card stat"><div class="icon">📸</div><div><strong>${weekReports}</strong><span>Laporan 7 hari terakhir</span></div></div>
          <div class="card stat"><div class="icon">📝</div><div><strong>${students.length - pending.length}/${students.length}</strong><span>Rapor periode ini</span></div></div>
        </div>

        ${!isAdmin && !checkIn ? `<div class="alert alert-info">⏰ Anda belum melakukan check-in hari ini. <a href="#absensi"><strong>Absen sekarang →</strong></a></div>` : ''}

        <div class="two-col">
          <div class="card">
            <div class="card-head"><h3>Jadwal hari ini</h3><a href="#jadwal-pengajar" class="small">Lihat semua</a></div>
            ${todaySessions.length ? `<div class="list">${todaySessions.map((s) => {
              const att = Store.all('attendance').find((a) => a.studentId === s.studentId && a.date === today);
              return `<div class="list-item">
                <div class="time">${esc(s.start)}–${esc(s.end)}</div>
                <div class="grow"><strong>${esc(studentName(s.studentId))}</strong><div class="small muted">${esc(studentById(s.studentId)?.program || '')} · ${esc(s.location)}${isAdmin ? ` · ${esc(teacherName(s.teacherId))}` : ''}</div></div>
                ${att ? `<span class="badge badge-${ATTENDANCE_STATUS[att.status].cls}">${ATTENDANCE_STATUS[att.status].label}</span>` : '<a href="#absensi" class="badge">Belum absen</a>'}
              </div>`;
            }).join('')}</div>` : empty('🌙', 'Tidak ada sesi terjadwal hari ini.')}
          </div>

          <div class="card">
            <div class="card-head"><h3>Rapor periode berjalan</h3><a href="#rapor" class="small">Buka rapor</a></div>
            <p class="small muted" style="margin-bottom:.75rem">${esc(Periods.label(period))} · ${daysLeft > 0 ? `${daysLeft} hari lagi` : 'berakhir hari ini'}</p>
            <div class="bar" style="margin-bottom:1rem"><div style="width:${students.length ? ((students.length - pending.length) / students.length) * 100 : 0}%"></div></div>
            ${pending.length ? `<div class="small"><strong>Belum dibuat (${pending.length}):</strong></div>
              <div class="list" style="margin-top:.5rem">${pending.slice(0, 5).map((s) => `
                <div class="list-item"><div class="grow">${esc(s.name)} <span class="muted small">· ${esc(s.program)}</span></div>
                <a class="btn btn-sm btn-outline" href="#rapor" data-rapor-student="${esc(s.id)}">Isi rapor</a></div>`).join('')}</div>`
              : empty('🎉', 'Semua rapor periode ini sudah lengkap.')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Laporan terbaru</h3><a href="#laporan" class="small">Semua laporan</a></div>
          ${reports.length ? reports.slice(0, 3).map(reportCard).join('') : empty('📸', 'Belum ada laporan.')}
        </div>

        ${isAdmin ? `
        <div class="card">
          <div class="card-head"><h3>Pengelolaan data</h3></div>
          <p class="small muted">Data tersimpan di browser ini. Ekspor secara berkala sebagai cadangan, atau impor untuk memindahkan data ke perangkat lain.</p>
          <div class="form-actions" style="justify-content:flex-start">
            <button class="btn btn-outline btn-sm" id="export-data">⬇️ Ekspor JSON</button>
            <label class="btn btn-outline btn-sm" style="margin:0">⬆️ Impor JSON<input type="file" id="import-data" accept="application/json" hidden></label>
            <button class="btn btn-danger btn-sm" id="reset-data">Reset data demo</button>
          </div>
        </div>` : ''}
      `;
    },
    bind(root) {
      root.addEventListener('click', (e) => {
        const r = e.target.closest('[data-rapor-student]');
        if (r) Rapor.state.studentId = r.dataset.raporStudent;
      });
      bindReportActions(root);
      if (!isAdmin) return;
      $('#export-data', root).addEventListener('click', () => {
        const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `az-zikra-data-${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      $('#import-data', root).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          Store.importJSON(await file.text());
          toast('Data berhasil diimpor');
          renderRoute();
        } catch (err) {
          toast(`Gagal impor: ${err.message}`, 'error');
        }
      });
      $('#reset-data', root).addEventListener('click', () => {
        if (!confirm('Semua data akan dikembalikan ke data contoh. Lanjutkan?')) return;
        Store.reset();
        toast('Data demo dipulihkan');
        renderRoute();
      });
    },
  };

  /* ==========================================================
     VIEW: Absensi
     ========================================================== */
  const Absensi = {
    state: { date: todayISO() },
    timer: null,

    render() {
      const { date } = this.state;
      const dow = parseISO(date).getDay();
      const schedules = mySchedules().filter((s) => s.day === dow);
      const students = myStudents()
        .map((s) => ({ ...s, slot: schedules.filter((x) => x.studentId === s.id).sort(byTime)[0] }))
        .sort((a, b) => (a.slot ? 0 : 1) - (b.slot ? 0 : 1) || (a.slot?.start || '').localeCompare(b.slot?.start || ''));
      const records = Store.where('attendance', (a) => a.date === date);
      const period = Periods.range(Periods.indexOf(date));

      return `
        ${pageHead('Absensi', 'Check-in pengajar dan kehadiran siswa per sesi.')}
        <div class="two-col">
          ${isAdmin ? this.adminTeacherCard(date) : this.checkInCard()}
          <div class="card">
            <div class="card-head"><h3>Rekap kehadiran siswa</h3><span class="badge badge-primary">${esc(Periods.label(period))}</span></div>
            <div class="table-wrap"><table>
              <thead><tr><th>Siswa</th><th>H</th><th>I</th><th>S</th><th>A</th><th>%</th></tr></thead>
              <tbody>${myStudents().map((s) => {
                const sum = periodSummary(s.id, period.start, period.end);
                return `<tr><td>${esc(s.name)}</td><td>${sum.H}</td><td>${sum.I}</td><td>${sum.S}</td><td>${sum.A}</td>
                  <td><span class="badge badge-${sum.percent >= 85 ? 'ok' : sum.percent >= 70 ? 'warn' : 'bad'}">${sum.sessions ? `${sum.percent}%` : '-'}</span></td></tr>`;
              }).join('')}</tbody>
            </table></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Absensi siswa</h3>
            <div style="display:flex;gap:.5rem;align-items:center">
              <input type="date" id="att-date" value="${esc(date)}" max="${todayISO()}" style="width:auto">
            </div>
          </div>
          <p class="small muted">${esc(fmtDateLong(date))} — baris bergaris emas adalah siswa yang terjadwal pada hari ini.</p>
          ${students.length ? `
          <form id="att-form">
            <div class="table-wrap"><table>
              <thead><tr><th>Siswa</th><th>Jadwal</th>${isAdmin ? '<th>Guru</th>' : ''}<th>Status</th><th>Catatan</th></tr></thead>
              <tbody>${students.map((s) => {
                const rec = records.find((r) => r.studentId === s.id);
                return `<tr class="${s.slot ? 'scheduled' : ''}">
                  <td><strong>${esc(s.name)}</strong><div class="small muted">${esc(s.program)} · ${esc(s.level)}</div></td>
                  <td class="small">${s.slot ? `${esc(s.slot.start)}–${esc(s.slot.end)}` : '<span class="muted">-</span>'}</td>
                  ${isAdmin ? `<td class="small">${esc(teacherName(s.teacherId))}</td>` : ''}
                  <td><div class="att-options">${Object.entries(ATTENDANCE_STATUS).map(([k, v]) => `
                    <label title="${v.label}"><input type="radio" name="st_${esc(s.id)}" value="${k}" ${rec?.status === k ? 'checked' : ''}><span class="${v.cls}">${k}</span></label>`).join('')}
                  </div></td>
                  <td><input name="note_${esc(s.id)}" value="${esc(rec?.note || '')}" placeholder="opsional" style="min-width:140px"></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>
            <div class="form-actions" style="margin-top:1rem">
              <button type="button" class="btn btn-ghost" id="all-present">Tandai semua terjadwal Hadir</button>
              <button class="btn" type="submit">💾 Simpan absensi</button>
            </div>
          </form>` : empty('🧒', 'Belum ada siswa.')}
        </div>
      `;
    },

    checkInCard() {
      const today = todayISO();
      const rec = Store.all('teacherAttendance').find((a) => a.teacherId === me.id && a.date === today);
      const history = Store.where('teacherAttendance', (a) => a.teacherId === me.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      return `
        <div class="card">
          <div class="card-head"><h3>Absensi pengajar</h3><span class="badge ${rec ? (rec.checkOut ? 'badge-ok' : 'badge-warn') : ''}">${rec ? (rec.checkOut ? 'Selesai' : 'Sedang mengajar') : 'Belum check-in'}</span></div>
          <div class="checkin-box">
            <div><div class="clock" id="clock">--:--</div><div class="small muted">${esc(fmtDateLong(today))}</div></div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button class="btn" id="check-in" ${rec ? 'disabled' : ''}>📍 Check-in</button>
              <button class="btn btn-outline" id="check-out" ${!rec || rec.checkOut ? 'disabled' : ''}>Check-out</button>
            </div>
          </div>
          ${rec ? `<p class="small" style="margin:.9rem 0 0">Masuk <strong>${fmtTime(rec.checkIn)}</strong>${rec.checkOut ? ` · Pulang <strong>${fmtTime(rec.checkOut)}</strong>` : ''}${rec.lat ? ` · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${rec.lat},${rec.lng}">lihat titik GPS</a>` : ''}</p>` : ''}
          <h4 style="margin:1.25rem 0 .5rem;font-size:.9rem">Riwayat 7 hari mengajar terakhir</h4>
          <div class="table-wrap"><table>
            <thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Durasi</th></tr></thead>
            <tbody>${history.map((h) => `<tr><td>${esc(fmtDate(h.date))}</td><td>${fmtTime(h.checkIn)}</td><td>${fmtTime(h.checkOut)}</td>
              <td>${h.checkOut ? `${((h.checkOut - h.checkIn) / 3600000).toFixed(1)} jam` : '-'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada riwayat.</td></tr>'}</tbody>
          </table></div>
        </div>`;
    },

    adminTeacherCard(date) {
      const recs = Store.where('teacherAttendance', (a) => a.date === date);
      return `
        <div class="card">
          <div class="card-head"><h3>Kehadiran pengajar</h3><span class="small muted">${esc(fmtDate(date))}</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Guru</th><th>Masuk</th><th>Pulang</th><th>GPS</th></tr></thead>
            <tbody>${gurus().map((t) => {
              const r = recs.find((x) => x.teacherId === t.id);
              return `<tr><td>${esc(t.name)}</td><td>${r ? fmtTime(r.checkIn) : '<span class="badge">Belum</span>'}</td><td>${r ? fmtTime(r.checkOut) : '-'}</td>
                <td>${r?.lat ? `<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.lat},${r.lng}">📍 Peta</a>` : '-'}</td></tr>`;
            }).join('')}</tbody>
          </table></div>
        </div>`;
    },

    bind(root) {
      const clock = $('#clock', root);
      if (clock) {
        const tick = () => (clock.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        tick();
        this.timer = setInterval(tick, 1000);
      }

      $('#att-date', root).addEventListener('change', (e) => {
        if (!e.target.value) return;
        this.state.date = e.target.value;
        renderRoute();
      });

      const getGPS = () =>
        new Promise((resolve) => {
          // Pakai posisi live terbaru bila ada, tidak perlu menunggu GPS lagi
          if (Live.last && Date.now() - Live.last.ts < 120000) return resolve({ lat: Live.last.lat, lng: Live.last.lng });
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        });

      $('#check-in', root)?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        e.target.textContent = 'Mengambil lokasi…';
        const gps = await getGPS();
        Store.insert('teacherAttendance', { date: todayISO(), teacherId: me.id, checkIn: Date.now(), checkOut: null, lat: gps?.lat ?? null, lng: gps?.lng ?? null });
        toast(gps ? 'Check-in berhasil beserta lokasi GPS' : 'Check-in berhasil (tanpa GPS)');
        renderRoute();
      });

      $('#check-out', root)?.addEventListener('click', () => {
        const rec = Store.all('teacherAttendance').find((a) => a.teacherId === me.id && a.date === todayISO());
        if (!rec) return;
        Store.update('teacherAttendance', rec.id, { checkOut: Date.now() });
        toast('Check-out berhasil. Jazakallahu khairan!');
        renderRoute();
      });

      const form = $('#att-form', root);
      if (!form) return;
      $('#all-present', root).addEventListener('click', () => {
        $$('tr.scheduled', form).forEach((tr) => {
          const h = $('input[value="H"]', tr);
          if (h) h.checked = true;
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        let saved = 0;
        myStudents().forEach((s) => {
          const status = fd.get(`st_${s.id}`);
          if (!status) return;
          Store.upsert('attendance', { date: this.state.date, studentId: s.id }, {
            status, note: String(fd.get(`note_${s.id}`) || '').trim(), teacherId: isAdmin ? s.teacherId : me.id,
          });
          saved++;
        });
        toast(saved ? `Absensi ${saved} siswa tersimpan` : 'Pilih status kehadiran terlebih dahulu', saved ? 'success' : 'info');
        if (saved) renderRoute();
      });
    },

    unbind() {
      clearInterval(this.timer);
    },
  };

  /* ==========================================================
     VIEW: Bab (materi & progres)
     ========================================================== */
  const Bab = {
    state: { program: null },
    STATUS_CYCLE: { belum: 'proses', proses: 'selesai', selesai: 'belum' },
    STATUS_LABEL: { belum: '—', proses: 'Proses', selesai: '✓ Selesai' },

    render() {
      if (!this.state.program) this.state.program = myStudents()[0]?.program || PROGRAMS[0];
      const program = this.state.program;
      const chapters = chaptersOf(program);
      const students = myStudents().filter((s) => s.program === program);
      const progress = Store.all('progress');
      const statusOf = (sid, cid) => progress.find((p) => p.studentId === sid && p.chapterId === cid)?.status || 'belum';

      return `
        ${pageHead('Bab Materi', 'Kurikulum per program dan progres belajar setiap siswa.')}
        <div class="filters">${PROGRAMS.map((p) => `<button class="chip ${p === program ? 'active' : ''}" data-program="${esc(p)}">${esc(p)}</button>`).join('')}</div>

        <div class="card">
          <div class="card-head"><h3>Progres siswa — ${esc(program)}</h3><span class="small muted">Klik sel untuk mengubah status: — → Proses → Selesai</span></div>
          ${students.length && chapters.length ? `
          <div class="table-wrap"><table class="progress-matrix">
            <thead><tr><th>Siswa</th>${chapters.map((c) => `<th class="rot" title="${esc(c.title)}">Bab ${c.order}<br><span style="font-weight:500">${esc(c.title.length > 26 ? `${c.title.slice(0, 24)}…` : c.title)}</span></th>`).join('')}<th>Progres</th></tr></thead>
            <tbody>${students.map((s) => {
              const done = chapters.filter((c) => statusOf(s.id, c.id) === 'selesai').length;
              const pct = Math.round((done / chapters.length) * 100);
              return `<tr><td><strong>${esc(s.name)}</strong>${isAdmin ? `<div class="small muted">${esc(teacherName(s.teacherId))}</div>` : ''}</td>
                ${chapters.map((c) => {
                  const st = statusOf(s.id, c.id);
                  return `<td><button class="pg-cell ${st}" data-student="${esc(s.id)}" data-chapter="${esc(c.id)}" data-status="${st}">${this.STATUS_LABEL[st]}</button></td>`;
                }).join('')}
                <td style="min-width:120px"><div class="bar"><div style="width:${pct}%"></div></div><div class="small muted">${done}/${chapters.length} bab · ${pct}%</div></td></tr>`;
            }).join('')}</tbody>
          </table></div>` : empty('📚', students.length ? 'Belum ada bab untuk program ini.' : `Tidak ada siswa ${isAdmin ? '' : 'binaan Anda '}di program ${esc(program)}.`)}
        </div>

        <div class="two-col" style="margin-top:1.25rem">
          <div class="card">
            <div class="card-head"><h3>Daftar bab ${esc(program)}</h3><span class="badge badge-primary">${chapters.length} bab</span></div>
            ${chapters.length ? `<ol class="chapter-list">${chapters.map((c, i) => `
              <li><span class="num">${c.order}</span>
                <div style="flex:1"><strong>${esc(c.title)}</strong>${c.description ? `<div class="small muted">${esc(c.description)}</div>` : ''}</div>
                <button class="btn btn-sm btn-ghost" data-move="${esc(c.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Naikkan">↑</button>
                <button class="btn btn-sm btn-ghost" data-move="${esc(c.id)}" data-dir="1" ${i === chapters.length - 1 ? 'disabled' : ''} title="Turunkan">↓</button>
                <button class="btn btn-sm btn-ghost" data-del-chapter="${esc(c.id)}" title="Hapus">🗑️</button>
              </li>`).join('')}</ol>` : empty('📭', 'Belum ada bab.')}
          </div>
          <div class="card">
            <div class="card-head"><h3>Tambah bab baru</h3></div>
            <form id="chapter-form">
              <div class="field"><label for="ch-title">Judul bab</label><input id="ch-title" name="title" required placeholder="mis. Hukum Mad Wajib Muttashil"></div>
              <div class="field"><label for="ch-desc">Deskripsi / target capaian</label><textarea id="ch-desc" name="description" placeholder="opsional"></textarea></div>
              <div class="form-actions"><button class="btn" type="submit">➕ Tambah ke ${esc(program)}</button></div>
            </form>
          </div>
        </div>`;
    },

    bind(root) {
      root.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-program]');
        if (chip) {
          this.state.program = chip.dataset.program;
          return renderRoute();
        }
        const cell = e.target.closest('.pg-cell');
        if (cell) {
          const next = this.STATUS_CYCLE[cell.dataset.status];
          const match = { studentId: cell.dataset.student, chapterId: cell.dataset.chapter };
          if (next === 'belum') {
            const ex = Store.all('progress').find((p) => p.studentId === match.studentId && p.chapterId === match.chapterId);
            if (ex) Store.remove('progress', ex.id);
          } else {
            Store.upsert('progress', match, { status: next, date: todayISO() });
          }
          return renderRoute();
        }
        const mv = e.target.closest('[data-move]');
        if (mv) {
          const list = chaptersOf(this.state.program);
          const i = list.findIndex((c) => c.id === mv.dataset.move);
          const j = i + Number(mv.dataset.dir);
          if (list[j]) {
            const a = list[i].order;
            Store.update('chapters', list[i].id, { order: list[j].order });
            Store.update('chapters', list[j].id, { order: a });
            renderRoute();
          }
          return;
        }
        const del = e.target.closest('[data-del-chapter]');
        if (del) {
          const ch = chapterById(del.dataset.delChapter);
          if (!ch || !confirm(`Hapus bab "${ch.title}" beserta progres siswanya?`)) return;
          Store.where('progress', (p) => p.chapterId === ch.id).forEach((p) => Store.remove('progress', p.id));
          Store.remove('chapters', ch.id);
          // Rapikan nomor urut
          chaptersOf(ch.program).forEach((c, idx) => c.order !== idx + 1 && Store.update('chapters', c.id, { order: idx + 1 }));
          toast('Bab dihapus');
          renderRoute();
        }
      });

      $('#chapter-form', root).addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const title = String(fd.get('title')).trim();
        if (!title) return;
        const order = chaptersOf(this.state.program).length + 1;
        Store.insert('chapters', { program: this.state.program, order, title, description: String(fd.get('description')).trim() });
        toast('Bab ditambahkan');
        renderRoute();
      });
    },
  };

  /* ==========================================================
     VIEW: Laporan berfoto
     ========================================================== */
  const MAX_PHOTOS = 4;

  function reportCard(r) {
    const st = studentById(r.studentId);
    const ch = chapterById(r.chapterId);
    return `
      <div class="report">
        <div class="report-head">
          <div>
            <h4>${esc(studentName(r.studentId))} <span class="badge badge-primary">${esc(st?.program || '')}</span></h4>
            <div class="small muted">${esc(fmtDateLong(r.date))}${ch ? ` · Bab ${ch.order}: ${esc(ch.title)}` : ''} · oleh ${esc(teacherName(r.teacherId))}</div>
          </div>
          <div style="display:flex;gap:.4rem">
            ${st?.parentPhone ? `<a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="${waLink(st.parentPhone, reportWaText(r))}">💬 Kirim ke ortu</a>` : ''}
            ${canEditReport(r) ? `<button class="btn btn-sm btn-ghost" data-del-report="${esc(r.id)}" title="Hapus laporan">🗑️</button>` : ''}
          </div>
        </div>
        <p style="margin:.25rem 0 0">${esc(r.summary)}</p>
        ${r.parentNote ? `<div class="note">📌 <strong>Pesan untuk orang tua:</strong> ${esc(r.parentNote)}</div>` : ''}
        ${r.photos?.length ? `<div class="thumbs">${r.photos.map((p) => `<div class="thumb"><img src="${esc(p)}" alt="Foto kegiatan" data-zoom loading="lazy"></div>`).join('')}</div>` : ''}
      </div>`;
  }

  function reportWaText(r) {
    const st = studentById(r.studentId);
    const ch = chapterById(r.chapterId);
    return [
      `Assalamu'alaikum ${st?.parent || 'Bapak/Ibu'},`,
      `Berikut laporan belajar ananda *${st?.name}* (${fmtDateLong(r.date)}):`,
      ch ? `📚 Materi: Bab ${ch.order} — ${ch.title}` : '',
      `📝 ${r.summary}`,
      r.parentNote ? `📌 ${r.parentNote}` : '',
      `\n— ${teacherName(r.teacherId)}, Az-Zikra`,
    ].filter(Boolean).join('\n');
  }

  function bindReportActions(root) {
    root.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-zoom]');
      if (img) return openLightbox(img.src);
      const del = e.target.closest('[data-del-report]');
      if (del && confirm('Hapus laporan ini?')) {
        Store.remove('reports', del.dataset.delReport);
        toast('Laporan dihapus');
        renderRoute();
      }
    });
  }

  const Laporan = {
    state: { photos: [], filter: '', draft: {} },

    render() {
      const students = myStudents();
      const d = this.state.draft;
      const sel = students.find((s) => s.id === d.studentId) || students[0];
      const reports = Store.where('reports', (r) => (isAdmin || r.teacherId === me.id || students.some((s) => s.id === r.studentId)))
        .filter((r) => !this.state.filter || r.studentId === this.state.filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

      return `
        ${pageHead('Laporan Kegiatan', 'Laporan setiap sesi belajar disertai dokumentasi foto.')}
        <div class="two-col">
          <div class="card">
            <div class="card-head"><h3>Buat laporan baru</h3></div>
            ${students.length ? `
            <form id="report-form">
              <div class="form-grid">
                <div class="field"><label for="rp-student">Siswa</label><select id="rp-student" name="studentId" required>${studentOptions(students, sel?.id)}</select></div>
                <div class="field"><label for="rp-date">Tanggal sesi</label><input type="date" id="rp-date" name="date" value="${esc(d.date || todayISO())}" max="${todayISO()}" required></div>
              </div>
              <div class="field"><label for="rp-chapter">Bab yang dipelajari</label>
                <select id="rp-chapter" name="chapterId">${this.chapterOptions(sel, d.chapterId)}</select></div>
              <div class="field"><label for="rp-summary">Ringkasan kegiatan &amp; capaian</label>
                <textarea id="rp-summary" name="summary" required placeholder="Apa yang dipelajari, capaian, dan kendala siswa hari ini…">${esc(d.summary || '')}</textarea></div>
              <div class="field"><label for="rp-note">Pesan untuk orang tua</label>
                <textarea id="rp-note" name="parentNote" style="min-height:70px" placeholder="opsional — PR, saran latihan di rumah, dll.">${esc(d.parentNote || '')}</textarea></div>
              <div class="field">
                <label>Foto kegiatan <span class="muted">(wajib, maks. ${MAX_PHOTOS})</span></label>
                <label class="photo-input" for="rp-photos">📷 Ambil / pilih foto<input type="file" id="rp-photos" accept="image/*" multiple capture="environment"></label>
                <div class="thumbs" id="rp-thumbs">${this.thumbsHtml()}</div>
              </div>
              <div class="form-actions"><button class="btn" type="submit">📤 Kirim laporan</button></div>
            </form>` : empty('🧒', 'Belum ada siswa.')}
          </div>

          <div class="card">
            <div class="card-head">
              <h3>Riwayat laporan</h3>
              <select id="rp-filter" style="width:auto">${studentOptions(students, this.state.filter, 'Semua siswa')}</select>
            </div>
            ${reports.length ? reports.map(reportCard).join('') : empty('📸', 'Belum ada laporan.')}
          </div>
        </div>`;
    },

    chapterOptions(student, selected) {
      if (!student) return '';
      const done = Store.where('progress', (p) => p.studentId === student.id);
      const current = done.find((p) => p.status === 'proses')?.chapterId;
      const pick = selected || current;
      return '<option value="">— pilih bab —</option>' + chaptersOf(student.program)
        .map((c) => `<option value="${esc(c.id)}" ${c.id === pick ? 'selected' : ''}>Bab ${c.order}: ${esc(c.title)}</option>`).join('');
    },

    thumbsHtml() {
      return this.state.photos.map((p, i) => `<div class="thumb"><img src="${esc(p)}" alt="Foto ${i + 1}" data-zoom><button type="button" data-rm-photo="${i}" aria-label="Hapus foto">&times;</button></div>`).join('');
    },

    saveDraft(form) {
      const fd = new FormData(form);
      this.state.draft = Object.fromEntries(['studentId', 'date', 'chapterId', 'summary', 'parentNote'].map((k) => [k, fd.get(k)]));
    },

    bind(root) {
      bindReportActions(root);
      $('#rp-filter', root).addEventListener('change', (e) => {
        this.state.filter = e.target.value;
        const form = $('#report-form', root);
        if (form) this.saveDraft(form);
        renderRoute();
      });

      const form = $('#report-form', root);
      if (!form) return;
      form.addEventListener('input', () => this.saveDraft(form));

      $('#rp-student', root).addEventListener('change', (e) => {
        $('#rp-chapter', root).innerHTML = this.chapterOptions(studentById(e.target.value));
        this.saveDraft(form);
      });

      $('#rp-photos', root).addEventListener('change', async (e) => {
        const files = [...e.target.files];
        e.target.value = '';
        const room = MAX_PHOTOS - this.state.photos.length;
        if (files.length > room) toast(`Maksimal ${MAX_PHOTOS} foto per laporan`, 'info');
        for (const file of files.slice(0, Math.max(0, room))) {
          try {
            this.state.photos.push(await compressImage(file));
          } catch (err) {
            toast(err.message, 'error');
          }
        }
        $('#rp-thumbs', root).innerHTML = this.thumbsHtml();
      });

      $('#rp-thumbs', root).addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm-photo]');
        if (!rm) return;
        e.stopPropagation();
        this.state.photos.splice(Number(rm.dataset.rmPhoto), 1);
        $('#rp-thumbs', root).innerHTML = this.thumbsHtml();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.state.photos.length) {
          toast('Lampirkan minimal 1 foto kegiatan', 'error');
          return;
        }
        const fd = new FormData(form);
        const student = studentById(fd.get('studentId'));
        const row = Store.insert('reports', {
          teacherId: isAdmin ? student.teacherId : me.id,
          studentId: student.id,
          date: fd.get('date'),
          chapterId: fd.get('chapterId') || null,
          summary: String(fd.get('summary')).trim(),
          parentNote: String(fd.get('parentNote')).trim(),
          photos: [...this.state.photos],
        });
        if (!row) return;
        this.state.photos = [];
        this.state.draft = {};
        toast('Laporan terkirim');
        renderRoute();
      });
    },
  };

  /* ==========================================================
     VIEW: Rapor 2 mingguan
     ========================================================== */
  const Rapor = {
    state: { studentId: null, periodIndex: Periods.current().index },

    render() {
      const students = myStudents();
      if (!students.some((s) => s.id === this.state.studentId)) this.state.studentId = students[0]?.id || null;
      const student = studentById(this.state.studentId);
      const period = Periods.range(this.state.periodIndex);
      const existing = student && Store.all('rapor').find((r) => r.studentId === student.id && r.periodIndex === period.index);
      const sum = student ? periodSummary(student.id, period.start, period.end) : null;
      const list = Store.where('rapor', (r) => students.some((s) => s.id === r.studentId))
        .sort((a, b) => b.periodIndex - a.periodIndex || studentName(a.studentId).localeCompare(studentName(b.studentId)));

      return `
        ${pageHead('Rapor 2 Mingguan', 'Penilaian perkembangan siswa setiap periode 14 hari.')}
        ${student ? `
        <div class="card">
          <div class="form-grid">
            <div class="field"><label for="rr-student">Siswa</label><select id="rr-student">${studentOptions(students, student.id)}</select></div>
            <div class="field"><label for="rr-period">Periode</label><select id="rr-period">${Periods.recent(8).map((p) => `<option value="${p.index}" ${p.index === period.index ? 'selected' : ''}>${esc(Periods.label(p))}${p.index === Periods.current().index ? ' (berjalan)' : ''}</option>`).join('')}</select></div>
          </div>

          <h4 style="margin:.25rem 0 .75rem">Rekap otomatis periode ini ${existing ? '<span class="badge badge-ok">Rapor sudah dibuat</span>' : '<span class="badge badge-warn">Belum dibuat</span>'}</h4>
          <div class="summary-boxes">
            <div><strong>${sum.percent}%</strong><span>Kehadiran (${sum.H}/${sum.sessions} sesi)</span></div>
            <div><strong>${sum.I + sum.S}</strong><span>Izin / Sakit</span></div>
            <div><strong>${sum.A}</strong><span>Alpa</span></div>
            <div><strong>${sum.chaptersDone.length}</strong><span>Bab diselesaikan</span></div>
            <div><strong>${sum.reports}</strong><span>Laporan sesi</span></div>
          </div>

          <form id="rapor-form">
            <h4 style="margin:0 0 .75rem">Penilaian guru (0–100)</h4>
            <div class="score-grid">${RAPOR_ASPECTS.map((a) => `
              <div class="score-row"><label for="sc-${a.key}">${esc(a.label)}</label>
              <input type="number" id="sc-${a.key}" name="${a.key}" min="0" max="100" required value="${esc(existing?.scores?.[a.key] ?? '')}" placeholder="0–100"></div>`).join('')}
            </div>
            <div class="form-grid" style="margin-top:1rem">
              <div class="field"><label for="rr-note">Catatan perkembangan</label><textarea id="rr-note" name="note" placeholder="Kelebihan dan hal yang perlu ditingkatkan…">${esc(existing?.note || '')}</textarea></div>
              <div class="field"><label for="rr-target">Target 2 minggu ke depan</label><textarea id="rr-target" name="target" placeholder="mis. Menyelesaikan Bab 4, hafalan QS. Al-Buruj">${esc(existing?.target || '')}</textarea></div>
            </div>
            <div class="form-actions">
              ${existing ? `<button type="button" class="btn btn-outline" data-view-rapor="${esc(existing.id)}">🖨️ Lihat &amp; cetak</button>` : ''}
              <button class="btn" type="submit">💾 ${existing ? 'Perbarui' : 'Simpan'} rapor</button>
            </div>
          </form>
        </div>` : `<div class="card">${empty('🧒', 'Belum ada siswa.')}</div>`}

        <div class="card">
          <div class="card-head"><h3>Arsip rapor</h3><span class="badge">${list.length} rapor</span></div>
          ${list.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Siswa</th><th>Periode</th><th>Kehadiran</th><th>Rata-rata</th><th>Predikat</th><th></th></tr></thead>
            <tbody>${list.map((r) => {
              const avg = raporAverage(r);
              const p = predikat(avg);
              const pr = Periods.range(r.periodIndex);
              return `<tr><td><strong>${esc(studentName(r.studentId))}</strong></td>
                <td class="small">${esc(fmtDate(pr.start, { day: 'numeric', month: 'short' }))} – ${esc(fmtDate(pr.end, { day: 'numeric', month: 'short', year: 'numeric' }))}</td>
                <td>${r.attendancePercent ?? '-'}%</td><td><strong>${avg}</strong></td>
                <td><span class="badge badge-${p.cls}">${p.grade} · ${esc(p.label)}</span></td>
                <td class="actions"><button class="btn btn-sm btn-outline" data-view-rapor="${esc(r.id)}">Lihat</button>
                <button class="btn btn-sm btn-ghost" data-del-rapor="${esc(r.id)}" title="Hapus">🗑️</button></td></tr>`;
            }).join('')}</tbody>
          </table></div>` : empty('📝', 'Belum ada rapor tersimpan.')}
        </div>`;
    },

    doc(r) {
      const st = studentById(r.studentId);
      const pr = Periods.range(r.periodIndex);
      const sum = periodSummary(r.studentId, pr.start, pr.end);
      const avg = raporAverage(r);
      const p = predikat(avg);
      return `
        <div class="rapor-doc">
          <header>
            <span class="brand-logo" style="width:56px;height:56px;font-size:1.9rem">ذ</span>
            <div><h2>RAPOR PERKEMBANGAN BELAJAR</h2><div class="small">Az-Zikra — ${esc(CONFIG.tagline)} · ${esc(CONFIG.address)}</div></div>
          </header>
          <div class="identity">
            <div>Nama siswa: <strong>${esc(st?.name || '-')}</strong></div>
            <div>Periode: <strong>${esc(fmtDate(pr.start, { day: 'numeric', month: 'long' }))} – ${esc(fmtDate(pr.end, { day: 'numeric', month: 'long', year: 'numeric' }))}</strong></div>
            <div>Jenjang: <strong>${esc(st?.level || '-')}</strong></div>
            <div>Program: <strong>${esc(st?.program || '-')}</strong></div>
            <div>Pengajar: <strong>${esc(teacherName(r.teacherId))}</strong></div>
            <div>Kehadiran: <strong>${sum.H} dari ${sum.sessions} sesi (${sum.percent}%)</strong></div>
          </div>
          <table>
            <thead><tr><th style="width:40px">No</th><th>Aspek penilaian</th><th style="width:90px">Nilai</th><th style="width:150px">Predikat</th></tr></thead>
            <tbody>${RAPOR_ASPECTS.map((a, i) => {
              const v = Number(r.scores?.[a.key] ?? 0);
              return `<tr><td>${i + 1}</td><td>${esc(a.label)}</td><td><strong>${v}</strong></td><td>${predikat(v).grade} — ${esc(predikat(v).label.split(' (')[0])}</td></tr>`;
            }).join('')}
              <tr><td></td><td><strong>Rata-rata</strong></td><td><strong>${avg}</strong></td><td><strong>${p.grade} — ${esc(p.label)}</strong></td></tr>
            </tbody>
          </table>
          <h4 style="margin:1.25rem 0 .4rem">Materi diselesaikan</h4>
          <p class="small" style="margin:0">${sum.chaptersDone.length ? sum.chaptersDone.map((pg) => { const c = chapterById(pg.chapterId); return c ? `Bab ${c.order}: ${esc(c.title)}` : ''; }).filter(Boolean).join(' · ') : 'Belum ada bab yang diselesaikan pada periode ini.'}</p>
          <h4 style="margin:1rem 0 .4rem">Catatan perkembangan</h4>
          <p class="small" style="margin:0;white-space:pre-line">${esc(r.note || '-')}</p>
          <h4 style="margin:1rem 0 .4rem">Target 2 minggu ke depan</h4>
          <p class="small" style="margin:0;white-space:pre-line">${esc(r.target || '-')}</p>
          <div class="signs">
            <div>Orang tua / wali<div class="line">${esc(st?.parent || '..........................')}</div></div>
            <div>${esc(CONFIG.address.split(',')[0])}, ${esc(fmtDate(pr.end, { day: 'numeric', month: 'long', year: 'numeric' }))}<br>Pengajar<div class="line">${esc(teacherName(r.teacherId))}</div></div>
          </div>
        </div>`;
    },

    showDoc(id) {
      const r = Store.find('rapor', id);
      if (!r) return;
      const st = studentById(r.studentId);
      const avg = raporAverage(r);
      const waText = `Assalamu'alaikum ${st?.parent || ''}, rapor 2 mingguan ananda *${st?.name}* (${Periods.label(Periods.range(r.periodIndex))}) sudah terbit. Nilai rata-rata: *${avg}* (${predikat(avg).label}). Catatan: ${r.note || '-'} — Az-Zikra`;
      const { el } = openModal(`
        <div class="card-head"><h3>Rapor ${esc(st?.name || '')}</h3><button class="btn btn-sm btn-ghost" data-close>Tutup</button></div>
        ${this.doc(r)}
        <div class="form-actions" style="margin-top:1rem">
          ${st?.parentPhone ? `<a class="btn btn-outline" target="_blank" rel="noopener" href="${waLink(st.parentPhone, waText)}">💬 Kabari orang tua</a>` : ''}
          <button class="btn" id="print-rapor">🖨️ Cetak / simpan PDF</button>
        </div>`, { wide: true });
      $('#print-rapor', el).addEventListener('click', () => {
        const area = document.createElement('div');
        area.id = 'print-area';
        area.innerHTML = this.doc(r);
        document.body.appendChild(area);
        document.body.classList.add('printing');
        const done = () => {
          document.body.classList.remove('printing');
          area.remove();
          window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        window.print();
        setTimeout(done, 1000);
      });
    },

    bind(root) {
      $('#rr-student', root)?.addEventListener('change', (e) => {
        this.state.studentId = e.target.value;
        renderRoute();
      });
      $('#rr-period', root)?.addEventListener('change', (e) => {
        this.state.periodIndex = Number(e.target.value);
        renderRoute();
      });
      root.addEventListener('click', (e) => {
        const v = e.target.closest('[data-view-rapor]');
        if (v) return this.showDoc(v.dataset.viewRapor);
        const d = e.target.closest('[data-del-rapor]');
        if (d && confirm('Hapus rapor ini?')) {
          Store.remove('rapor', d.dataset.delRapor);
          toast('Rapor dihapus');
          renderRoute();
        }
      });
      $('#rapor-form', root)?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const student = studentById(this.state.studentId);
        const period = Periods.range(this.state.periodIndex);
        const scores = Object.fromEntries(RAPOR_ASPECTS.map((a) => [a.key, Math.min(100, Math.max(0, Number(fd.get(a.key))))]));
        const sum = periodSummary(student.id, period.start, period.end);
        const row = Store.upsert('rapor', { studentId: student.id, periodIndex: period.index }, {
          teacherId: isAdmin ? student.teacherId : me.id,
          scores,
          note: String(fd.get('note')).trim(),
          target: String(fd.get('target')).trim(),
          attendancePercent: sum.percent,
        });
        if (!row) return;
        toast('Rapor tersimpan');
        renderRoute();
        this.showDoc(row.id);
      });
    },
  };

  /* ==========================================================
     Jadwal (pengajar & siswa)
     ========================================================== */
  const colorOf = (id) => `c${[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6}`;

  function weekGrid(slots, labelFn) {
    const todayDow = new Date().getDay();
    return `<div class="week">${DAY_ORDER.map((d) => `
      <div class="day-col ${d === todayDow ? 'today' : ''}">
        <h4>${DAYS[d]}</h4>
        ${slots.filter((s) => s.day === d).sort(byTime).map((s) => `
          <div class="slot ${colorOf(s.studentId)}">
            <button class="del" data-del-schedule="${esc(s.id)}" title="Hapus jadwal" aria-label="Hapus jadwal">&times;</button>
            <span class="t">${esc(s.start)}–${esc(s.end)}</span>
            ${labelFn(s)}
            <div class="muted">${esc(s.location)}</div>
          </div>`).join('') || '<div class="small muted" style="text-align:center">—</div>'}
      </div>`).join('')}</div>`;
  }

  const minutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  function scheduleForm({ students, fixedStudent }) {
    return `
      <form id="schedule-form">
        <div class="form-grid">
          ${fixedStudent ? `<input type="hidden" name="studentId" value="${esc(fixedStudent.id)}">`
            : `<div class="field"><label for="sf-student">Siswa</label><select id="sf-student" name="studentId" required>${studentOptions(students, '', '— pilih siswa —')}</select></div>`}
          <div class="field"><label for="sf-day">Hari</label><select id="sf-day" name="day">${DAY_ORDER.map((d) => `<option value="${d}">${DAYS[d]}</option>`).join('')}</select></div>
          <div class="field"><label for="sf-start">Mulai</label><input type="time" id="sf-start" name="start" required value="15:30"></div>
          <div class="field"><label for="sf-end">Selesai</label><input type="time" id="sf-end" name="end" required value="16:30"></div>
          <div class="field"><label for="sf-loc">Tempat</label><input id="sf-loc" name="location" value="Rumah siswa" list="loc-list">
            <datalist id="loc-list"><option value="Rumah siswa"><option value="Online (Zoom)"><option value="Online (Google Meet)"><option value="Kantor Az-Zikra"></datalist></div>
        </div>
        <div class="form-actions"><button class="btn" type="submit">➕ Tambah jadwal</button></div>
      </form>`;
  }

  function bindScheduleForm(root, resolveTeacher) {
    root.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del-schedule]');
      if (del && confirm('Hapus jadwal ini?')) {
        Store.remove('schedules', del.dataset.delSchedule);
        toast('Jadwal dihapus');
        renderRoute();
      }
    });
    $('#schedule-form', root)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const student = studentById(fd.get('studentId'));
      if (!student) return toast('Pilih siswa', 'error');
      const data = {
        studentId: student.id,
        teacherId: resolveTeacher(student),
        day: Number(fd.get('day')),
        start: fd.get('start'),
        end: fd.get('end'),
        location: String(fd.get('location') || '').trim() || 'Rumah siswa',
      };
      if (minutes(data.end) <= minutes(data.start)) return toast('Jam selesai harus setelah jam mulai', 'error');
      const clash = Store.all('schedules').find((s) =>
        s.day === data.day && (s.teacherId === data.teacherId || s.studentId === data.studentId) &&
        minutes(s.start) < minutes(data.end) && minutes(data.start) < minutes(s.end));
      if (clash) {
        return toast(`Bentrok dengan jadwal ${studentName(clash.studentId)} (${teacherName(clash.teacherId)}) ${DAYS[clash.day]} ${clash.start}–${clash.end}`, 'error');
      }
      Store.insert('schedules', data);
      toast('Jadwal ditambahkan');
      renderRoute();
    });
  }

  const JadwalPengajar = {
    state: { teacherId: null },
    render() {
      const teacherId = isAdmin ? (this.state.teacherId ||= gurus()[0]?.id) : me.id;
      const slots = Store.where('schedules', (s) => s.teacherId === teacherId);
      const totalMin = slots.reduce((a, s) => a + minutes(s.end) - minutes(s.start), 0);
      const students = Store.where('students', (s) => s.teacherId === teacherId).sort((a, b) => a.name.localeCompare(b.name));
      return `
        ${pageHead('Jadwal Pengajar', 'Jadwal mengajar mingguan.',
          isAdmin ? `<select id="jp-teacher" style="width:auto">${teacherOptions(teacherId)}</select>` : '')}
        <div class="stats">
          <div class="card stat"><div class="icon">🗓️</div><div><strong>${slots.length}</strong><span>Sesi per minggu</span></div></div>
          <div class="card stat"><div class="icon">⏱️</div><div><strong>${(totalMin / 60).toFixed(1)}</strong><span>Jam mengajar / minggu</span></div></div>
          <div class="card stat"><div class="icon">🧒</div><div><strong>${students.length}</strong><span>Siswa</span></div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${esc(teacherName(teacherId))}</h3></div>
          ${weekGrid(slots, (s) => `<strong>${esc(studentName(s.studentId))}</strong><div>${esc(studentById(s.studentId)?.program || '')}</div>`)}
        </div>
        <div class="card"><div class="card-head"><h3>Tambah jadwal mengajar</h3></div>
          ${students.length ? scheduleForm({ students }) : empty('🧒', 'Guru ini belum memiliki siswa.')}</div>`;
    },
    bind(root) {
      $('#jp-teacher', root)?.addEventListener('change', (e) => {
        this.state.teacherId = e.target.value;
        renderRoute();
      });
      bindScheduleForm(root, () => (isAdmin ? this.state.teacherId : me.id));
    },
  };

  const JadwalSiswa = {
    state: { studentId: null },
    render() {
      const students = myStudents();
      if (!students.some((s) => s.id === this.state.studentId)) this.state.studentId = students[0]?.id || null;
      const student = studentById(this.state.studentId);
      const slots = student ? Store.where('schedules', (s) => s.studentId === student.id) : [];
      return `
        ${pageHead('Jadwal Siswa', 'Jadwal belajar mingguan setiap siswa.',
          students.length ? `<select id="js-student" style="width:auto">${studentOptions(students, this.state.studentId)}</select>` : '')}
        ${student ? `
        <div class="card">
          <div class="card-head"><h3>${esc(student.name)} <span class="badge badge-primary">${esc(student.program)}</span></h3>
            <span class="small muted">${esc(student.level)} · Pengajar: ${esc(teacherName(student.teacherId))}</span></div>
          ${weekGrid(slots, (s) => `<strong>${esc(teacherName(s.teacherId))}</strong>`)}
        </div>
        <div class="card"><div class="card-head"><h3>Tambah jadwal untuk ${esc(student.name)}</h3></div>${scheduleForm({ fixedStudent: student })}</div>` : ''}
        <div class="card">
          <div class="card-head"><h3>Ringkasan jadwal semua siswa</h3></div>
          ${students.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Siswa</th><th>Program</th><th>Pengajar</th><th>Jadwal</th></tr></thead>
            <tbody>${students.map((s) => {
              const sl = Store.where('schedules', (x) => x.studentId === s.id).sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || byTime(a, b));
              return `<tr><td><a href="#jadwal-siswa" data-pick-student="${esc(s.id)}"><strong>${esc(s.name)}</strong></a></td><td>${esc(s.program)}</td><td class="small">${esc(teacherName(s.teacherId))}</td>
                <td class="small">${sl.map((x) => `${DAYS[x.day]} ${esc(x.start)}`).join(', ') || '<span class="muted">belum dijadwalkan</span>'}</td></tr>`;
            }).join('')}</tbody></table></div>` : empty('🧒', 'Belum ada siswa.')}
        </div>`;
    },
    bind(root) {
      $('#js-student', root)?.addEventListener('change', (e) => {
        this.state.studentId = e.target.value;
        renderRoute();
      });
      root.addEventListener('click', (e) => {
        const p = e.target.closest('[data-pick-student]');
        if (p) {
          e.preventDefault();
          this.state.studentId = p.dataset.pickStudent;
          renderRoute();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      bindScheduleForm(root, (student) => student.teacherId);
    },
  };

  /* ==========================================================
     VIEW: Lokasi saya (live location)
     ========================================================== */
  const Lokasi = {
    map: null,
    marker: null,
    listener: null,

    render() {
      if (isAdmin) {
        const list = gurus();
        return `
          ${pageHead('Lokasi Pengajar', 'Pantau posisi live para pengajar.', '<a class="btn btn-outline" href="guru-terdekat.html" target="_blank">Buka peta publik ↗</a>')}
          <div class="card"><div id="my-map"></div></div>
          <div class="card"><div class="table-wrap"><table>
            <thead><tr><th>Guru</th><th>Wilayah</th><th>Status</th><th>Pembaruan terakhir</th></tr></thead>
            <tbody>${list.map((t) => {
              const live = t.sharing && Date.now() - (t.locationUpdatedAt || 0) < CONFIG.liveWindowMs;
              return `<tr><td>${esc(t.name)}</td><td>${esc(t.area)}</td>
                <td>${!t.sharing ? '<span class="badge">Tidak dibagikan</span>' : live ? '<span class="badge badge-ok">Online</span>' : '<span class="badge badge-warn">Offline</span>'}</td>
                <td class="small">${esc(timeAgo(t.locationUpdatedAt))}</td></tr>`;
            }).join('')}</tbody></table></div></div>`;
      }
      const t = Store.find('teachers', me.id);
      return `
        ${pageHead('Lokasi Saya', 'Bagikan lokasi live agar orang tua dapat menemukan Anda di peta guru terdekat.')}
        <div class="two-col">
          <div class="card">
            <label class="switch"><input type="checkbox" id="share-toggle" ${Live.active ? 'checked' : ''}><span class="track"></span>Bagikan lokasi live</label>
            <div id="live-status" class="loc-status" style="margin-bottom:0"></div>
            <p class="small muted" style="margin-top:1rem">Lokasi hanya dikirim selama portal ini terbuka dan tombol aktif. Posisi Anda tampil di halaman <a href="guru-terdekat.html" target="_blank">Guru Terdekat</a> beserta jarak ke calon siswa.</p>
            <form id="area-form" style="margin-top:1rem">
              <div class="field"><label for="area">Wilayah mengajar (tampil publik)</label><input id="area" name="area" value="${esc(t.area || '')}" placeholder="mis. Sentul City"></div>
              <div class="field"><label for="phone">Nomor WhatsApp</label><input id="phone" name="phone" value="${esc(t.phone || '')}" inputmode="tel"></div>
              <div class="field"><label for="bio">Profil singkat</label><textarea id="bio" name="bio" style="min-height:70px">${esc(t.bio || '')}</textarea></div>
              <div class="form-actions"><button class="btn btn-outline" type="submit">Simpan profil</button></div>
            </form>
          </div>
          <div class="card"><div id="my-map"></div></div>
        </div>`;
    },

    statusHtml() {
      const t = Store.find('teachers', me.id);
      if (Live.active && Live.last) {
        return `<span class="live-dot"></span> Live — akurasi ±${Math.round(Live.last.accuracy)} m · diperbarui ${esc(timeAgo(t.locationUpdatedAt))}`;
      }
      if (Live.active) return '⏳ Mencari sinyal GPS…';
      return `<span class="off-dot"></span> Tidak dibagikan · terakhir ${esc(timeAgo(t.locationUpdatedAt))}`;
    },

    bind(root) {
      this.map = L.map($('#my-map', root)).setView(CONFIG.mapCenter, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap',
      }).addTo(this.map);
      const icon = (t, live) => L.divIcon({ className: '', html: `<div class="map-marker ${live ? '' : 'offline'}">${esc(initials(t.name))}</div>`, iconSize: [38, 38], iconAnchor: [19, 19] });

      if (isAdmin) {
        const pts = [];
        gurus().filter((t) => typeof t.lat === 'number').forEach((t) => {
          const live = t.sharing && Date.now() - (t.locationUpdatedAt || 0) < CONFIG.liveWindowMs;
          L.marker([t.lat, t.lng], { icon: icon(t, live) }).addTo(this.map).bindPopup(`<strong>${esc(t.name)}</strong><br>${esc(timeAgo(t.locationUpdatedAt))}`);
          pts.push([t.lat, t.lng]);
        });
        if (pts.length) this.map.fitBounds(pts, { padding: [40, 40] });
        return;
      }

      const update = () => {
        const t = Store.find('teachers', me.id);
        $('#live-status', root).innerHTML = this.statusHtml();
        $('#live-status', root).classList.remove('error');
        const pos = Live.last || (typeof t.lat === 'number' ? { lat: t.lat, lng: t.lng } : null);
        if (!pos) return;
        if (!this.marker) {
          this.marker = L.marker([pos.lat, pos.lng], { icon: icon(t, Live.active) }).addTo(this.map);
          this.map.setView([pos.lat, pos.lng], 15);
        } else {
          this.marker.setLatLng([pos.lat, pos.lng]).setIcon(icon(t, Live.active));
        }
      };
      this.listener = update;
      Live.listeners.add(update);
      update();
      const refresher = setInterval(update, 20000);
      this.cleanupTimer = () => clearInterval(refresher);

      $('#share-toggle', root).addEventListener('change', (e) => {
        if (e.target.checked) {
          if (Live.start()) {
            Store.update('teachers', me.id, { sharing: true });
            toast('Berbagi lokasi live diaktifkan');
          } else {
            e.target.checked = false;
          }
        } else {
          Live.stop(true);
          toast('Berbagi lokasi dihentikan', 'info');
        }
        update();
      });

      $('#area-form', root).addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        Store.update('teachers', me.id, { area: String(fd.get('area')).trim(), phone: String(fd.get('phone')).trim(), bio: String(fd.get('bio')).trim() });
        toast('Profil disimpan');
      });
    },

    unbind() {
      if (this.listener) Live.listeners.delete(this.listener);
      this.cleanupTimer?.();
      this.map?.remove();
      this.map = null;
      this.marker = null;
      this.listener = null;
      this.cleanupTimer = null;
    },
  };

  // Sinkronkan toggle bila izin ditolak saat berada di halaman lokasi
  Live.listeners.add(() => {
    const tg = $('#share-toggle');
    if (tg) tg.checked = Live.active;
  });

  /* ==========================================================
     VIEW: Data siswa
     ========================================================== */
  const Siswa = {
    render() {
      const students = myStudents();
      return `
        ${pageHead('Data Siswa', `${students.length} siswa ${isAdmin ? 'terdaftar' : 'binaan Anda'}.`, '<button class="btn" id="add-student">➕ Tambah siswa</button>')}
        <div class="card">
          ${students.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Nama</th><th>Jenjang</th><th>Program</th>${isAdmin ? '<th>Pengajar</th>' : ''}<th>Orang tua</th><th></th></tr></thead>
            <tbody>${students.map((s) => `<tr>
              <td><strong>${esc(s.name)}</strong></td><td>${esc(s.level)}</td><td><span class="badge badge-primary">${esc(s.program)}</span></td>
              ${isAdmin ? `<td class="small">${esc(teacherName(s.teacherId))}</td>` : ''}
              <td class="small">${esc(s.parent)}<br>${s.parentPhone ? `<a href="${waLink(s.parentPhone)}" target="_blank" rel="noopener">${esc(s.parentPhone)}</a>` : ''}</td>
              <td class="actions"><button class="btn btn-sm btn-outline" data-edit-student="${esc(s.id)}">Ubah</button>
                ${isAdmin ? `<button class="btn btn-sm btn-ghost" data-del-student="${esc(s.id)}" title="Hapus">🗑️</button>` : ''}</td>
            </tr>`).join('')}</tbody></table></div>` : empty('🧒', 'Belum ada siswa.')}
        </div>`;
    },
    form(s = {}) {
      return `
        <div class="card-head"><h3>${s.id ? 'Ubah' : 'Tambah'} siswa</h3><button class="btn btn-sm btn-ghost" data-close>Tutup</button></div>
        <form id="student-form">
          <div class="field"><label for="f-name">Nama lengkap</label><input id="f-name" name="name" required value="${esc(s.name || '')}"></div>
          <div class="form-grid">
            <div class="field"><label for="f-level">Jenjang / kelas</label><input id="f-level" name="level" value="${esc(s.level || '')}" placeholder="mis. SD Kelas 3"></div>
            <div class="field"><label for="f-program">Program</label><select id="f-program" name="program">${PROGRAMS.map((p) => `<option ${p === s.program ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
          </div>
          ${isAdmin ? `<div class="field"><label for="f-teacher">Pengajar</label><select id="f-teacher" name="teacherId">${teacherOptions(s.teacherId)}</select></div>` : ''}
          <div class="form-grid">
            <div class="field"><label for="f-parent">Nama orang tua</label><input id="f-parent" name="parent" value="${esc(s.parent || '')}"></div>
            <div class="field"><label for="f-phone">WhatsApp orang tua</label><input id="f-phone" name="parentPhone" value="${esc(s.parentPhone || '')}" inputmode="tel"></div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Simpan</button></div>
        </form>`;
    },
    bind(root) {
      const open = (s) => {
        const { el, close } = openModal(this.form(s || {}));
        $('#student-form', el).addEventListener('submit', (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.target));
          Object.keys(data).forEach((k) => (data[k] = String(data[k]).trim()));
          if (!isAdmin) data.teacherId = s?.teacherId || me.id;
          if (s?.id) Store.update('students', s.id, data);
          else Store.insert('students', data);
          close();
          toast('Data siswa disimpan');
          renderRoute();
        });
      };
      $('#add-student', root).addEventListener('click', () => open(null));
      root.addEventListener('click', (e) => {
        const ed = e.target.closest('[data-edit-student]');
        if (ed) return open(studentById(ed.dataset.editStudent));
        const del = e.target.closest('[data-del-student]');
        if (del) {
          const s = studentById(del.dataset.delStudent);
          if (!s || !confirm(`Hapus ${s.name} beserta jadwal, absensi, progres, laporan, dan rapornya?`)) return;
          ['schedules', 'attendance', 'progress', 'reports', 'rapor'].forEach((col) =>
            Store.where(col, (x) => x.studentId === s.id).forEach((x) => Store.remove(col, x.id)));
          Store.remove('students', s.id);
          toast('Siswa dihapus');
          renderRoute();
        }
      });
    },
  };

  /* ==========================================================
     VIEW: Data guru (khusus koordinator)
     ========================================================== */
  const Guru = {
    render() {
      return `
        ${pageHead('Data Pengajar', 'Kelola akun guru Az-Zikra.', '<button class="btn" id="add-teacher">➕ Tambah guru</button>')}
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Nama</th><th>Username</th><th>Mapel</th><th>Wilayah</th><th>Siswa</th><th></th></tr></thead>
          <tbody>${gurus().map((t) => `<tr>
            <td><strong>${esc(t.name)}</strong><div class="small muted">${esc(t.phone)}</div></td><td><code>${esc(t.username)}</code></td>
            <td class="small">${esc(t.subjects.join(', '))}</td><td class="small">${esc(t.area)}</td>
            <td>${Store.where('students', (s) => s.teacherId === t.id).length}</td>
            <td class="actions"><button class="btn btn-sm btn-outline" data-edit-teacher="${esc(t.id)}">Ubah</button>
              <button class="btn btn-sm btn-ghost" data-del-teacher="${esc(t.id)}" title="Hapus">🗑️</button></td>
          </tr>`).join('')}</tbody></table></div></div>`;
    },
    form(t = {}) {
      return `
        <div class="card-head"><h3>${t.id ? 'Ubah' : 'Tambah'} guru</h3><button class="btn btn-sm btn-ghost" data-close>Tutup</button></div>
        <form id="teacher-form">
          <div class="field"><label for="g-name">Nama (beserta gelar)</label><input id="g-name" name="name" required value="${esc(t.name || '')}" placeholder="Ustadz/Ustadzah …"></div>
          <div class="form-grid">
            <div class="field"><label for="g-user">Username</label><input id="g-user" name="username" required value="${esc(t.username || '')}" autocomplete="off"></div>
            <div class="field"><label for="g-pass">Kata sandi</label><input id="g-pass" name="password" ${t.id ? '' : 'required'} placeholder="${t.id ? 'kosongkan bila tetap' : ''}" autocomplete="new-password"></div>
          </div>
          <div class="field"><label>Mata pelajaran</label>
            <div style="display:flex;gap:1rem;flex-wrap:wrap">${PROGRAMS.map((p) => `<label style="font-weight:500;display:flex;gap:.35rem;align-items:center;margin:0"><input type="checkbox" name="subjects" value="${esc(p)}" ${t.subjects?.includes(p) ? 'checked' : ''}>${esc(p)}</label>`).join('')}</div></div>
          <div class="form-grid">
            <div class="field"><label for="g-phone">WhatsApp</label><input id="g-phone" name="phone" value="${esc(t.phone || '')}" inputmode="tel"></div>
            <div class="field"><label for="g-area">Wilayah</label><input id="g-area" name="area" value="${esc(t.area || '')}"></div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Simpan</button></div>
        </form>`;
    },
    bind(root) {
      const open = (t) => {
        const { el, close } = openModal(this.form(t || {}));
        $('#teacher-form', el).addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const data = {
            name: String(fd.get('name')).trim(),
            username: String(fd.get('username')).trim().toLowerCase(),
            subjects: fd.getAll('subjects'),
            phone: String(fd.get('phone')).trim(),
            area: String(fd.get('area')).trim(),
          };
          const pw = String(fd.get('password'));
          if (pw) data.password = pw;
          if (Store.all('teachers').some((x) => x.username === data.username && x.id !== t?.id)) {
            return toast('Username sudah dipakai', 'error');
          }
          if (t?.id) Store.update('teachers', t.id, data);
          else Store.insert('teachers', { ...data, role: 'guru', bio: '', sharing: false });
          close();
          toast('Data guru disimpan');
          renderRoute();
        });
      };
      $('#add-teacher', root).addEventListener('click', () => open(null));
      root.addEventListener('click', (e) => {
        const ed = e.target.closest('[data-edit-teacher]');
        if (ed) return open(Store.find('teachers', ed.dataset.editTeacher));
        const del = e.target.closest('[data-del-teacher]');
        if (del) {
          const t = Store.find('teachers', del.dataset.delTeacher);
          const count = Store.where('students', (s) => s.teacherId === t.id).length;
          if (count) return toast(`Pindahkan ${count} siswa ${t.name} ke guru lain terlebih dahulu`, 'error');
          if (!confirm(`Hapus akun ${t.name}?`)) return;
          Store.where('schedules', (s) => s.teacherId === t.id).forEach((s) => Store.remove('schedules', s.id));
          Store.remove('teachers', t.id);
          toast('Guru dihapus');
          renderRoute();
        }
      });
    },
  };

  /* ==========================================================
     Router
     ========================================================== */
  const ROUTES = [
    { key: 'dashboard', label: 'Dashboard', icon: '🏠', view: Dashboard },
    { key: 'absensi', label: 'Absensi', icon: '✅', view: Absensi },
    { key: 'bab', label: 'Bab Materi', icon: '📚', view: Bab },
    { key: 'laporan', label: 'Laporan', icon: '📸', view: Laporan },
    { key: 'rapor', label: 'Rapor 2 Mingguan', icon: '📝', view: Rapor },
    { key: 'jadwal-pengajar', label: 'Jadwal Pengajar', icon: '🗓️', view: JadwalPengajar },
    { key: 'jadwal-siswa', label: 'Jadwal Siswa', icon: '🧒', view: JadwalSiswa },
    { key: 'lokasi', label: isAdmin ? 'Lokasi Pengajar' : 'Lokasi Saya', icon: '📍', view: Lokasi },
    { key: 'siswa', label: 'Data Siswa', icon: '👥', view: Siswa },
    ...(isAdmin ? [{ key: 'guru', label: 'Data Pengajar', icon: '👳', view: Guru }] : []),
  ];

  let currentView = null;
  let viewEl = $('#view');

  function renderRoute() {
    const key = location.hash.slice(1) || 'dashboard';
    const route = ROUTES.find((r) => r.key === key) || ROUTES[0];
    currentView?.unbind?.();
    currentView = route.view;

    // Ganti elemen agar listener lama ikut terbuang
    const fresh = viewEl.cloneNode(false);
    fresh.innerHTML = route.view.render();
    viewEl.replaceWith(fresh);
    viewEl = fresh;
    route.view.bind?.(fresh);

    $$('#side-nav a').forEach((a) => a.classList.toggle('active', a.dataset.key === route.key));
    $('#mobile-title').textContent = route.label;
    document.title = `${route.label} — Portal Guru Az-Zikra`;
    $('#sidebar').classList.remove('open');
  }
  // Sidebar
  $('#side-nav').innerHTML = ROUTES.map((r) => `<li><a href="#${r.key}" data-key="${r.key}"><span class="ico">${r.icon}</span>${esc(r.label)}</a></li>`).join('');
  $('#side-user').innerHTML = `<div class="avatar">${esc(initials(me.name))}</div><div><strong>${esc(me.name)}</strong><span>${isAdmin ? 'Koordinator' : esc(me.subjects.join(', '))}</span></div>`;
  $('#logout').addEventListener('click', () => {
    if (Live.active) Live.stop(true);
    Auth.logout();
    location.href = 'login.html';
  });
  $('#menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#sidebar').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const sb = $('#sidebar');
    if (sb.classList.contains('open') && !e.target.closest('#sidebar')) sb.classList.remove('open');
  });

  window.addEventListener('hashchange', () => {
    renderRoute();
    window.scrollTo(0, 0);
  });

  renderRoute();
})();
