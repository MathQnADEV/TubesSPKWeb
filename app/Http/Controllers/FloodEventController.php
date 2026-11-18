<?php

namespace App\Http\Controllers;

use App\Http\Requests\FloodEventRequest;
use App\Models\FloodEvent;
use App\Services\Spk\DataEntryPeriod;
use App\Services\Spk\FloodEventCsvImporter;
use App\Services\Spk\NasaPowerClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use InvalidArgumentException;

/**
 * Pengelolaan data kejadian banjir: input manual, unggah CSV (gabung),
 * dan penarikan curah hujan NASA POWER. Tahun terkunci tidak bisa diubah.
 */
class FloodEventController extends Controller
{
    public function __construct(private readonly DataEntryPeriod $period) {}

    public function store(FloodEventRequest $request): RedirectResponse
    {
        $event = FloodEvent::query()->create($request->eventAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kejadian banjir {$event->kabupaten} ({$event->tanggal_kejadian?->format('d/m/Y')}) berhasil ditambahkan."]);

        return to_route('spk.data', ['tahun' => $event->tahun]);
    }

    public function update(FloodEventRequest $request, FloodEvent $floodEvent): RedirectResponse
    {
        if (! $this->period->isEditable($floodEvent->tahun)) {
            return $this->locked($floodEvent->tahun);
        }

        $floodEvent->update($request->eventAttributes());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kejadian banjir {$floodEvent->kabupaten} berhasil diperbarui."]);

        return to_route('spk.data', ['tahun' => $floodEvent->tahun]);
    }

    public function destroy(FloodEvent $floodEvent): RedirectResponse
    {
        if (! $this->period->isEditable($floodEvent->tahun)) {
            return $this->locked($floodEvent->tahun);
        }

        $floodEvent->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kejadian banjir {$floodEvent->kabupaten} dihapus."]);

        return to_route('spk.data', ['tahun' => $floodEvent->tahun]);
    }

    /**
     * Unggah CSV (format gabungan DIBI BNPB + NASA POWER + BPS) lalu gabungkan.
     */
    public function import(Request $request, FloodEventCsvImporter $importer): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ], [
            'file.mimes' => 'File harus berformat .csv (simpan Excel sebagai CSV terlebih dahulu).',
        ]);

        try {
            $summary = $importer->mergeFrom($request->file('file')->getRealPath());
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['file' => $exception->getMessage()]);
        }

        $name = $request->file('file')->getClientOriginalName();
        $changed = $summary['inserted'] + $summary['updated'];

        $notes = [];
        if ($summary['locked'] > 0) {
            $notes[] = "{$summary['locked']} baris tahun terkunci (".implode(', ', $summary['locked_years']).') dilewati';
        }
        if ($summary['future'] > 0) {
            $notes[] = "{$summary['future']} baris bertanggal di masa depan dilewati";
        }
        $suffix = $notes === [] ? '' : ' '.ucfirst(implode('; ', $notes)).'.';

        Inertia::flash('toast', [
            'type' => $changed > 0 ? 'success' : 'warning',
            'message' => $changed > 0
                ? "{$name}: {$summary['inserted']} kejadian ditambahkan, {$summary['updated']} diperbarui.{$suffix}"
                : "{$name}: tidak ada data yang digabungkan.{$suffix}",
        ]);

        $editableYears = $this->period->editableYears();

        return to_route('spk.data', $editableYears === [] ? [] : ['tahun' => $editableYears[0]]);
    }

    /**
     * Tarik curah hujan harian NASA POWER di titik pusat kabupaten/kota.
     */
    public function rainfall(Request $request, NasaPowerClient $client): JsonResponse
    {
        $validated = $request->validate([
            'kabupaten' => ['required', 'string', Rule::in(array_keys(config('spk.regions')))],
            'tanggal' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
        ]);

        [$latitude, $longitude] = config('spk.regions')[$validated['kabupaten']];
        $date = Carbon::parse($validated['tanggal']);

        try {
            $value = $client->dailyRainfall($latitude, $longitude, $date);
        } catch (ConnectionException|RequestException) {
            return response()->json(['message' => 'NASA POWER tidak dapat dihubungi. Coba lagi atau isi curah hujan secara manual.'], 502);
        }

        if ($value === null) {
            return response()->json(['message' => 'NASA POWER belum memiliki data curah hujan untuk tanggal ini. Isi secara manual atau coba beberapa hari lagi.'], 404);
        }

        return response()->json([
            'curah_hujan_mm' => $value,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'source' => 'NASA POWER '.config('spk.nasa_power.parameter'),
        ]);
    }

    private function locked(int $year): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => $this->period->lockMessage($year)]);

        return back();
    }
}
