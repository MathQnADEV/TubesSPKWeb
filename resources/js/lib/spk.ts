import type { Alternative, Category } from '@/types/spk';

export const CATEGORY_STYLES: Record<Category, { hex: string; badge: string }> =
    {
        Tinggi: {
            hex: '#F43F5E',
            badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        },
        Sedang: {
            hex: '#FB923C',
            badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        },
        Rendah: {
            hex: '#10B981',
            badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        },
    };

export function formatNumber(value: number, fractionDigits = 0): string {
    return value.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionDigits,
    });
}

export function fixed(value: number, digits = 4): string {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function shortRegionName(name: string): string {
    return name.replace(/^Kabupaten\s+/i, 'Kab. ');
}

/**
 * Sumber dan cara agregasi tiap kriteria (Tabel 1 artikel).
 */
export const CRITERION_SOURCES: Record<
    string,
    { label: string; source: string; aggregation: string }
> = {
    C1: {
        label: 'Frekuensi kejadian banjir',
        source: 'DIBI BNPB',
        aggregation: 'Jumlah kejadian',
    },
    C2: {
        label: 'Rumah terendam (unit)',
        source: 'DIBI BNPB',
        aggregation: 'Jumlah',
    },
    C3: {
        label: 'Fasilitas umum rusak (unit)',
        source: 'DIBI BNPB',
        aggregation: 'Jumlah',
    },
    C4: {
        label: 'Rata-rata curah hujan (mm/hari)',
        source: 'NASA POWER',
        aggregation: 'Rata-rata',
    },
    C5: {
        label: 'Jumlah penduduk 2025 (ribu jiwa)',
        source: 'BPS',
        aggregation: 'Nilai wilayah',
    },
};

/**
 * Nilai kriteria ke-index sebuah alternatif, siap tampil (n/a bila data kosong).
 */
export function criterionValue(
    alternative: Alternative,
    index: number,
): string {
    if (alternative.missing.includes(`C${index + 1}`)) {
        return 'n/a';
    }

    const value = alternative.values[index];

    if (index === 3) {
        return `${formatNumber(value, 2)} mm`;
    }

    if (index === 4) {
        return `${formatNumber(value, 1)} rb`;
    }

    return formatNumber(value);
}
