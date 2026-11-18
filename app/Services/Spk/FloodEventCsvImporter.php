<?php

namespace App\Services\Spk;

use App\Models\FloodEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Mengimpor data kejadian banjir (format CSV BNPB/DIBI) ke tabel flood_events.
 *
 * Kolom yang dibaca (berdasarkan nama header, urutan bebas):
 * Tanggal Kejadian, Tahun, Kabupaten, Lokasi, Meninggal, Hilang, Terluka,
 * Rumah Rusak, Rumah Terendam, Fasum Rusak, Curah_Hujan_mm,
 * Jumlah_Penduduk_2025_Ribu_Jiwa.
 */
class FloodEventCsvImporter
{
    /**
     * Pemetaan kolom tabel => kata kunci header CSV (huruf kecil, tanpa spasi/underscore).
     *
     * @var array<string, list<string>>
     */
    private const COLUMN_KEYWORDS = [
        'kode_identitas' => ['kodeidentitas'],
        'tanggal_kejadian' => ['tanggalkejadian', 'tanggal'],
        'tahun' => ['tahun'],
        'kabupaten' => ['kabupaten', 'kabkota', 'daerah'],
        'lokasi' => ['lokasi'],
        'penyebab' => ['penyebab'],
        'meninggal' => ['meninggal'],
        'hilang' => ['hilang'],
        'terluka' => ['terluka'],
        'rumah_rusak' => ['rumahrusak'],
        'rumah_terendam' => ['rumahterendam', 'terendam'],
        'fasum_rusak' => ['fasumrusak', 'fasum'],
        'curah_hujan_mm' => ['curahhujan'],
        'jumlah_penduduk_ribu' => ['jumlahpenduduk', 'penduduk'],
    ];

    public function __construct(private readonly DataEntryPeriod $period) {}

