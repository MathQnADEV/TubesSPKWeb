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
        $m = count($values);
        $n = count($weights);

        $divisors = [];
        for ($j = 0; $j < $n; $j++) {
            $sumSquares = 0.0;
            foreach ($values as $row) {
                $sumSquares += $row[$j] ** 2;
            }
            $divisors[$j] = sqrt($sumSquares);
        }

        $normalized = [];
        $weighted = [];
        foreach ($values as $i => $row) {
            for ($j = 0; $j < $n; $j++) {
                $normalized[$i][$j] = $divisors[$j] > 0 ? $row[$j] / $divisors[$j] : 0.0;
                $weighted[$i][$j] = $normalized[$i][$j] * $weights[$j];
            }
        }

        $idealPositive = [];
        $idealNegative = [];
        for ($j = 0; $j < $n; $j++) {
            $column = $m > 0 ? array_column($weighted, $j) : [0.0];
            $isCost = ($types[$j] ?? 'benefit') === 'cost';
            $idealPositive[$j] = $isCost ? min($column) : max($column);
            $idealNegative[$j] = $isCost ? max($column) : min($column);
        }

        $distancePositive = [];
        $distanceNegative = [];
        $preferences = [];
        foreach ($weighted as $i => $row) {
            $plus = 0.0;
            $minus = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $plus += ($row[$j] - $idealPositive[$j]) ** 2;
                $minus += ($row[$j] - $idealNegative[$j]) ** 2;
            }
            $distancePositive[$i] = sqrt($plus);
            $distanceNegative[$i] = sqrt($minus);
            $total = $distancePositive[$i] + $distanceNegative[$i];
            $preferences[$i] = $total > 0 ? $distanceNegative[$i] / $total : 0.0;
        }

        // Sama seperti RANK(...,0) di Excel: nilai sama mendapat peringkat sama.
        $ranks = [];
        foreach ($preferences as $i => $value) {
            $ranks[$i] = 1 + count(array_filter($preferences, fn (float $other) => $other > $value));
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
