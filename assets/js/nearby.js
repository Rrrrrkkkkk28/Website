/* Az-Zikra — peta guru terdekat (live location) */
(() => {
  const state = {
    me: null, // { lat, lng, accuracy }
    subject: 'Semua',
    onlyLive: false,
    selectedId: null,
    markers: new Map(),
    meMarker: null,
    meCircle: null,
    centeredOnMe: false,
  };

  const map = L.map('nearby-map', { zoomControl: true }).setView(CONFIG.mapCenter, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const isLive = (t) => t.sharing && t.locationUpdatedAt && Date.now() - t.locationUpdatedAt < CONFIG.liveWindowMs;

  function visibleTeachers() {
    return Store.all('teachers')
      .filter((t) => t.role === 'guru' && t.sharing && typeof t.lat === 'number' && typeof t.lng === 'number')
      .filter((t) => state.subject === 'Semua' || t.subjects.includes(state.subject))
      .filter((t) => !state.onlyLive || isLive(t))
      .map((t) => ({ ...t, live: isLive(t), distance: state.me ? haversine(state.me.lat, state.me.lng, t.lat, t.lng) : null }))
      .sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return Number(b.live) - Number(a.live);
      });
  }

  function popupHtml(t) {
    return `
      <h4>${esc(t.name)}</h4>
      <div class="small muted">${esc(t.subjects.join(' · '))} — ${esc(t.area)}</div>
      <div class="small" style="margin:.35rem 0">
        ${t.live ? '<span class="live-dot"></span>Online' : '<span class="off-dot"></span>Terakhir aktif'} · ${esc(timeAgo(t.locationUpdatedAt))}
        ${t.distance != null ? `<br><strong>${fmtDistance(t.distance)}</strong> dari Anda` : ''}
      </div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap">
        <a class="btn btn-sm" style="color:#fff" target="_blank" rel="noopener"
           href="${waLink(t.phone, `Assalamu'alaikum ${t.name}, saya melihat profil Anda di Az-Zikra dan ingin bertanya tentang les.`)}">💬 WhatsApp</a>
        <a class="btn btn-sm btn-outline" target="_blank" rel="noopener"
           href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}">🧭 Rute</a>
      </div>`;
  }

  function markerIcon(t) {
    return L.divIcon({
      className: '',
      html: `<div class="map-marker ${t.live ? '' : 'offline'}">${esc(initials(t.name))}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -18],
    });
  }

  function renderFilters() {
    const subjects = ['Semua', ...PROGRAMS];
    $('#filters').innerHTML = subjects
      .map((s) => `<button class="chip ${s === state.subject ? 'active' : ''}" data-subject="${esc(s)}">${esc(s)}</button>`)
      .join('');
  }

  function render() {
    const list = visibleTeachers();

    // Marker: tambah / perbarui / hapus
    const seen = new Set();
    list.forEach((t) => {
      seen.add(t.id);
      let m = state.markers.get(t.id);
      if (!m) {
        m = L.marker([t.lat, t.lng], { icon: markerIcon(t) }).addTo(map);
        m.on('click', () => select(t.id, false));
        state.markers.set(t.id, m);
      } else {
        m.setLatLng([t.lat, t.lng]);
        m.setIcon(markerIcon(t));
      }
      // Jangan timpa popup yang sedang terbuka agar tombol di dalamnya tetap bisa diklik
      if (m.isPopupOpen()) m.setPopupContent(popupHtml(t));
      else m.bindPopup(popupHtml(t));
    });
    state.markers.forEach((m, id) => {
      if (!seen.has(id)) {
        map.removeLayer(m);
        state.markers.delete(id);
      }
    });

    // Daftar
    const box = $('#teacher-list');
    if (!list.length) {
      box.innerHTML = `<div class="empty"><div class="icon">🔍</div>Belum ada guru yang membagikan lokasi untuk filter ini.</div>`;
      return;
    }
    box.innerHTML = list
      .map(
        (t) => `
        <div class="teacher-item ${t.id === state.selectedId ? 'active' : ''}" data-id="${esc(t.id)}" tabindex="0">
          <div class="avatar ${t.live ? 'live' : ''}">${esc(initials(t.name))}</div>
          <div class="meta">
            <h4>${esc(t.name)}</h4>
            <div class="small muted">${esc(t.subjects.join(' · '))} · ${esc(t.area)}</div>
            <div class="small">${t.live ? '<span class="live-dot"></span>Online' : '<span class="off-dot"></span>Offline'} · <span class="muted">${esc(timeAgo(t.locationUpdatedAt))}</span></div>
          </div>
          <div class="dist">${t.distance != null ? fmtDistance(t.distance) : ''}</div>
        </div>`
      )
      .join('');
  }

  function select(id, fly = true) {
    state.selectedId = id;
    const m = state.markers.get(id);
    if (m) {
      if (fly) map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 });
      m.openPopup();
    }
    $$('.teacher-item').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  }

  function setStatus(html, error = false) {
    const el = $('#loc-status');
    el.innerHTML = html;
    el.classList.toggle('error', error);
  }

  function updateMe(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    state.me = { lat, lng, accuracy };
    if (!state.meMarker) {
      state.meMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: '<div class="me-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 1000,
      }).addTo(map).bindPopup('<strong>Lokasi Anda</strong>');
      state.meCircle = L.circle([lat, lng], { radius: accuracy, color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(map);
    } else {
      state.meMarker.setLatLng([lat, lng]);
      state.meCircle.setLatLng([lat, lng]).setRadius(accuracy);
    }
    if (!state.centeredOnMe) {
      state.centeredOnMe = true;
      map.setView([lat, lng], 13);
    }
    setStatus(`<span class="live-dot"></span> Lokasi Anda aktif (akurasi ±${Math.round(accuracy)} m). Daftar diurutkan dari yang terdekat.`);
    render();
  }

  function locError(err) {
    const msg = {
      1: 'Akses lokasi ditolak. Aktifkan izin lokasi di browser untuk melihat jarak guru.',
      2: 'Lokasi tidak tersedia. Pastikan GPS aktif.',
      3: 'Waktu mencari lokasi habis. Coba muat ulang halaman.',
    }[err.code] || 'Gagal mendapatkan lokasi.';
    setStatus(`⚠️ ${msg}`, true);
  }

  // Event
  $('#filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.subject = chip.dataset.subject;
    renderFilters();
    render();
  });
  $('#only-live').addEventListener('change', (e) => {
    state.onlyLive = e.target.checked;
    render();
  });
  $('#teacher-list').addEventListener('click', (e) => {
    const item = e.target.closest('.teacher-item');
    if (item) select(item.dataset.id);
  });
  $('#teacher-list').addEventListener('keydown', (e) => {
    const item = e.target.closest('.teacher-item');
    if (item && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select(item.dataset.id);
    }
  });

  // Pembaruan live: tab lain (portal guru) mengubah data → langsung tampil
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      Store.refresh();
      render();
    }
  });
  // Polling berkala (untuk backend server nanti / memperbarui label "x menit lalu")
  setInterval(() => {
    Store.refresh();
    render();
  }, 15000);

  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(updateMe, locError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  } else {
    setStatus('⚠️ Browser Anda tidak mendukung fitur lokasi.', true);
  }

  renderFilters();
  render();
})();
