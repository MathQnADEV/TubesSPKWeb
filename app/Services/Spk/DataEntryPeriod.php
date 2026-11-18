<?php

namespace App\Services\Spk;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Aturan tahun mana yang masih boleh diisi/diubah.
 *
 * Tahun <= spk.data_entry.locked_through_year sudah final dan terkunci.
 * Tahun sesudahnya terbuka sejak 1 Januari tahun itu sampai
 * spk.data_entry.grace_months bulan setelah tahun berakhir
 * (contoh: 2026 terbuka 1 Jan 2026 - 31 Mar 2027).
 */
class DataEntryPeriod
{
    public function lockedThroughYear(): int
    {
        return (int) config('spk.data_entry.locked_through_year');
    }

    /**
     * Hari terakhir (akhir hari) tahun $year masih boleh diubah.
     */
    public function deadlineFor(int $year): CarbonImmutable
    {
        return CarbonImmutable::create($year + 1)
            ->startOfYear()
            ->addMonthsNoOverflow((int) config('spk.data_entry.grace_months'))
            ->subDay()
            ->endOfDay();
    }

    public function isEditable(int $year, ?CarbonInterface $now = null): bool
    {
        $now ??= now();

        return $year > $this->lockedThroughYear()
            && $year <= $now->year
            && $now->lessThanOrEqualTo($this->deadlineFor($year));
    }

    /**
     * @return list<int>
     */
    public function editableYears(?CarbonInterface $now = null): array
    {
        $now ??= now();
        $years = [];

        for ($year = $now->year; $year > $this->lockedThroughYear(); $year--) {
            if ($this->isEditable($year, $now)) {
                $years[] = $year;
            }
        }

        return $years;
    }

    public function lockMessage(int $year): string
    {
        if ($year <= $this->lockedThroughYear()) {
            return "Data tahun {$year} sudah final dan dikunci (tahun {$this->lockedThroughYear()} ke bawah tidak dapat diubah).";
        }

        if ($year > now()->year) {
            return "Tahun {$year} belum berjalan, data belum dapat diisi.";
        }

        return "Masa input data tahun {$year} sudah berakhir pada {$this->formatDate($this->deadlineFor($year))}.";
    }

    public function formatDate(CarbonInterface $date): string
    {
        return $date->locale('id')->translatedFormat('j F Y');
    }
}
