<?php

namespace App\Services\Spk;

use InvalidArgumentException;

/**
 * Perhitungan bobot kriteria metode AHP (Saaty), mengikuti sheet "3 AHP".
 *
 * Tahap 3: matriks perbandingan berpasangan
 * Tahap 4: normalisasi (setiap sel dibagi jumlah kolom)
 * Tahap 5: bobot W = rata-rata baris matriks ternormalisasi
 * Tahap 6: consistency index  CI = (t - n) / (n - 1), t = rata-rata (A.wT)/w
 * Tahap 7: consistency ratio  CR = CI / RI
 */
class AhpCalculator
{
    /**
     * @param  array<int, float>  $randomIndex  RI per n
     */
    public function __construct(
        private readonly array $randomIndex,
        private readonly float $consistencyThreshold = 0.1,
    ) {}

    public static function fromConfig(): self
    {
        return new self(config('spk.random_index'), (float) config('spk.consistency_threshold'));
    }

    /**
     * Bangun matriks resiprokal penuh dari segitiga atas ("i-j" => nilai, 1-based).
     *
     * @param  array<string, float|int>  $upperTriangle
     * @return list<list<float>>
     */
    public function buildMatrix(array $upperTriangle, int $n): array
    {
        $matrix = [];

        for ($i = 0; $i < $n; $i++) {
            $row = [];

            for ($j = 0; $j < $n; $j++) {
                if ($i === $j) {
                    $row[] = 1.0;
                } elseif ($i < $j) {
                    $key = ($i + 1).'-'.($j + 1);

                    if (! isset($upperTriangle[$key]) || (float) $upperTriangle[$key] <= 0) {
                        throw new InvalidArgumentException("Nilai perbandingan {$key} tidak valid.");
                    }

                    $row[] = (float) $upperTriangle[$key];
                } else {
                    $key = ($j + 1).'-'.($i + 1);
                    $row[] = 1 / (float) $upperTriangle[$key];
                }
            }

            $matrix[] = $row;
        }

        return $matrix;
    }

    /**
     * @param  list<list<float>>  $matrix
     * @return array{
     *     matrix: list<list<float>>,
     *     column_sums: list<float>,
     *     normalized: list<list<float>>,
     *     row_sums: list<float>,
     *     weights: list<float>,
     *     weighted_sums: list<float>,
     *     ratios: list<float>,
     *     n: int,
     *     lambda_max: float,
     *     ci: float,
     *     ri: float,
     *     cr: float,
     *     consistent: bool
     * }
     */
    public function calculate(array $matrix): array
    {
        $n = count($matrix);

        $columnSums = [];
        for ($j = 0; $j < $n; $j++) {
            $sum = 0.0;
            foreach ($matrix as $row) {
                $sum += $row[$j];
            }
            $columnSums[] = $sum;
        }

        $normalized = [];
        $rowSums = [];
        $weights = [];
        foreach ($matrix as $row) {
            $normalizedRow = [];
            $rowSum = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $value = $row[$j] / $columnSums[$j];
                $normalizedRow[] = $value;
                $rowSum += $value;
            }

            $normalized[] = $normalizedRow;
            $rowSums[] = $rowSum;
            $weights[] = $rowSum / $n;
        }

        $weightedSums = [];
        $ratios = [];
        foreach ($matrix as $i => $row) {
            $sum = 0.0;
            for ($j = 0; $j < $n; $j++) {
                $sum += $row[$j] * $weights[$j];
            }
            $weightedSums[] = $sum;
            $ratios[] = $sum / $weights[$i];
        }

        $lambdaMax = array_sum($ratios) / $n;
        $ci = $n > 1 ? ($lambdaMax - $n) / ($n - 1) : 0.0;
        $ri = (float) ($this->randomIndex[$n] ?? 0.0);
        $cr = $ri > 0 ? $ci / $ri : 0.0;

        return [
            'matrix' => $matrix,
            'column_sums' => $columnSums,
            'normalized' => $normalized,
            'row_sums' => $rowSums,
            'weights' => $weights,
            'weighted_sums' => $weightedSums,
            'ratios' => $ratios,
            'n' => $n,
            'lambda_max' => $lambdaMax,
            'ci' => $ci,
            'ri' => $ri,
            'cr' => $cr,
            'consistent' => $cr <= $this->consistencyThreshold,
        ];
    }
}
