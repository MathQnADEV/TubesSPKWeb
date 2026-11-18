<?php

use App\Models\FloodEvent;
use App\Services\Spk\FloodEventCsvImporter;
use App\Services\Spk\FloodPriorityAnalysis;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    app(FloodEventCsvImporter::class)->replaceAllFrom(config('spk.default_csv'));
});

test('bobot AHP dan konsistensi sama dengan Excel', function () {
    $result = app(FloodPriorityAnalysis::class)->run(2025);
    $ahp = $result['ahp'];

    $expectedWeights = [0.4641, 0.2017, 0.0436, 0.0888, 0.2017];
    foreach ($expectedWeights as $i => $weight) {
        expect(round($ahp['weights'][$i], 4))->toBe($weight);
    }

    expect(round($ahp['lambda_max'], 4))->toBe(5.1283)
        ->and(round($ahp['ci'], 4))->toBe(0.0321)
        ->and($ahp['ri'])->toBe(1.12)
        ->and($ahp['consistent'])->toBeTrue();
});

test('matriks keputusan 2025 sama dengan sheet Matriks Keputusan', function () {
    $alternatives = collect(app(FloodPriorityAnalysis::class)->run(2025)['alternatives'])->keyBy('name');

    expect($alternatives)->toHaveCount(16);

    $luwu = $alternatives['Kabupaten Luwu']['values'];
    expect($luwu[0])->toBe(15.0)
        ->and($luwu[1])->toBe(5522.0)
        ->and($luwu[2])->toBe(0.0)
        ->and(round($luwu[3], 4))->toBe(10.2887)
        ->and(round($luwu[4], 1))->toBe(389.3);

    $bone = $alternatives['Kabupaten Bone']['values'];
    expect($bone)->sequence(3.0, 1032.0, 6.0, fn ($v) => $v->toEqualWithDelta(8.73, 0.0001), fn ($v) => $v->toEqualWithDelta(837.1, 0.0001));
});

test('nilai preferensi dan peringkat TOPSIS sama dengan sheet Hasil', function () {
    $alternatives = collect(app(FloodPriorityAnalysis::class)->run(2025)['alternatives'])->sortBy('rank')->values();

    $expected = [
        ['Kabupaten Luwu', 0.7654, 'Tinggi'],
        ['Kabupaten Luwu Utara', 0.5086, 'Sedang'],
        ['Kabupaten Luwu Timur', 0.3447, 'Sedang'],
        ['Kota Makassar', 0.2708, 'Rendah'],
        ['Kabupaten Bone', 0.2287, 'Rendah'],
        ['Kabupaten Sinjai', 0.2137, 'Rendah'],
        ['Kabupaten Gowa', 0.1726, 'Rendah'],
        ['Kabupaten Bantaeng', 0.1427, 'Rendah'],
        ['Kabupaten Bulukumba', 0.1196, 'Rendah'],
        ['Kabupaten Maros', 0.1116, 'Rendah'],
        ['Kabupaten Pinrang', 0.0771, 'Rendah'],
        ['Kabupaten Wajo', 0.0699, 'Rendah'],
        ['Kabupaten Enrekang', 0.0664, 'Rendah'],
        ['Kota Palopo', 0.0632, 'Rendah'],
        ['Kabupaten Toraja Utara', 0.0327, 'Rendah'],
        ['Kabupaten Kepulauan Selayar', 0.0018, 'Rendah'],
    ];

    foreach ($expected as $index => [$name, $preference, $category]) {
        expect($alternatives[$index]['name'])->toBe($name)
            ->and($alternatives[$index]['rank'])->toBe($index + 1)
            ->and(round($alternatives[$index]['preference'], 4))->toBe($preference)
            ->and($alternatives[$index]['category'])->toBe($category);
    }
});

test('dashboard dan halaman perhitungan dapat dibuka', function () {
    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('spk/index')
            ->where('result.year', 2025)
            ->where('result.ranking.0', 'Kabupaten Luwu'));

    $this->get(route('spk.calculation', ['tahun' => 2024]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('spk/perhitungan')
            ->where('result.year', 2024));
});

test('perbandingan berpasangan dapat diubah lewat query string', function () {
    $this->get(route('home', ['pw' => ['1-2' => '1/3']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isDefaultPairwise', false)
            ->where('pairwiseLabels.1-2', '1/3'));
});

test('reset mengembalikan data bawaan', function () {
    $this->post(route('spk.reset'))->assertRedirect(route('spk.data'));

    expect(FloodEvent::count())->toBe(349);
});

test('alasan prioritas disusun dari kriteria terbobot terbesar', function () {
    $result = app(FloodPriorityAnalysis::class)->run(2025);
    $luwu = collect($result['alternatives'])->firstWhere('name', 'Kabupaten Luwu');

    expect($luwu)->not->toHaveKey('recommendation')
        ->and(array_column($luwu['drivers'], 'code'))->toBe(['C1', 'C2'])
        ->and($luwu['explanation'])->toBe('Skor terutama dipengaruhi oleh 15 kali kejadian banjir (tertinggi dari 16 daerah) dan 5.522 rumah terendam (tertinggi dari 16 daerah).');
});

test('penyebab kejadian dari DIBI BNPB diringkas per daerah', function () {
    $result = app(FloodPriorityAnalysis::class)->run(2024);
    $withCauses = collect($result['alternatives'])->filter(fn (array $alternative) => $alternative['causes'] !== []);

    expect($withCauses)->not->toBeEmpty()
        ->and(FloodEvent::query()->where('penyebab', 'like', '●%')->count())->toBe(0)
        ->and($withCauses->first()['causes'][0])->toHaveKeys(['text', 'count']);
});
