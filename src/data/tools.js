// Data untuk alat bantu: cek gejala dan jadwal servis.
// urgency: 3 = segera, 2 = minggu ini, 1 = saat servis rutin

export const urgencyText = {
  3: { label: 'Segera ditangani', desc: 'Mesin berisiko rusak lebih parah atau barang di dalamnya bisa rusak. Hubungi teknisi hari ini.' },
  2: { label: 'Jadwalkan minggu ini', desc: 'Mesin masih bekerja, tapi kinerjanya turun dan biaya listrik naik. Sebaiknya dicek dalam beberapa hari.' },
  1: { label: 'Bisa saat servis rutin', desc: 'Belum mendesak. Catat gejalanya dan sampaikan ke teknisi pada kunjungan berikutnya.' },
};

export const symptoms = {
  ac: [
    { s: 'Tidak dingin sama sekali', c: 'Freon habis, kompresor tidak jalan, atau kapasitor rusak', u: 3 },
    { s: 'Dingin tapi lemah', c: 'Filter dan evaporator kotor, atau freon berkurang', u: 2 },
    { s: 'Air menetes dari unit indoor', c: 'Saluran pembuangan tersumbat atau selang terlepas', u: 2 },
    { s: 'Kipas unit outdoor tidak berputar', c: 'Kapasitor atau motor kipas outdoor rusak', u: 3 },
    { s: 'Bunyi berisik atau bergetar', c: 'Baut dudukan longgar atau bearing kipas aus', u: 1 },
    { s: 'Keluar bau apek', c: 'Jamur dan kotoran menumpuk di evaporator, perlu dicuci', u: 1 },
    { s: 'Bau gosong atau MCB sering turun', c: 'Korsleting pada kabel atau komponen kelistrikan', u: 3, tip: 'Matikan unit dari MCB dan jangan dinyalakan lagi sampai dicek teknisi.' },
  ],
  chiller: [
    { s: 'Suhu air keluar lebih tinggi dari setting', c: 'Kondensor kotor, refrigeran kurang, atau beban melebihi kapasitas', u: 2 },
    { s: 'Trip tekanan tinggi (HP)', c: 'Kondensor kotor, kipas atau pompa air kondensor bermasalah', u: 3 },
    { s: 'Trip tekanan rendah (LP)', c: 'Kebocoran refrigeran atau aliran air ke evaporator kurang', u: 3 },
    { s: 'Kompresor sering mati dan hidup', c: 'Setting thermostat, sensor suhu, atau tekanan refrigeran tidak stabil', u: 2 },
    { s: 'Bunyi kasar dari kompresor', c: 'Komponen dalam kompresor aus atau oli kurang', u: 3, tip: 'Kurangi beban atau matikan kompresor yang berbunyi kasar untuk mencegah kerusakan total.' },
    { s: 'Aliran pompa air lemah', c: 'Strainer tersumbat atau impeller pompa aus', u: 2 },
  ],
  ice: [
    { s: 'Waktu beku lebih lama dari biasanya', c: 'Air garam (brine) kurang dingin, kondensor kotor, atau refrigeran kurang', u: 2 },
    { s: 'Es keropos atau tidak padat', c: 'Suhu brine kurang rendah atau kadar garamnya tidak sesuai', u: 2 },
    { s: 'Jumlah produksi per hari turun', c: 'Kapasitas kompresor menurun atau evaporator tertutup kotoran', u: 2 },
    { s: 'Tercium bau menyengat di ruang mesin', c: 'Kebocoran refrigeran pada pipa atau sambungan', u: 3, tip: 'Jauhi area mesin, buka ventilasi, dan jangan menyalakan api di sekitarnya.' },
    { s: 'Agitator atau pompa brine mati', c: 'Motor, v-belt, atau kelistrikan pompa rusak', u: 3 },
  ],
  'cold-storage': [
    { s: 'Suhu ruang naik dan tidak kembali turun', c: 'Unit kondensor bermasalah atau refrigeran kurang', u: 3, tip: 'Kurangi buka-tutup pintu dan siapkan ruang cadangan kalau suhu terus naik.' },
    { s: 'Evaporator tertutup bunga es tebal', c: 'Sistem defrost tidak bekerja: heater, timer, atau sensornya', u: 3 },
    { s: 'Pintu berembun atau karetnya rusak', c: 'Karet pintu (gasket) aus atau heater kusen pintu mati', u: 2 },
    { s: 'Ada genangan air atau es di lantai', c: 'Saluran pembuangan (drain) beku atau tersumbat', u: 2 },
    { s: 'Unit kondensor sering trip', c: 'Beban berlebih, tekanan tidak normal, atau masalah kelistrikan', u: 3 },
    { s: 'Kipas evaporator berbunyi atau mati', c: 'Motor kipas rusak atau terhalang es', u: 2 },
  ],
};

// Interval servis yang disarankan, dalam hari.
export const intervals = {
  ac: { ringan: 90, berat: 30 },
  chiller: { ringan: 90, berat: 30 },
  ice: { ringan: 60, berat: 30 },
  'cold-storage': { ringan: 60, berat: 30 },
};