    /**
     * Gabungkan isi CSV ke data yang ada, hanya untuk tahun yang masih terbuka.
     *
     * Baris dicocokkan lewat Kode Identitas Bencana bila ada, selain itu lewat
     * (tahun, tanggal, kabupaten, lokasi). Baris yang cocok diperbarui, sisanya
     * ditambahkan. Baris tahun terkunci dan bertanggal di masa depan dilewati.
     *
     * @return array{inserted: int, updated: int, locked: int, locked_years: list<int>, future: int}
     */
    public function mergeFrom(string $path): array
    {
        $rows = $this->parse($path);
        $today = now()->toDateString();
        $summary = ['inserted' => 0, 'updated' => 0, 'locked' => 0, 'locked_years' => [], 'future' => 0];

        DB::transaction(function () use ($rows, $today, &$summary) {
            foreach ($rows as $row) {
                if (! $this->period->isEditable($row['tahun'])) {
                    $summary['locked']++;
                    $summary['locked_years'][$row['tahun']] = $row['tahun'];

                    continue;
                }

                if ($row['tanggal_kejadian'] !== null && $row['tanggal_kejadian'] > $today) {
                    $summary['future']++;

                    continue;
                }

                $existing = $this->findMatching($row);

                if ($existing === null) {
                    FloodEvent::query()->insert($row);
                    $summary['inserted']++;
                } else {
                    $existing->update(collect($row)->except(['created_at', 'updated_at'])->all());
                    $summary['updated']++;
                }
            }
        });

        $summary['locked_years'] = array_values($summary['locked_years']);
        sort($summary['locked_years']);

        return $summary;
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function findMatching(array $row): ?FloodEvent
    {
        $query = FloodEvent::query()->where('tahun', $row['tahun']);

        if ($row['kode_identitas'] !== null) {
            return $query->where('kode_identitas', $row['kode_identitas'])->first();
        }

        $query->where('kabupaten', $row['kabupaten']);

        $row['tanggal_kejadian'] === null
            ? $query->whereNull('tanggal_kejadian')
            : $query->whereDate('tanggal_kejadian', $row['tanggal_kejadian']);

        $row['lokasi'] === null
            ? $query->whereNull('lokasi')
            : $query->where('lokasi', $row['lokasi']);

        return $query->first();
    }

    /**
     * Ganti seluruh isi tabel dengan isi file CSV. Mengembalikan jumlah baris.
     */
    public function replaceAllFrom(string $path): int
    {
        $rows = $this->parse($path);

        DB::transaction(function () use ($rows) {
            FloodEvent::query()->delete();

            foreach (array_chunk($rows, 200) as $chunk) {
                FloodEvent::query()->insert($chunk);
            }
        });

        return count($rows);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function parse(string $path): array
    {
        $handle = @fopen($path, 'r');

        if ($handle === false) {
            throw new InvalidArgumentException("File CSV tidak dapat dibaca: {$path}");
        }

        $header = fgetcsv($handle, escape: '\\');

        if (! is_array($header)) {
            fclose($handle);
            throw new InvalidArgumentException('File CSV kosong.');
        }

        $columnIndex = $this->mapHeader($header);

        foreach (['tahun', 'kabupaten'] as $required) {
            if (! isset($columnIndex[$required])) {
                fclose($handle);
                throw new InvalidArgumentException("Kolom wajib \"{$required}\" tidak ditemukan pada header CSV.");
            }
        }

        $now = now();
        $rows = [];

        while (($line = fgetcsv($handle, escape: '\\')) !== false) {
            if ($line === [null] || trim(implode('', array_map('strval', $line))) === '') {
                continue;
            }

            $value = fn (string $column): ?string => isset($columnIndex[$column])
                ? $this->clean($line[$columnIndex[$column]] ?? null)
                : null;

            $kabupaten = $value('kabupaten');
            $tahun = $this->toInt($value('tahun'));

            if ($kabupaten === null || $tahun === null) {
                continue;
            }

            $rows[] = [
                'kode_identitas' => $value('kode_identitas'),
                'tanggal_kejadian' => $this->toDate($value('tanggal_kejadian')),
                'tahun' => $tahun,
                'kabupaten' => $kabupaten,
                'lokasi' => $value('lokasi'),
                'penyebab' => $this->cleanCause($value('penyebab')),
                'meninggal' => $this->toInt($value('meninggal')),
                'hilang' => $this->toInt($value('hilang')),
                'terluka' => $this->toInt($value('terluka')),
                'rumah_rusak' => $this->toInt($value('rumah_rusak')),
                'rumah_terendam' => $this->toInt($value('rumah_terendam')),
                'fasum_rusak' => $this->toInt($value('fasum_rusak')),
                'curah_hujan_mm' => $this->toFloat($value('curah_hujan_mm')),
                'jumlah_penduduk_ribu' => $this->toFloat($value('jumlah_penduduk_ribu'))
                    ?? $this->bpsPopulation($kabupaten),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        fclose($handle);

        if ($rows === []) {
            throw new InvalidArgumentException('Tidak ada baris data kejadian banjir yang valid pada file.');
        }

        return $rows;
    }

    /**
     * @param  array<int, string|null>  $header
     * @return array<string, int>
     */
    private function mapHeader(array $header): array
    {
        $normalized = array_map(
            fn ($name) => preg_replace('/[^a-z0-9]/', '', strtolower((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $name))),
            $header,
        );

        $map = [];

        foreach (self::COLUMN_KEYWORDS as $column => $keywords) {
            foreach ($keywords as $keyword) {
                foreach ($normalized as $index => $name) {
                    if (in_array($index, $map, true)) {
                        continue;
                    }

                    if ($name !== '' && str_starts_with($name, $keyword)) {
                        $map[$column] = $index;

                        continue 3;
                    }
                }
            }
        }

        return $map;
    }

    /**
     * Jumlah penduduk 2025 (ribu jiwa) menurut BPS untuk kabupaten/kota.
     */
    public function bpsPopulation(string $kabupaten): ?float
    {
        $population = config('spk.population')[$kabupaten] ?? null;

        return $population === null ? null : (float) $population;
    }

    /**
     * Rapikan teks penyebab DIBI: buang penanda butir (●, -, *) dan spasi berlebih.
     */
    private function cleanCause(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) preg_replace(['/^[\s\x{25CF}\x{2022}*\-]+/u', '/\s+/u'], ['', ' '], $value));

        return $value === '' ? null : $value;
    }

    private function clean(?string $value): ?string
    {
        $value = $value === null ? null : trim($value);

        return $value === '' ? null : $value;
    }

    private function toInt(?string $value): ?int
    {
        $float = $this->toFloat($value);

        return $float === null ? null : (int) round($float);
    }

    private function toFloat(?string $value): ?float
    {
        if ($value === null) {
            return null;
        }

        $value = str_replace(',', '.', $value);

        return is_numeric($value) ? (float) $value : null;
    }

    private function toDate(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        foreach (['n/j/Y', 'Y-m-d', 'd/m/Y', 'd-m-Y'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $value);

                if ($date !== null && $date->format($format) === $value) {
                    return $date->toDateString();
                }
            } catch (\Throwable) {
                // coba format berikutnya
            }
        }

        return null;
    }
}
