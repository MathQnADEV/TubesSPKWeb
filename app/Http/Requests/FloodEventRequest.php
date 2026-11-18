<?php

namespace App\Http\Requests;

use App\Services\Spk\DataEntryPeriod;
use App\Services\Spk\FloodEventCsvImporter;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Input manual satu kejadian banjir (gabungan DIBI BNPB, NASA POWER, BPS).
 */
class FloodEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $count = ['nullable', 'integer', 'min:0', 'max:1000000'];

        return [
            'tanggal_kejadian' => [
                'required',
                'date_format:Y-m-d',
                'before_or_equal:today',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $year = (int) substr((string) $value, 0, 4);
                    $period = app(DataEntryPeriod::class);

                    if (! $period->isEditable($year)) {
                        $fail($period->lockMessage($year));
                    }
                },
            ],
            'kabupaten' => ['required', 'string', Rule::in(array_keys(config('spk.regions')))],
            'kode_identitas' => ['nullable', 'string', 'max:100'],
            'lokasi' => ['nullable', 'string', 'max:1000'],
            'penyebab' => ['nullable', 'string', 'max:1000'],
            'meninggal' => $count,
            'hilang' => $count,
            'terluka' => $count,
            'rumah_rusak' => $count,
            'rumah_terendam' => $count,
            'fasum_rusak' => $count,
            'curah_hujan_mm' => ['nullable', 'numeric', 'min:0', 'max:2000'],
            'jumlah_penduduk_ribu' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tanggal_kejadian.required' => 'Tanggal kejadian wajib diisi.',
            'tanggal_kejadian.date_format' => 'Format tanggal kejadian harus YYYY-MM-DD.',
            'tanggal_kejadian.before_or_equal' => 'Tanggal kejadian tidak boleh melewati hari ini.',
            'kabupaten.required' => 'Pilih kabupaten/kota.',
            'kabupaten.in' => 'Kabupaten/kota tidak dikenal di Sulawesi Selatan.',
            '*.integer' => 'Isian harus bilangan bulat.',
            '*.numeric' => 'Isian harus berupa angka.',
            '*.min' => 'Isian tidak boleh negatif.',
        ];
    }

    /**
     * Atribut siap simpan: tahun diambil dari tanggal, penduduk kosong diisi data BPS.
     *
     * @return array<string, mixed>
     */
    public function eventAttributes(): array
    {
        $data = $this->validated();
        $data['tahun'] = Carbon::parse($data['tanggal_kejadian'])->year;
        $data['jumlah_penduduk_ribu'] ??= app(FloodEventCsvImporter::class)->bpsPopulation($data['kabupaten']);

        return $data;
    }
}
