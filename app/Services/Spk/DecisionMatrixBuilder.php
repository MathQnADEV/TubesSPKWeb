<?php

namespace App\Services\Spk;

use App\Models\FloodEvent;

/**
 * Menyusun matriks keputusan per kabupaten/kota untuk satu tahun,
 * sama dengan rumus sheet "2 Matriks Keputusan":
 *
 * C1 = COUNTIFS  (jumlah kejadian)
 * C2 = SUMIFS    (rumah terendam)
 * C3 = SUMIFS    (fasum rusak)
 * C4 = AVERAGEIFS(curah hujan, sel kosong diabaikan)
 * C5 = AVERAGEIFS(jumlah penduduk 2025)
 */
class DecisionMatrixBuilder
{
    /**
     * @return list<int>
     */
    public function availableYears(): array
    {
        return FloodEvent::query()
            ->distinct()
            ->orderByDesc('tahun')
            ->pluck('tahun')
            ->map(fn ($year) => (int) $year)
            ->values()
            ->all();
    }

    /**
     * @return list<array{name: string, values: list<float>, missing: list<string>}>
     */
    public function build(int $year): array
    {
        $rows = FloodEvent::query()
            ->where('tahun', $year)
            ->groupBy('kabupaten')
            ->selectRaw('kabupaten')
            ->selectRaw('COUNT(*) as c1')
            ->selectRaw('COALESCE(SUM(rumah_terendam), 0) as c2')
            ->selectRaw('COALESCE(SUM(fasum_rusak), 0) as c3')
            ->selectRaw('AVG(curah_hujan_mm) as c4')
            ->selectRaw('AVG(jumlah_penduduk_ribu) as c5')
            ->toBase()
            ->get();

        $alternatives = $rows->map(function (object $row) {
            $missing = [];

            if ($row->c4 === null) {
                $missing[] = 'C4';
            }

            if ($row->c5 === null) {
                $missing[] = 'C5';
            }

            return [
                'name' => (string) $row->kabupaten,
                'values' => [
                    (float) $row->c1,
                    (float) $row->c2,
                    (float) $row->c3,
                    (float) ($row->c4 ?? 0),
                    (float) ($row->c5 ?? 0),
                ],
                'missing' => $missing,
            ];
        })->all();

        usort($alternatives, fn (array $a, array $b) => strcmp($a['name'], $b['name']));

        return $alternatives;
    }
}
