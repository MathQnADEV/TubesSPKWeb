<?php

namespace App\Services\Spk;

/**
 * Menjalankan alur lengkap SPK: matriks keputusan -> bobot AHP -> peringkat TOPSIS.
 */
class FloodPriorityAnalysis
{
    public function __construct(
        private readonly DecisionMatrixBuilder $matrixBuilder,
        private readonly TopsisCalculator $topsis,
        private readonly PriorityExplainer $explainer,
    ) {}

    /**
     * @param  array<string, float|int>|null  $pairwise  segitiga atas AHP; null = bawaan config
     * @return array<string, mixed>
     */
    public function run(int $year, ?array $pairwise = null): array
    {
        /** @var list<array{code: string, name: string, unit: string, type: string}> $criteria */
        $criteria = config('spk.criteria');
        $pairwise ??= config('spk.pairwise');

        $ahpCalculator = AhpCalculator::fromConfig();
        $ahp = $ahpCalculator->calculate($ahpCalculator->buildMatrix($pairwise, count($criteria)));

        $alternatives = $this->matrixBuilder->build($year);
        $values = array_column($alternatives, 'values');

        $topsis = $this->topsis->calculate($values, $ahp['weights'], array_column($criteria, 'type'));

        /** @var array<string, array{0: float, 1: float}> $regions */
        $regions = config('spk.regions');
        $causes = $this->explainer->causesByRegion($year);

        $results = [];
        foreach ($alternatives as $i => $alternative) {
            $region = $regions[$alternative['name']] ?? null;
            $preference = $topsis['preferences'][$i];
            $reason = $this->explainer->explain(
                $criteria,
                $alternative['values'],
                $topsis['weighted'][$i],
                $alternative['missing'],
                $values,
            );

            $results[] = [
                'name' => $alternative['name'],
                'values' => $alternative['values'],
                'missing' => $alternative['missing'],
                'normalized' => $topsis['normalized'][$i],
                'weighted' => $topsis['weighted'][$i],
                'distance_positive' => $topsis['distance_positive'][$i],
                'distance_negative' => $topsis['distance_negative'][$i],
                'preference' => $preference,
                'rank' => $topsis['ranks'][$i],
                'category' => $this->categorize($preference),
                'lat' => $region[0] ?? null,
                'lng' => $region[1] ?? null,
                'explanation' => $reason['explanation'],
                'drivers' => $reason['drivers'],
                'causes' => $causes[$alternative['name']] ?? [],
            ];
        }

        $ranking = $results;
        usort($ranking, fn (array $a, array $b) => $a['rank'] <=> $b['rank'] ?: strcmp($a['name'], $b['name']));

        return [
            'year' => $year,
            'criteria' => $criteria,
            'pairwise' => $pairwise,
            'ahp' => $ahp,
            'topsis' => [
                'divisors' => $topsis['divisors'],
                'ideal_positive' => $topsis['ideal_positive'],
                'ideal_negative' => $topsis['ideal_negative'],
            ],
            'alternatives' => $results,
            'ranking' => array_column($ranking, 'name'),
            'categories' => config('spk.categories'),
        ];
    }

    public function categorize(float $preference): string
    {
        foreach (config('spk.categories') as $category) {
            if ($preference >= $category['min']) {
                return $category['label'];
            }
        }

        return 'Rendah';
    }
}
