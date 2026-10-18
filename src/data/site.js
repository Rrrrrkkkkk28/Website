export const site = {
  name: 'CV Fabian Teknik',
  short: 'Fabian Teknik',
  wa: '6285850308521',
  waDisplay: '0858-5030-8521',
  email: 'teknikfabian12@gmail.com',
  instagram: 'cvfabian_teknik',
  address: 'Plosoduwur, Glagahan, Kec. Perak, Kab. Jombang, Jawa Timur',
  since: 2021,
};

export const waLink = (text = 'Halo Fabian Teknik, saya ingin konsultasi mengenai mesin pendingin.') =>
  `https://wa.me/${site.wa}?text=${encodeURIComponent(text)}`;

// Peralatan yang ditangani, diurutkan dari suhu kerja tertinggi ke terendah.
export const machines = [
  {
    slug: 'ac',
    signs: ['Ruangan tidak dingin walau suhu remote sudah rendah', 'Air menetes dari unit indoor', 'Bunyi kasar atau getaran di unit outdoor', 'Tagihan listrik naik tanpa sebab jelas'],
    name: 'AC gedung dan kantor',
    temp: 24,
    range: '18 sampai 26°C',
    units: 'Split, cassette, standing floor, dan AC central',
    desc: 'Pemasangan unit baru, cuci berkala, isi freon, sampai penggantian kompresor untuk kantor, sekolah, toko, dan ruang produksi.',
  },
  {
    slug: 'chiller',
    signs: ['Suhu air keluar lebih tinggi dari biasanya', 'Unit sering trip karena tekanan tinggi', 'Kompresor sering mati dan hidup', 'Kondensor kotor atau kipas lemah'],
    name: 'Water chiller',
    temp: 7,
    range: '6 sampai 12°C',
    units: 'Air-cooled dan water-cooled chiller',
    desc: 'Perawatan kondensor dan evaporator, pengecekan tekanan refrigeran, perbaikan pompa dan kontrol, untuk sistem pendingin proses dan gedung.',
  },
  {
    slug: 'ice',
    signs: ['Es butuh waktu lebih lama untuk beku', 'Es keropos atau tidak padat', 'Jumlah produksi per hari turun', 'Air garam (brine) tidak cukup dingin'],
    name: 'Mesin ice making',
    temp: -10,
    range: '−8 sampai −12°C',
    units: 'Mesin es balok, es tube, dan es kristal',
    desc: 'Servis rutin, perbaikan kebocoran, dan penyetelan ulang supaya produksi es per hari kembali ke kapasitas normal.',
  },
  {
    slug: 'cold-storage',
    signs: ['Suhu ruang naik saat siang hari', 'Evaporator tertutup bunga es tebal', 'Karet pintu rusak atau pintu berembun', 'Unit bunyi keras atau sering trip'],
    name: 'Cold storage',
    temp: -18,
    range: '−18 sampai −25°C',
    units: 'Ruang beku, chiller room, dan blast freezer',
    desc: 'Instalasi panel dan unit pendingin, perbaikan evaporator yang membeku, dan pengecekan pintu serta isolasi agar suhu ruang tidak naik.',
  },
];

export const work = [
  { name: 'Instalasi', desc: 'Pemasangan unit baru lengkap dengan pemipaan, kelistrikan, dan uji jalan.' },
  { name: 'Perawatan berkala', desc: 'Jadwal servis bulanan atau per tiga bulan, dengan laporan kondisi mesin setiap kunjungan.' },
  { name: 'Perbaikan dan overhaul', desc: 'Mencari sumber kerusakan, mengganti komponen, dan mengembalikan mesin ke kondisi kerja normal.' },
  { name: 'Fabrikasi dan konstruksi', desc: 'Rangka besi, dudukan unit, ducting, dan panel ruang dingin dikerjakan di workshop sendiri.' },
];

export const industries = [
  'Pabrik es',
  'Cold storage ikan dan daging',
  'Pabrik makanan dan minuman',
  'Hotel dan rumah sakit',
  'Supermarket dan gudang distribusi',
  'Kantor, sekolah, dan pesantren',
];
