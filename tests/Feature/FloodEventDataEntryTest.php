<?php

use App\Models\FloodEvent;
use App\Services\Spk\DataEntryPeriod;
use App\Services\Spk\FloodEventCsvImporter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(Carbon::parse('2026-11-19 10:00:00'));
    Http::preventStrayRequests();
    app(FloodEventCsvImporter::class)->replaceAllFrom(config('spk.default_csv'));
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function floodEventInput(array $overrides = []): array
{
    return [
        'tanggal_kejadian' => '2026-11-10',
        'kabupaten' => 'Kabupaten Luwu',
        'lokasi' => 'Kec. Belopa',
        'rumah_terendam' => 120,
        'fasum_rusak' => 2,
        'curah_hujan_mm' => 18.5,
        ...$overrides,
    ];
}

function csvUpload(string $body): UploadedFile
{
    $header = 'Kode Identitas Bencana,Tanggal Kejadian,Tahun,Kejadian,Kabupaten,Provinsi,Lokasi,Penyebab,Meninggal,Hilang,Terluka,Rumah Rusak,Rumah Terendam,Fasum Rusak,Curah_Hujan_mm,Jumlah_Penduduk_2025_Ribu_Jiwa';

    return UploadedFile::fake()->createWithContent('kejadian.csv', $header."\n".$body."\n");
}

test('tahun 2025 ke bawah terkunci dan 2026 terbuka sampai 31 Maret 2027', function () {
    $period = app(DataEntryPeriod::class);

    expect($period->isEditable(2025))->toBeFalse()
        ->and($period->isEditable(2026))->toBeTrue()
        ->and($period->editableYears())->toBe([2026])
        ->and($period->isEditable(2026, Carbon::parse('2027-03-31 23:59:00')))->toBeTrue()
        ->and($period->isEditable(2026, Carbon::parse('2027-04-01 00:00:00')))->toBeFalse()
        ->and($period->editableYears(Carbon::parse('2027-02-01')))->toBe([2027, 2026])
        ->and($period->isEditable(2027))->toBeFalse();
});

test('input manual 2026 tersimpan dengan tahun dari tanggal dan penduduk BPS otomatis', function () {
    $this->post(route('spk.events.store'), floodEventInput())
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('spk.data', ['tahun' => 2026]));

    $event = FloodEvent::query()->latest('id')->first();

    expect($event->tahun)->toBe(2026)
        ->and($event->rumah_terendam)->toBe(120)
        ->and($event->jumlah_penduduk_ribu)->toBe(389.3)
        ->and(FloodEvent::count())->toBe(350);
});

test('input manual untuk tahun terkunci atau tanggal masa depan ditolak', function (string $date) {
    $this->post(route('spk.events.store'), floodEventInput(['tanggal_kejadian' => $date]))
        ->assertSessionHasErrors('tanggal_kejadian');

    expect(FloodEvent::count())->toBe(349);
})->with(['2025-12-31', '2026-11-20']);

test('kejadian tahun terkunci tidak dapat diubah atau dihapus', function () {
    $event = FloodEvent::query()->where('tahun', 2025)->first();
    $original = $event->rumah_terendam;

    $this->put(route('spk.events.update', $event), floodEventInput())->assertRedirect();
    $this->delete(route('spk.events.destroy', $event))->assertRedirect();

    expect($event->fresh()->rumah_terendam)->toBe($original)
        ->and($event->fresh()->tahun)->toBe(2025);
});

test('kejadian 2026 dapat diubah dan dihapus tetapi tidak dapat dipindah ke 2025', function () {
    $event = FloodEvent::query()->where('tahun', 2026)->first();

    $this->put(route('spk.events.update', $event), floodEventInput(['tanggal_kejadian' => '2025-06-01']))
        ->assertSessionHasErrors('tanggal_kejadian');

    $this->put(route('spk.events.update', $event), floodEventInput(['rumah_terendam' => 999]))
        ->assertSessionHasNoErrors();
    expect($event->fresh()->rumah_terendam)->toBe(999);

    $this->delete(route('spk.events.destroy', $event));
    expect(FloodEvent::find($event->id))->toBeNull();
});

test('unggah CSV menggabungkan baris 2026 dan melewati tahun terkunci', function () {
    $before2025 = FloodEvent::query()->where('tahun', 2025)->sum('rumah_terendam');

    $file = csvUpload(implode("\n", [
        ',11/1/2026,2026,BANJIR,Kota Makassar,Sulawesi Selatan,Kec. Tallo,,,,,0,300,1,25.5,',
        ',6/13/2026,2026,BANJIR,Kabupaten Luwu,Sulawesi Selatan,Kecamatan:\nKec. Walenrang Timur   Ds. Tabah,,,,,0,250,0,,389.3',
        ',3/1/2025,2025,BANJIR,Kota Makassar,Sulawesi Selatan,Kec. Tallo,,,,,0,5000,9,40,',
    ]));

    $this->post(route('spk.import'), ['file' => $file])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('spk.data', ['tahun' => 2026]));

    $inserted = FloodEvent::query()->where('lokasi', 'Kec. Tallo')->sole();
    $updated = FloodEvent::query()->whereDate('tanggal_kejadian', '2026-06-13')->where('kabupaten', 'Kabupaten Luwu')->sole();

    expect(FloodEvent::count())->toBe(350)
        ->and($inserted->jumlah_penduduk_ribu)->toBe(1473.9)
        ->and($updated->rumah_terendam)->toBe(250)
        ->and(FloodEvent::query()->where('tahun', 2025)->sum('rumah_terendam'))->toBe($before2025);
});

test('unggah ulang CSV bawaan tidak menggandakan data', function () {
    $this->post(route('spk.import'), [
        'file' => UploadedFile::fake()->createWithContent('bawaan.csv', file_get_contents(config('spk.default_csv'))),
    ])->assertSessionHasNoErrors();

    expect(FloodEvent::count())->toBe(349);
});

test('curah hujan ditarik dari NASA POWER pada titik kabupaten', function () {
    Http::fake([
        'power.larc.nasa.gov/*' => Http::response(['properties' => ['parameter' => ['PRECTOTCORR' => ['20250211' => 37.34]]]]),
    ]);

    $this->getJson(route('spk.rainfall', ['kabupaten' => 'Kota Makassar', 'tanggal' => '2025-02-11']))
        ->assertOk()
        ->assertJson(['curah_hujan_mm' => 37.34]);

    Http::assertSent(fn ($request) => $request['latitude'] == -5.1477
        && $request['start'] === '20250211'
        && $request['parameters'] === 'PRECTOTCORR');
});

test('curah hujan NASA POWER yang belum tersedia dilaporkan', function () {
    Http::fake([
        'power.larc.nasa.gov/*' => Http::response(['properties' => ['parameter' => ['PRECTOTCORR' => ['20261118' => -999]]]]),
    ]);

    $this->getJson(route('spk.rainfall', ['kabupaten' => 'Kota Makassar', 'tanggal' => '2026-11-18']))
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});

test('halaman input data mengirim status periode input dan kejadian tahun terpilih', function () {
    $this->get(route('spk.data', ['tahun' => 2026]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dataEntry.editableYears', [2026])
            ->where('dataEntry.yearEditable', true)
            ->where('dataEntry.deadlines.2026', '31 Maret 2027')
            ->has('dataEntry.events', 15)
            ->has('dataEntry.regions', 24));

    $this->get(route('spk.data', ['tahun' => 2025]))
        ->assertInertia(fn (Assert $page) => $page->where('dataEntry.yearEditable', false));
});
