<?php

/*
|--------------------------------------------------------------------------
| Konfigurasi SPK Prioritas Mitigasi Banjir (AHP-TOPSIS)
|--------------------------------------------------------------------------
|
| Semua nilai bawaan di sini disamakan dengan file
| Perhitungan_AHP_TOPSIS_Banjir_2025.xlsx agar hasil aplikasi identik
| dengan perhitungan manual di Excel.
|
*/

return [

    'default_year' => 2025,

    'default_csv' => database_path('data/banjir_sulawesi_selatan_event.csv'),

    /*
     | Periode input data. Tahun <= locked_through_year sudah final (terkunci).
     | Tahun berikutnya boleh diisi sejak 1 Januari tahun itu sampai
     | grace_months bulan setelah tahun berakhir (2026 -> s/d 31 Maret 2027).
     */
    'data_entry' => [
        'locked_through_year' => 2025,
        'grace_months' => 3,
    ],

    /*
     | NASA POWER (curah hujan harian terkoreksi, mm/hari) di titik pusat
     | kabupaten/kota. Sumber yang sama dengan kolom Curah_Hujan_mm pada CSV.
     */
    'nasa_power' => [
        'url' => 'https://power.larc.nasa.gov/api/temporal/daily/point',
        'parameter' => 'PRECTOTCORR',
        'community' => 'AG',
        'timeout' => 20,
    ],

    /*
     | Jumlah penduduk 2025 (ribu jiwa) menurut BPS, dipakai untuk kriteria C5
     | dan untuk mengisi otomatis input manual / CSV yang kolom penduduknya kosong.
     */
    'population' => [
        'Kabupaten Bantaeng' => 207.7,
        'Kabupaten Barru' => 190.5,
        'Kabupaten Bone' => 837.1,
        'Kabupaten Bulukumba' => 459.0,
        'Kabupaten Enrekang' => 241.7,
        'Kabupaten Gowa' => 827.0,
        'Kabupaten Jeneponto' => 423.4,
        'Kabupaten Kepulauan Selayar' => 144.2,
        'Kabupaten Luwu' => 389.3,
        'Kabupaten Luwu Timur' => 316.9,
        'Kabupaten Luwu Utara' => 341.5,
        'Kabupaten Maros' => 419.2,
        'Kabupaten Pangkajene dan Kepulauan' => 362.7,
        'Kabupaten Pinrang' => 429.9,
        'Kabupaten Sidenreng Rappang' => 333.5,
        'Kabupaten Sinjai' => 273.3,
        'Kabupaten Soppeng' => 240.4,
        'Kabupaten Takalar' => 321.1,
        'Kabupaten Tana Toraja' => 295.4,
        'Kabupaten Toraja Utara' => 282.2,
        'Kabupaten Wajo' => 391.5,
        'Kota Makassar' => 1473.9,
        'Kota Palopo' => 198.5,
        'Kota Parepare' => 163.4,
    ],

    /*
     | Kriteria. Semua kriteria bertipe benefit (semakin besar semakin
     | diprioritaskan), sesuai baris "Benefit" pada sheet Matriks Keputusan.
     | "phrase" dipakai untuk kalimat alasan prioritas (:value = nilai kriteria),
     | "decimals" = jumlah desimal saat nilai ditampilkan.
     */
    'criteria' => [
        ['code' => 'C1', 'name' => 'Frekuensi kejadian', 'unit' => 'kali', 'type' => 'benefit', 'phrase' => ':value kali kejadian banjir', 'decimals' => 0],
        ['code' => 'C2', 'name' => 'Rumah terendam', 'unit' => 'unit', 'type' => 'benefit', 'phrase' => ':value rumah terendam', 'decimals' => 0],
        ['code' => 'C3', 'name' => 'Fasum rusak', 'unit' => 'unit', 'type' => 'benefit', 'phrase' => ':value fasilitas umum rusak', 'decimals' => 0],
        ['code' => 'C4', 'name' => 'Rata-rata curah hujan', 'unit' => 'mm', 'type' => 'benefit', 'phrase' => 'rata-rata curah hujan :value mm/hari', 'decimals' => 2],
        ['code' => 'C5', 'name' => 'Jumlah penduduk 2025', 'unit' => 'ribu jiwa', 'type' => 'benefit', 'phrase' => 'jumlah penduduk :value ribu jiwa', 'decimals' => 1],
    ],

    /*
     | Matriks perbandingan berpasangan AHP (segitiga atas, urut baris).
     | Kunci "i-j" berarti kriteria ke-i dibanding kriteria ke-j.
     | Acuan: Perka BNPB 2/2012 (risiko = bahaya x keterpaparan), skala Saaty.
     */
    'pairwise' => [
        '1-2' => 3, '1-3' => 7, '1-4' => 5, '1-5' => 3,
        '2-3' => 5, '2-4' => 3, '2-5' => 1,
        '3-4' => 1 / 3, '3-5' => 1 / 5,
        '4-5' => 1 / 3,
    ],

    /*
     | Random Index (Saaty) untuk n = 1..10.
     */
    'random_index' => [1 => 0.0, 2 => 0.0, 3 => 0.58, 4 => 0.90, 5 => 1.12, 6 => 1.24, 7 => 1.32, 8 => 1.41, 9 => 1.45, 10 => 1.49],

    'consistency_threshold' => 0.1,

    /*
     | Kategori prioritas berdasarkan nilai preferensi Vi.
     */
    'categories' => [
        ['label' => 'Tinggi', 'min' => 0.67],
        ['label' => 'Sedang', 'min' => 0.34],
        ['label' => 'Rendah', 'min' => 0.0],
    ],

    /*
     | Koordinat (titik pusat) tiap kabupaten/kota, untuk peta dan NASA POWER.
     */
    'regions' => [
        'Kabupaten Luwu Utara' => [-2.5586, 120.3236],
        'Kota Makassar' => [-5.1477, 119.4327],
        'Kabupaten Maros' => [-5.0067, 119.5724],
        'Kabupaten Wajo' => [-4.1264, 120.0319],
        'Kabupaten Gowa' => [-5.2072, 119.4431],
        'Kabupaten Bone' => [-4.5386, 120.3279],
        'Kabupaten Luwu' => [-3.2768, 120.2584],
        'Kabupaten Pangkajene dan Kepulauan' => [-4.8385, 119.5512],
        'Kabupaten Sidenreng Rappang' => [-3.9261, 119.7963],
        'Kabupaten Pinrang' => [-3.7885, 119.6521],
        'Kabupaten Barru' => [-4.4094, 119.6225],
        'Kabupaten Luwu Timur' => [-2.5671, 121.0894],
        'Kabupaten Takalar' => [-5.4144, 119.4475],
        'Kabupaten Soppeng' => [-4.3489, 119.8869],
        'Kabupaten Bulukumba' => [-5.5539, 120.1932],
        'Kota Palopo' => [-2.9926, 120.1969],
        'Kabupaten Sinjai' => [-5.1241, 120.2531],
        'Kota Parepare' => [-4.0135, 119.6255],
        'Kabupaten Bantaeng' => [-5.5458, 119.9472],
        'Kabupaten Jeneponto' => [-5.6761, 119.7325],
        'Kabupaten Toraja Utara' => [-2.9631, 119.9015],
        'Kabupaten Tana Toraja' => [-3.0819, 119.8552],
        'Kabupaten Enrekang' => [-3.5644, 119.7747],
        'Kabupaten Kepulauan Selayar' => [-6.1181, 120.4608],
    ],

];
