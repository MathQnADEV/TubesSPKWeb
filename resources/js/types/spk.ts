export type Category = 'Tinggi' | 'Sedang' | 'Rendah';

export type Criterion = {
    code: string;
    name: string;
    unit: string;
    type: 'benefit' | 'cost';
};

export type Alternative = {
    name: string;
    values: number[];
    missing: string[];
    normalized: number[];
    weighted: number[];
    distance_positive: number;
    distance_negative: number;
    preference: number;
    rank: number;
    category: Category;
    lat: number | null;
    lng: number | null;
    explanation: string;
    drivers: {
        code: string;
        name: string;
        text: string;
        position: number;
        total: number;
        share: number;
    }[];
    causes: { text: string; count: number }[];
};

export type AhpResult = {
    matrix: number[][];
    column_sums: number[];
    normalized: number[][];
    row_sums: number[];
    weights: number[];
    weighted_sums: number[];
    ratios: number[];
    n: number;
    lambda_max: number;
    ci: number;
    ri: number;
    cr: number;
    consistent: boolean;
};

export type SpkResult = {
    year: number;
    criteria: Criterion[];
    pairwise: Record<string, number>;
    ahp: AhpResult;
    topsis: {
        divisors: number[];
        ideal_positive: number[];
        ideal_negative: number[];
    };
    alternatives: Alternative[];
    ranking: string[];
    categories: { label: Category; min: number }[];
};

export type FloodEventRow = {
    id: number;
    kode_identitas: string | null;
    tanggal_kejadian: string | null;
    kabupaten: string;
    lokasi: string | null;
    penyebab: string | null;
    meninggal: number | null;
    hilang: number | null;
    terluka: number | null;
    rumah_rusak: number | null;
    rumah_terendam: number | null;
    fasum_rusak: number | null;
    curah_hujan_mm: number | null;
    jumlah_penduduk_ribu: number | null;
};

export type DataEntry = {
    today: string;
    lockedThroughYear: number;
    editableYears: number[];
    deadlines: Record<string, string>;
    yearEditable: boolean;
    lockMessage: string;
    regions: { name: string; population: number | null }[];
    events: FloodEventRow[];
};

export type SpkIndexProps = SpkPageProps & { lockedThroughYear: number };

export type SpkDataProps = {
    years: number[];
    year: number;
    dataEntry: DataEntry;
};

export type SpkPageProps = {
    years: number[];
    result: SpkResult;
    pairwiseLabels: Record<string, string>;
    saatyScale: string[];
    isDefaultPairwise: boolean;
};
