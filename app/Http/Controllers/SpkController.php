<?php

namespace App\Http\Controllers;

use App\Models\FloodEvent;
use App\Services\Spk\DataEntryPeriod;
use App\Services\Spk\DecisionMatrixBuilder;
use App\Services\Spk\FloodEventCsvImporter;
use App\Services\Spk\FloodPriorityAnalysis;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SpkController extends Controller
{
    /**
     * Nilai skala Saaty yang boleh dipilih (1/9 .. 9).
     *
     * @var list<string>
     */
    private const SAATY_SCALE = ['1/9', '1/8', '1/7', '1/6', '1/5', '1/4', '1/3', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    public function __construct(
        private readonly FloodPriorityAnalysis $analysis,
        private readonly DecisionMatrixBuilder $matrixBuilder,
        private readonly DataEntryPeriod $period,
    ) {}

    /**
     * Dashboard utama: peta + perankingan prioritas mitigasi.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('spk/index', [
            ...$this->payload($request),
            'lockedThroughYear' => $this->period->lockedThroughYear(),
        ]);
    }

    /**
     * Halaman input data: unggah CSV (gabung), input manual, dan daftar kejadian.
     */
    public function data(Request $request): Response
    {
        $editableYears = $this->period->editableYears();
        $years = collect([...$editableYears, ...$this->matrixBuilder->availableYears()])
            ->unique()
            ->sortDesc()
            ->values()
            ->all();
        $defaultYear = $editableYears[0] ?? ($years[0] ?? (int) config('spk.default_year'));

        $year = (int) $request->query('tahun', (string) $defaultYear);
        if (! in_array($year, $years, true)) {
            $year = $defaultYear;
        }

        return Inertia::render('spk/data', [
            'years' => $years,
            'year' => $year,
            'dataEntry' => $this->dataEntry($year),
        ]);
    }

    /**
     * Rincian seluruh tahap perhitungan AHP dan TOPSIS.
     */
    public function calculation(Request $request): Response
    {
        return Inertia::render('spk/perhitungan', $this->payload($request));
    }

    /**
     * Kembalikan data ke dataset bawaan (banjir_sulawesi_selatan_event.csv).
     */
    public function reset(FloodEventCsvImporter $importer): RedirectResponse
    {
        $count = $importer->replaceAllFrom(config('spk.default_csv'));

        Inertia::flash('toast', ['type' => 'success', 'message' => "Data dikembalikan ke dataset bawaan ({$count} kejadian)."]);

        return to_route('spk.data');
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Request $request): array
    {
        $years = $this->matrixBuilder->availableYears();
        $defaultYear = in_array(config('spk.default_year'), $years, true) ? config('spk.default_year') : ($years[0] ?? config('spk.default_year'));

        $year = (int) $request->query('tahun', (string) $defaultYear);
        if (! in_array($year, $years, true)) {
            $year = $defaultYear;
        }

        [$pairwise, $pairwiseLabels] = $this->resolvePairwise($request);

        return [
            'years' => $years,
            'result' => $this->analysis->run($year, $pairwise),
            'pairwiseLabels' => $pairwiseLabels,
            'saatyScale' => self::SAATY_SCALE,
            'isDefaultPairwise' => $pairwise === null,
        ];
    }

    /**
     * Status periode input dan daftar kejadian tahun terpilih untuk panel data.
     *
     * @return array<string, mixed>
     */
    private function dataEntry(int $year): array
    {
        $editableYears = $this->period->editableYears();

        return [
            'today' => now()->toDateString(),
            'lockedThroughYear' => $this->period->lockedThroughYear(),
            'editableYears' => $editableYears,
            'deadlines' => collect($editableYears)
                ->mapWithKeys(fn (int $editable) => [$editable => $this->period->formatDate($this->period->deadlineFor($editable))])
                ->all(),
            'yearEditable' => $this->period->isEditable($year),
            'lockMessage' => $this->period->lockMessage($year),
            'regions' => $this->regionOptions(),
            'events' => FloodEvent::query()
                ->where('tahun', $year)
                ->orderByDesc('tanggal_kejadian')
                ->orderBy('kabupaten')
                ->get()
                ->map(fn (FloodEvent $event) => [
                    'id' => $event->id,
                    'kode_identitas' => $event->kode_identitas,
                    'tanggal_kejadian' => $event->tanggal_kejadian?->toDateString(),
                    'kabupaten' => $event->kabupaten,
                    'lokasi' => $event->lokasi,
                    'penyebab' => $event->penyebab,
                    'meninggal' => $event->meninggal,
                    'hilang' => $event->hilang,
                    'terluka' => $event->terluka,
                    'rumah_rusak' => $event->rumah_rusak,
                    'rumah_terendam' => $event->rumah_terendam,
                    'fasum_rusak' => $event->fasum_rusak,
                    'curah_hujan_mm' => $event->curah_hujan_mm,
                    'jumlah_penduduk_ribu' => $event->jumlah_penduduk_ribu,
                ])
                ->all(),
        ];
    }

    /**
     * Daftar kabupaten/kota (urut abjad) beserta penduduk BPS untuk formulir input.
     *
     * @return list<array{name: string, population: float|null}>
     */
    private function regionOptions(): array
    {
        /** @var array<string, array{0: float, 1: float}> $regions */
        $regions = config('spk.regions');
        /** @var array<string, float> $population */
        $population = config('spk.population');

        $names = array_keys($regions);
        sort($names);

        return array_map(
            fn (string $name) => ['name' => $name, 'population' => $population[$name] ?? null],
            $names,
        );
    }

    /**
     * Baca perbandingan berpasangan dari query string (?pw[1-2]=3&pw[3-4]=1/3 ...).
     * Nilai tidak valid diabaikan dan diganti nilai bawaan.
     *
     * @return array{0: array<string, float>|null, 1: array<string, string>}
     */
    private function resolvePairwise(Request $request): array
    {
        /** @var array<string, float|int> $defaults */
        $defaults = config('spk.pairwise');
        $input = $request->query('pw');

        $labels = [];
        $values = [];
        $changed = false;

        foreach ($defaults as $key => $default) {
            $label = $this->toLabel((float) $default);

            if (is_array($input) && isset($input[$key]) && in_array((string) $input[$key], self::SAATY_SCALE, true)) {
                $label = (string) $input[$key];
            }

            $labels[$key] = $label;
            $values[$key] = $this->fromLabel($label);
            $changed = $changed || abs($values[$key] - (float) $default) > 1e-9;
        }

        return [$changed ? $values : null, $labels];
    }

    private function fromLabel(string $label): float
    {
        if (str_contains($label, '/')) {
            [$numerator, $denominator] = explode('/', $label);

            return (float) $numerator / (float) $denominator;
        }

        return (float) $label;
    }

    private function toLabel(float $value): string
    {
        if ($value >= 1) {
            return (string) (int) round($value);
        }

        return '1/'.(int) round(1 / $value);
    }
}
