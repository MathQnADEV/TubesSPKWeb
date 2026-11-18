import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ClipboardPen,
    Database,
    FileSpreadsheet,
    Lock,
    RotateCcw,
} from 'lucide-react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FloodEventPanel } from '@/components/flood-event-panel';
import { CRITERION_SOURCES } from '@/lib/spk';
import { home } from '@/routes';
import { data as dataPage, importMethod, reset } from '@/routes/spk';
import type { SpkDataProps } from '@/types/spk';

function Card({
    title,
    icon,
    children,
}: {
    title: string;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="ios-glass-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <span className="text-[#facc15]">{icon}</span>
                {title}
            </h2>
            {children}
        </section>
    );
}

export default function SpkData({ years, year, dataEntry }: SpkDataProps) {
    const [isDragging, setIsDragging] = useState(false);
    const uploadForm = useForm<{ file: File | null }>({ file: null });

    const changeYear = (selected: number) =>
        router.get(dataPage.url(), { tahun: selected } as never, {
            preserveScroll: true,
        });

    const submitFile = (file: File | undefined) => {
        if (!file) {
            return;
        }

        uploadForm.transform(() => ({ file }));
        uploadForm.post(importMethod.url(), {
            forceFormData: true,
            preserveScroll: true,
            onError: (errors) =>
                toast.error(errors.file ?? 'Gagal mengimpor file.'),
        });
    };

    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        submitFile(event.target.files?.[0]);
        event.target.value = '';
    };

    const onDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        submitFile(event.dataTransfer.files?.[0]);
    };

    const resetData = () => {
        if (
            window.confirm(
                'Kembalikan data ke dataset bawaan? Kejadian yang ditambahkan atau diubah secara manual / lewat CSV akan hilang.',
            )
        ) {
            router.post(reset.url(), {}, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title={`Input Data Kejadian Banjir ${year}`}>
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
                                href={home.url({ query: { tahun: year } })}
                                className="ios-floating-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[#facc15]"
                                title="Kembali ke dashboard"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="flex items-center gap-2 text-base font-extrabold text-white">
                                    <ClipboardPen className="h-4 w-4 text-[#facc15]" />
                                    Input Data Kejadian Banjir
                                </h1>
                                <p className="text-[11px] text-slate-400">
                                    Gabungan DIBI BNPB • NASA POWER • BPS •
                                    tahun {year}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {years.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => changeYear(option)}
                                    title={
                                        option <= dataEntry.lockedThroughYear
                                            ? `Data ${option} sudah final (terkunci)`
                                            : undefined
                                    }
                                    className={`flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs transition ${
                                        option === year
                                            ? 'bg-[#facc15] font-bold text-[#090f1d]'
                                            : 'border border-white/10 bg-white/[0.06] font-semibold text-slate-200 hover:bg-white/[0.14]'
                                    }`}
                                >
                                    {option <= dataEntry.lockedThroughYear && (
                                        <Lock className="h-2.5 w-2.5 opacity-60" />
                                    )}
                                    {option}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
                        <div className="order-2 flex flex-col gap-5 lg:order-1">
                            <Card
                                title="Unggah CSV untuk digabung"
                                icon={<FileSpreadsheet className="h-4 w-4" />}
                            >
                                <label
                                    htmlFor="csvFileInput"
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setIsDragging(true);
                                    }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={onDrop}
                                    className={`group flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-dashed p-5 text-center transition-all duration-300 ${
                                        isDragging
                                            ? 'border-[#facc15] bg-[#131f38]'
                                            : 'border-white/20 bg-white/[0.03] hover:border-[#facc15]/70 hover:bg-white/[0.08]'
                                    }`}
                                >
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#facc15]/30 bg-[#facc15]/15 text-[#facc15] transition group-hover:bg-[#facc15]/25">
                                        <FileSpreadsheet className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-100">
                                            {uploadForm.processing
                                                ? 'Menggabungkan data...'
                                                : 'Seret file .csv ke sini'}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-400">
                                            Format sama dengan
                                            banjir_sulawesi_selatan_event.csv
                                        </p>
                                    </div>
                                    <span className="rounded-xl bg-[#facc15] px-3.5 py-2 text-xs font-bold text-[#090f1d] shadow-md transition group-hover:bg-yellow-300">
                                        Pilih File
                                    </span>
                                    <input
                                        id="csvFileInput"
                                        type="file"
                                        accept=".csv,text/csv"
                                        className="hidden"
                                        onChange={onFileChange}
                                    />
                                </label>
                                <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-300">
                                    <li>
                                        • Hanya baris tahun{' '}
                                        <strong className="text-white">
                                            {dataEntry.editableYears.length > 0
                                                ? dataEntry.editableYears.join(
                                                      ', ',
                                                  )
                                                : '-'}
                                        </strong>{' '}
                                        yang diproses; tahun{' '}
                                        {dataEntry.lockedThroughYear} ke bawah
                                        dilewati.
                                    </li>
                                    <li>
                                        • Kejadian yang sudah ada (kode
                                        identitas, atau tanggal + kabupaten +
                                        lokasi sama) diperbarui, sisanya
                                        ditambahkan.
                                    </li>
                                    <li>
                                        • Kolom penduduk kosong diisi otomatis
                                        dari data BPS 2025.
                                    </li>
                                </ul>
                            </Card>

                            <Card
                                title="Sumber data kriteria"
                                icon={<Database className="h-4 w-4" />}
                            >
                                <div className="custom-scrollbar overflow-x-auto">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="text-slate-400">
                                            <tr>
                                                <th className="py-1.5 pr-2 font-semibold">
                                                    Kode
                                                </th>
                                                <th className="py-1.5 pr-2 font-semibold">
                                                    Kriteria
                                                </th>
                                                <th className="py-1.5 font-semibold">
                                                    Sumber • agregasi
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-200">
                                            {Object.entries(
                                                CRITERION_SOURCES,
                                            ).map(
                                                ([
                                                    code,
                                                    {
                                                        label: name,
                                                        source,
                                                        aggregation: agg,
                                                    },
                                                ]) => (
                                                    <tr
                                                        key={code}
                                                        className="border-t border-white/10"
                                                    >
                                                        <td className="py-1.5 pr-2 font-bold text-[#facc15]">
                                                            {code}
                                                        </td>
                                                        <td className="py-1.5 pr-2">
                                                            {name}
                                                        </td>
                                                        <td className="py-1.5">
                                                            <div className="whitespace-nowrap">
                                                                {source}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {agg}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-[10px] text-slate-400">
                                    Semua kriteria bersifat benefit.
                                </p>
                            </Card>

                            <Card
                                title="Reset data"
                                icon={<RotateCcw className="h-4 w-4" />}
                            >
                                <p className="mb-3 text-[11px] leading-relaxed text-slate-300">
                                    Kembalikan seluruh data ke dataset bawaan
                                    (banjir_sulawesi_selatan_event.csv). Data
                                    yang diinput manual atau lewat CSV akan
                                    hilang.
                                </p>
                                <button
                                    type="button"
                                    onClick={resetData}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/25"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset ke data bawaan
                                </button>
                            </Card>
                        </div>

                        <section className="ios-glass-card order-1 p-4 sm:p-5 lg:order-2">
                            <FloodEventPanel
                                dataEntry={dataEntry}
                                year={year}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}
