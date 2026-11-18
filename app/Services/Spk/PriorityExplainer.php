<?php

namespace App\Services\Spk;

use App\Models\FloodEvent;

/**
 * Menyusun penjelasan deskriptif mengapa suatu daerah mendapat prioritas tertentu,
 * murni dari data: kriteria dengan nilai terbobot (y = W x r) terbesar dan
 * penyebab kejadian yang tercatat di DIBI BNPB.
 */
class PriorityExplainer
{
    /**
     * Banyak kriteria pendorong utama yang disebut dalam kalimat.
     */
    private const DRIVER_COUNT = 2;

    /**
     * @param  list<array{code: string, name: string, phrase?: string, decimals?: int}>  $criteria
     * @param  list<float>  $values  nilai kriteria daerah ini
     * @param  list<float>  $weighted  nilai terbobot y daerah ini
     * @param  list<string>  $missing  kode kriteria yang datanya kosong
     * @param  list<list<float>>  $allValues  nilai kriteria semua daerah (baris = daerah)
     * @return array{explanation: string, drivers: list<array{code: string, name: string, text: string, position: int, total: int, share: float}>}
     */
    public function explain(array $criteria, array $values, array $weighted, array $missing, array $allValues): array
    {
        $total = count($allValues);
        $sumWeighted = array_sum($weighted);

        $order = array_keys($weighted);
        usort($order, fn (int $a, int $b) => $weighted[$b] <=> $weighted[$a]);

        $drivers = [];
        foreach ($order as $index) {
            $criterion = $criteria[$index];

            if ($weighted[$index] <= 0 || in_array($criterion['code'], $missing, true)) {
                continue;
            }

            $position = 1 + count(array_filter(
                array_column($allValues, $index),
                fn (float $other) => $other > $values[$index] + 1e-9,
            ));

            $drivers[] = [
                'code' => $criterion['code'],
                'name' => $criterion['name'],
                'text' => str_replace(':value', $this->formatNumber($values[$index], $criterion['decimals'] ?? 0), $criterion['phrase'] ?? $criterion['name'].' :value'),
                'position' => $position,
                'total' => $total,
                'share' => $sumWeighted > 0 ? $weighted[$index] / $sumWeighted : 0.0,
            ];

            if (count($drivers) === self::DRIVER_COUNT) {
                break;
            }
        }

        if ($drivers === []) {
            return [
                'explanation' => 'Seluruh nilai kriteria daerah ini paling rendah dibanding daerah lain pada tahun yang sama.',
                'drivers' => [],
            ];
        }

        $parts = array_map(
            fn (array $driver) => "{$driver['text']} ({$this->positionText($driver['position'], $driver['total'])})",
            $drivers,
        );

        return [
            'explanation' => 'Skor terutama dipengaruhi oleh '.implode(' dan ', $parts).'.',
            'drivers' => $drivers,
        ];
    }

    /**
     * Penyebab kejadian yang tercatat di DIBI BNPB per kabupaten/kota pada satu tahun,
     * dikelompokkan (huruf besar/kecil diabaikan) dan diurutkan dari yang paling sering.
     *
     * @return array<string, list<array{text: string, count: int}>>
     */
    public function causesByRegion(int $year, int $limit = 3): array
    {
        $grouped = [];

        FloodEvent::query()
            ->where('tahun', $year)
            ->whereNotNull('penyebab')
            ->get(['kabupaten', 'penyebab'])
            ->each(function (FloodEvent $event) use (&$grouped) {
                $key = mb_strtolower(rtrim((string) $event->penyebab, ". \t"));
                $grouped[$event->kabupaten][$key] ??= ['text' => rtrim((string) $event->penyebab, ". \t"), 'count' => 0];
                $grouped[$event->kabupaten][$key]['count']++;
            });

        return array_map(function (array $causes) use ($limit) {
            $causes = array_values($causes);
            usort($causes, fn (array $a, array $b) => $b['count'] <=> $a['count'] ?: strcmp($a['text'], $b['text']));

            return array_slice($causes, 0, $limit);
        }, $grouped);
    }

    private function positionText(int $position, int $total): string
    {
        return $position === 1
            ? "tertinggi dari {$total} daerah"
            : "urutan ke-{$position} dari {$total} daerah";
    }

    private function formatNumber(float $value, int $decimals): string
    {
        $formatted = number_format($value, $decimals, ',', '.');

        return $decimals > 0 ? rtrim(rtrim($formatted, '0'), ',') : $formatted;
    }
}
