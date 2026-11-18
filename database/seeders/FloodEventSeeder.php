<?php

namespace Database\Seeders;

use App\Services\Spk\FloodEventCsvImporter;
use Illuminate\Database\Seeder;

class FloodEventSeeder extends Seeder
{
    /**
     * Isi tabel flood_events dari database/data/banjir_sulawesi_selatan_event.csv.
     */
    public function run(FloodEventCsvImporter $importer): void
    {
        $count = $importer->replaceAllFrom(config('spk.default_csv'));

        $this->command?->info("Mengimpor {$count} kejadian banjir.");
    }
}
