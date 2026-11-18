<?php

namespace App\Services\Spk;

/**
 * Perhitungan peringkat metode TOPSIS, mengikuti sheet "4 TOPSIS".
 *
 * Tahap 8 : matriks ternormalisasi R, r_ij = x_ij / sqrt(sum x_ij^2)
 * Tahap 9 : matriks terbobot Y, y_ij = w_j * r_ij
 * Tahap 10: solusi ideal A+ dan A- (benefit: max/min, cost: min/max)
 * Tahap 11: jarak D+ dan D- (Euclidean)
 * Tahap 12: nilai preferensi Vi = D- / (D+ + D-)
 * Tahap 13: perangkingan (Vi terbesar = peringkat 1)
 */
class TopsisCalculator
{
    /**
     * @param  list<list<float>>  $values  nilai alternatif x kriteria
     * @param  list<float>  $weights
     * @param  list<string>  $types  'benefit' | 'cost' per kriteria
     * @return array{
     *     divisors: list<float>,
     *     normalized: list<list<float>>,
     *     weighted: list<list<float>>,
     *     ideal_positive: list<float>,
     *     ideal_negative: list<float>,
     *     distance_positive: list<float>,
     *     distance_negative: list<float>,
     *     preferences: list<float>,
     *     ranks: list<int>
     * }
     */
    public function calculate(array $values, array $weights, array $types): array
    {
        $n = count($weights);

        $divisors = [];
        for ($j = 0; $j < $n; $j++) {
            $sumSquares = 0.0;
            foreach ($values as $row) {
                $sumSquares += $row[$j] ** 2;
            }
            $divisors[] = sqrt($sumSquares);
        }

        $normalized = [];
        $weighted = [];
        foreach ($values as $row) {
            $normalizedRow = [];
            $weightedRow = [];
            for ($j = 0; $j < $n; $j++) {
                $value = $divisors[$j] > 0 ? $row[$j] / $divisors[$j] : 0.0;
                $normalizedRow[] = $value;
                $weightedRow[] = $value * $weights[$j];
            }
            $normalized[] = $normalizedRow;
            $weighted[] = $weightedRow;
        }

        $idealPositive = [];
        $idealNegative = [];
        for ($j = 0; $j < $n; $j++) {
            $column = array_column($weighted, $j);
            $isCost = ($types[$j] ?? 'benefit') === 'cost';
            $highest = $column === [] ? 0.0 : max($column);
            $lowest = $column === [] ? 0.0 : min($column);

            $idealPositive[] = $isCost ? $lowest : $highest;
            $idealNegative[] = $isCost ? $highest : $lowest;
        }

        $distancePositive = [];
        $distanceNegative = [];
        $preferences = [];
        foreach ($weighted as $row) {
            $plus = 0.0;
            $minus = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $plus += ($row[$j] - $idealPositive[$j]) ** 2;
                $minus += ($row[$j] - $idealNegative[$j]) ** 2;
            }
            $toPositive = sqrt($plus);
            $toNegative = sqrt($minus);
            $total = $toPositive + $toNegative;

            $distancePositive[] = $toPositive;
            $distanceNegative[] = $toNegative;
            $preferences[] = $total > 0 ? $toNegative / $total : 0.0;
        }

        // Sama seperti RANK(...,0) di Excel: nilai sama mendapat peringkat sama.
        $ranks = [];
        foreach ($preferences as $value) {
            $ranks[] = 1 + count(array_filter($preferences, fn (float $other) => $other > $value));
        }

        return [
            'divisors' => $divisors,
            'normalized' => $normalized,
            'weighted' => $weighted,
            'ideal_positive' => $idealPositive,
            'ideal_negative' => $idealNegative,
            'distance_positive' => $distancePositive,
            'distance_negative' => $distanceNegative,
            'preferences' => $preferences,
            'ranks' => $ranks,
        ];
    }
}
