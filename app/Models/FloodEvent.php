<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Satu baris kejadian banjir dari data BNPB (DIBI) Sulawesi Selatan.
 *
 * @property int $id
 * @property string|null $kode_identitas
 * @property Carbon|null $tanggal_kejadian
 * @property int $tahun
 * @property string $kabupaten
 * @property string|null $lokasi
 * @property string|null $penyebab
 * @property int|null $meninggal
 * @property int|null $hilang
 * @property int|null $terluka
 * @property int|null $rumah_rusak
 * @property int|null $rumah_terendam
 * @property int|null $fasum_rusak
 * @property float|null $curah_hujan_mm
 * @property float|null $jumlah_penduduk_ribu
 */
#[Fillable([
    'kode_identitas', 'tanggal_kejadian', 'tahun', 'kabupaten', 'lokasi', 'penyebab',
    'meninggal', 'hilang', 'terluka', 'rumah_rusak', 'rumah_terendam',
    'fasum_rusak', 'curah_hujan_mm', 'jumlah_penduduk_ribu',
])]
class FloodEvent extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tanggal_kejadian' => 'date',
            'tahun' => 'integer',
            'curah_hujan_mm' => 'float',
            'jumlah_penduduk_ribu' => 'float',
        ];
    }
}
