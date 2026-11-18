import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Calculator, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CATEGORY_STYLES, fixed, formatNumber } from '@/lib/spk';
import { home } from '@/routes';
import { calculation } from '@/routes/spk';
import type { SpkPageProps } from '@/types/spk';

function Section({
    step,
    title,
    description,
    children,
}: {
    step: string;
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="ios-glass-card p-5">
            <div className="mb-3">
                <span className="text-[11px] font-bold tracking-wider text-[#facc15] uppercase">
                    {step}
                </span>
                <h2 className="text-base font-extrabold text-white">{title}</h2>
                {description && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        {description}
                    </p>
                )}
            </div>
            <p className="mb-1.5 text-[10px] text-slate-400 sm:hidden">
                Geser tabel ke samping untuk melihat semua kolom →
            </p>
            <div className="custom-scrollbar overflow-x-auto">{children}</div>
        </section>
    );
}

export default function SpkPerhitungan({
    years,
    result,
    pairwiseLabels,
    saatyScale,
    isDefaultPairwise,
}: SpkPageProps) {
    const [draftPairwise, setDraftPairwise] =
        useState<Record<string, string>>(pairwiseLabels);

    useEffect(() => {
        setDraftPairwise(pairwiseLabels);
    }, [pairwiseLabels]);

    const applyPairwise = (pw: Record<string, string> | null) =>
        router.get(
            calculation.url(),
            { tahun: result.year, ...(pw ? { pw } : {}) } as never,
            { preserveScroll: true },
        );

    const { criteria, ahp, topsis, alternatives } = result;
    const codes = criteria.map((criterion) => criterion.code);
    const pairwiseQuery = isDefaultPairwise ? {} : { pw: pairwiseLabels };
    const ranked = [...alternatives].sort(
        (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
    );

    const changeYear = (year: number) =>
        router.get(
            calculation.url(),
            { tahun: year, ...pairwiseQuery } as never,
            { preserveScroll: true },
        );

    const criteriaHeader = (first: string) => (
        <tr>
            <th>No</th>
            <th>{first}</th>
            {codes.map((code) => (
                <th key={code} className="num">
                    {code}
                </th>
            ))}
        </tr>
    );

    const alternativeRows = (pick: (index: number) => number[], digits = 4) =>
        alternatives.map((alternative, index) => (
            <tr key={alternative.name}>
                <td>{index + 1}</td>
                <td>{alternative.name}</td>
                {pick(index).map((value, column) => (
                    <td key={column} className="num">
                        {fixed(value, digits)}
                    </td>
                ))}
            </tr>
        ));

    return (
        <>
            <Head title={`Perhitungan AHP-TOPSIS ${result.year}`}>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                />
            </Head>

            <div className="spk-root relative min-h-screen">
                <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                    <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-[95px]" />
                    <div className="absolute top-1/3 right-[-60px] h-72 w-72 rounded-full bg-indigo-500/20 blur-[90px]" />
                    <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-[#facc15]/10 blur-[100px]" />
                </div>

                <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Link
                                href={home.url({
                                    query: {
                                        tahun: result.year,
                                        ...pairwiseQuery,
                                    },
                                })}
                                className="ios-floating-glass flex h-10 w-10 items-center justify-center rounded-2xl text-[#facc15]"
                                title="Kembali ke dashboard"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="flex items-center gap-2 text-base font-extrabold text-white">
                                    <Calculator className="h-4 w-4 text-[#facc15]" />
                                    Rincian Perhitungan AHP-TOPSIS
                                </h1>
                                <p className="text-[11px] text-slate-400">
                                    Prioritas mitigasi banjir kabupaten/kota
                                    Sulawesi Selatan • tahun {result.year} •{' '}
                                    {alternatives.length} alternatif
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {years.map((year) => (
                                <button
                                    key={year}
                                    type="button"
                                    onClick={() => changeYear(year)}
                                    className={`cursor-pointer rounded-full px-3 py-1 text-xs transition ${
                                        year === result.year
                                            ? 'bg-[#facc15] font-bold text-[#090f1d]'
                                            : 'border border-white/10 bg-white/[0.06] font-semibold text-slate-200 hover:bg-white/[0.14]'
                                    }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </header>

                    {/* 1. MATRIKS KEPUTUSAN */}
                    <Section
                        step="Tahap 1–2"
                        title="Kriteria dan Matriks Keputusan"
                        description={
                            <>
                                C1 = jumlah kejadian, C2 = total rumah terendam,
                                C3 = total fasum rusak, C4 = rata-rata curah
                                hujan (sel kosong diabaikan), C5 = rata-rata
                                jumlah penduduk 2025. Semua kriteria bertipe{' '}
                                <strong>benefit</strong>.
                            </>
                        }
                    >
                        <table className="spk-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Alternatif (Kab/Kota)</th>
                                    {criteria.map((criterion) => (
                                        <th
                                            key={criterion.code}
                                            className="num"
                                        >
                                            {criterion.code} {criterion.name}
                                            <br />
                                            <span className="font-normal text-slate-400">
                                                ({criterion.unit},{' '}
                                                {criterion.type})
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {alternatives.map((alternative, index) => (
                                    <tr key={alternative.name}>
                                        <td>{index + 1}</td>
                                        <td>{alternative.name}</td>
                                        {alternative.values.map(
                                            (value, column) => (
                                                <td
                                                    key={column}
                                                    className="num"
                                                >
                                                    {alternative.missing.includes(
                                                        codes[column],
                                                    ) ? (
                                                        <span
                                                            className="text-rose-300"
                                                            title="Data kosong, dihitung 0"
                                                        >
                                                            0*
                                                        </span>
                                                    ) : (
                                                        formatNumber(value, 4)
                                                    )}
                                                </td>
                                            ),
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {alternatives.some(
                            (alternative) => alternative.missing.length > 0,
                        ) && (
                            <p className="mt-2 text-[11px] text-rose-300">
                                * Data kriteria kosong pada tahun ini, dihitung
                                sebagai 0.
                            </p>
                        )}
                    </Section>

                    {/* 2. AHP */}
                    <Section
                        step="Tahap 3"
                        title="Matriks Perbandingan Berpasangan (AHP)"
                        description="Skala Saaty: 1 = sama penting, 3 = sedikit lebih penting, 5 = lebih penting, 7 = sangat lebih penting. Urutan: C1 > C2 = C5 > C4 > C3. Ubah nilai di bawah untuk menghitung ulang bobot dan peringkat."
                    >
                        {/* Pengaturan bobot AHP */}
                        <div className="mb-4 space-y-3 rounded-2xl border border-[#facc15]/25 bg-[#facc15]/[0.04] p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-[#facc15]" />
                                    Atur perbandingan berpasangan (segitiga
                                    atas)
                                    {!isDefaultPairwise && (
                                        <span className="rounded-full border border-[#facc15]/40 bg-[#facc15]/15 px-2 py-0.5 text-[10px] font-bold text-[#facc15]">
                                            Bobot kustom
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={`font-bold ${ahp.consistent ? 'text-emerald-400' : 'text-rose-400'}`}
                                >
                                    CR = {fixed(ahp.cr)}{' '}
                                    {ahp.consistent
                                        ? '(Konsisten)'
                                        : '(Tidak konsisten, CR > 0,1)'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-[11px] min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                                {Object.keys(draftPairwise).map((key) => {
                                    const [i, j] = key.split('-').map(Number);

                                    return (
                                        <label
                                            key={key}
                                            className="ios-metric-tile flex items-center justify-between gap-2 p-2.5"
                                        >
                                            <span className="whitespace-nowrap text-slate-300">
                                                <strong className="text-white">
                                                    C{i}
                                                </strong>{' '}
                                                vs{' '}
                                                <strong className="text-white">
                                                    C{j}
                                                </strong>
                                            </span>
                                            <select
                                                value={draftPairwise[key]}
                                                onChange={(event) =>
                                                    setDraftPairwise(
                                                        (current) => ({
                                                            ...current,
                                                            [key]: event.target
                                                                .value,
                                                        }),
                                                    )
                                                }
                                                className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-base font-bold text-[#facc15] focus:outline-none sm:text-[11px]"
                                            >
                                                {saatyScale.map((value) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap gap-1.5 text-[10px]">
                                    {criteria.map((criterion, index) => (
                                        <span
                                            key={criterion.code}
                                            className="ios-metric-tile px-2 py-1"
                                            title={criterion.name}
                                        >
                                            <span className="text-slate-400">
                                                W{index + 1}
                                            </span>{' '}
                                            <strong className="text-white">
                                                {fixed(ahp.weights[index])}
                                            </strong>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => applyPairwise(null)}
                                        className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.14]"
                                    >
                                        Bobot bawaan (Excel)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            applyPairwise(draftPairwise)
                                        }
                                        className="cursor-pointer rounded-xl bg-[#facc15] px-3 py-1.5 text-[11px] font-bold text-[#090f1d] hover:bg-yellow-300"
                                    >
                                        Terapkan & hitung ulang
                                    </button>
                                </div>
                            </div>
                        </div>

                        <table className="spk-table">
                            <thead>
                                <tr>
                                    <th />
                                    {codes.map((code) => (
                                        <th key={code} className="num">
                                            {code}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ahp.matrix.map((row, i) => (
                                    <tr key={codes[i]}>
                                        <th>{codes[i]}</th>
                                        {row.map((value, j) => (
                                            <td key={j} className="num">
                                                {fixed(value)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>Jumlah kolom</td>
                                    {ahp.column_sums.map((value, j) => (
                                        <td key={j} className="num">
                                            {fixed(value)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </Section>

                    <Section
                        step="Tahap 4–5"
                        title="Normalisasi Matriks dan Bobot Kriteria"
                        description="Setiap sel dibagi jumlah kolomnya; bobot W adalah rata-rata tiap baris."
                    >
                        <table className="spk-table">
                            <thead>
                                <tr>
                                    <th />
                                    {codes.map((code) => (
                                        <th key={code} className="num">
                                            {code}
                                        </th>
                                    ))}
                                    <th className="num">Jumlah baris</th>
                                    <th className="num">Bobot W</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ahp.normalized.map((row, i) => (
                                    <tr key={codes[i]}>
                                        <th>{codes[i]}</th>
                                        {row.map((value, j) => (
                                            <td key={j} className="num">
                                                {fixed(value)}
                                            </td>
                                        ))}
                                        <td className="num">
                                            {fixed(ahp.row_sums[i])}
                                        </td>
                                        <td className="num font-bold text-[#facc15]">
                                            {fixed(ahp.weights[i])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Section>

                    <Section
                        step="Tahap 6–7"
                        title="Uji Konsistensi"
                        description="t = rata-rata (A·wᵀ)/w, CI = (t − n)/(n − 1), CR = CI/RI. Penilaian konsisten jika CR ≤ 0,1."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <table className="spk-table">
                                <thead>
                                    <tr>
                                        <th />
                                        <th className="num">(A)(wᵀ)</th>
                                        <th className="num">w</th>
                                        <th className="num">(A)(wᵀ)/w</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codes.map((code, i) => (
                                        <tr key={code}>
                                            <th>{code}</th>
                                            <td className="num">
                                                {fixed(ahp.weighted_sums[i])}
                                            </td>
                                            <td className="num">
                                                {fixed(ahp.weights[i])}
                                            </td>
                                            <td className="num">
                                                {fixed(ahp.ratios[i])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="grid grid-cols-2 gap-2.5 self-start text-xs">
                                {[
                                    ['n (jumlah kriteria)', String(ahp.n)],
                                    ['t (λ maks)', fixed(ahp.lambda_max)],
                                    ['CI', fixed(ahp.ci)],
                                    [`RI (n=${ahp.n})`, fixed(ahp.ri, 2)],
                                    ['CR = CI / RI', fixed(ahp.cr)],
                                ].map(([label, value]) => (
                                    <div
                                        key={label}
                                        className="ios-metric-tile p-3"
                                    >
                                        <div className="text-[10px] text-slate-400">
                                            {label}
                                        </div>
                                        <div className="text-sm font-bold text-white">
                                            {value}
                                        </div>
                                    </div>
                                ))}
                                <div
                                    className={`ios-metric-tile p-3 ${ahp.consistent ? 'text-emerald-300' : 'text-rose-300'}`}
                                >
                                    <div className="text-[10px] text-slate-400">
                                        Keputusan
                                    </div>
                                    <div className="text-sm font-bold">
                                        {ahp.consistent
                                            ? 'Konsisten (CR ≤ 0,1)'
                                            : 'Tidak konsisten'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* 3. TOPSIS */}
                    <Section
                        step="Tahap 8"
                        title="Matriks Ternormalisasi R (TOPSIS)"
                        description="rᵢⱼ = xᵢⱼ / √(Σ xᵢⱼ²). Baris pembagi menunjukkan √(Σ xᵢⱼ²) tiap kriteria."
                    >
                        <table className="spk-table">
                            <thead>{criteriaHeader('Alternatif')}</thead>
                            <tbody>
                                {alternativeRows(
                                    (index) => alternatives[index].normalized,
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td />
                                    <td>Pembagi</td>
                                    {topsis.divisors.map((value, j) => (
                                        <td key={j} className="num">
                                            {fixed(value)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </Section>

                    <Section
                        step="Tahap 9–10"
                        title="Matriks Terbobot Y dan Solusi Ideal"
                        description="yᵢⱼ = wⱼ · rᵢⱼ. Untuk kriteria benefit, A+ = nilai maksimum dan A− = nilai minimum."
                    >
                        <table className="spk-table">
                            <thead>{criteriaHeader('Alternatif')}</thead>
                            <tbody>
                                {alternativeRows(
                                    (index) => alternatives[index].weighted,
                                )}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td />
                                    <td>Bobot W (AHP)</td>
                                    {ahp.weights.map((value, j) => (
                                        <td key={j} className="num">
                                            {fixed(value)}
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td />
                                    <td>A+ (solusi ideal positif)</td>
                                    {topsis.ideal_positive.map((value, j) => (
                                        <td key={j} className="num">
                                            {fixed(value)}
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td />
                                    <td>A− (solusi ideal negatif)</td>
                                    {topsis.ideal_negative.map((value, j) => (
                                        <td key={j} className="num">
                                            {fixed(value)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </Section>

                    <Section
                        step="Tahap 11–13"
                        title="Jarak Solusi Ideal, Nilai Preferensi, dan Peringkat"
                        description={
                            <>
                                Vᵢ = D− / (D+ + D−). Kategori: Vᵢ ≥ 0,67 Tinggi;
                                0,34 ≤ Vᵢ &lt; 0,67 Sedang; Vᵢ &lt; 0,34 Rendah.
                            </>
                        }
                    >
                        <table className="spk-table">
                            <thead>
                                <tr>
                                    <th>Peringkat</th>
                                    <th>Kabupaten/Kota</th>
                                    <th className="num">D+</th>
                                    <th className="num">D−</th>
                                    <th className="num">Vi</th>
                                    <th>Kategori</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranked.map((alternative) => (
                                    <tr key={alternative.name}>
                                        <td className="font-bold text-[#facc15]">
                                            {alternative.rank}
                                        </td>
                                        <td>{alternative.name}</td>
                                        <td className="num">
                                            {fixed(
                                                alternative.distance_positive,
                                            )}
                                        </td>
                                        <td className="num">
                                            {fixed(
                                                alternative.distance_negative,
                                            )}
                                        </td>
                                        <td className="num font-bold text-white">
                                            {fixed(alternative.preference)}
                                        </td>
                                        <td>
                                            <span
                                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${CATEGORY_STYLES[alternative.category].badge}`}
                                            >
                                                {alternative.category}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Section>
                </div>
            </div>
        </>
    );
}
