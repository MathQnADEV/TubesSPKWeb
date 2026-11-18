<?php

namespace App\Services\Spk;

use Carbon\CarbonInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Mengambil curah hujan harian dari NASA POWER (parameter PRECTOTCORR, mm/hari).
 */
class NasaPowerClient
{
    /**
     * Curah hujan pada satu tanggal di titik (lat, lng). Null bila NASA POWER
     * belum punya data untuk tanggal itu (nilai isian -999).
     *
     * @throws ConnectionException
     * @throws RequestException
     */
    public function dailyRainfall(float $latitude, float $longitude, CarbonInterface $date): ?float
    {
        $parameter = (string) config('spk.nasa_power.parameter');
        $day = $date->format('Ymd');

        $response = Http::timeout((int) config('spk.nasa_power.timeout'))
            ->acceptJson()
            ->get((string) config('spk.nasa_power.url'), [
                'parameters' => $parameter,
                'community' => config('spk.nasa_power.community'),
                'latitude' => $latitude,
                'longitude' => $longitude,
                'start' => $day,
                'end' => $day,
                'format' => 'JSON',
            ])
            ->throw();

        $value = data_get($response->json(), "properties.parameter.{$parameter}.{$day}");

        if (! is_numeric($value) || (float) $value < 0) {
            return null;
        }

        return round((float) $value, 2);
    }
}
