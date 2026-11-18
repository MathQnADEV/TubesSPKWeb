import { router, useForm } from '@inertiajs/react';
import {
    CloudDownload,
    Lock,
    LockOpen,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { formatNumber, shortRegionName } from '@/lib/spk';
import { rainfall } from '@/routes/spk';
import { destroy, store, update } from '@/routes/spk/events';
import type { DataEntry, FloodEventRow } from '@/types/spk';

type FormFields = {
    tanggal_kejadian: string;
    kabupaten: string;
    kode_identitas: string;
    lokasi: string;
    penyebab: string;
    meninggal: string;
    hilang: string;
    terluka: string;
    rumah_rusak: string;
    rumah_terendam: string;
    fasum_rusak: string;
    curah_hujan_mm: string;
    jumlah_penduduk_ribu: string;
};

type FieldName = keyof FormFields;

const COUNT_FIELDS: { name: FieldName; label: string }[] = [
    { name: 'rumah_terendam', label: 'Rumah terendam (C2)' },
    { name: 'fasum_rusak', label: 'Fasum rusak (C3)' },
    { name: 'rumah_rusak', label: 'Rumah rusak' },
    { name: 'meninggal', label: 'Meninggal' },
    { name: 'hilang', label: 'Hilang' },
    { name: 'terluka', label: 'Terluka' },
];

const INPUT_CLASS =
    'w-full rounded-xl border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-base text-slate-100 placeholder-slate-500 [color-scheme:dark] sm:text-xs focus:border-[#facc15]/60 focus:outline-none';

function toText(value: number | string | null | undefined): string {
    return value === null || value === undefined ? '' : String(value);
}

function formatDate(value: string | null): string {
    if (!value) {
        return '-';
    }

    const [year, month, day] = value.split('-');

    return `${day}/${month}/${year}`;
}

export function FloodEventPanel({
    dataEntry,
    year,
}: {
    dataEntry: DataEntry;
    year: number;
}) {
    const { editableYears, deadlines, regions, today } = dataEntry;
    const canAdd = editableYears.length > 0;
    const minDate = canAdd ? `${Math.min(...editableYears)}-01-01` : today;
    const population = (name: string) =>
        regions.find((region) => region.name === name)?.population ?? null;

    const emptyFields = (): FormFields => {
        const kabupaten = regions[0]?.name ?? '';

        return {
            tanggal_kejadian: today,
            kabupaten,
            kode_identitas: '',
            lokasi: '',
            penyebab: '',
            meninggal: '',
            hilang: '',
            terluka: '',
            rumah_rusak: '',
            rumah_terendam: '',
            fasum_rusak: '',
            curah_hujan_mm: '',
            jumlah_penduduk_ribu: toText(population(kabupaten)),
        };
    };

    const [editing, setEditing] = useState<FloodEventRow | 'new' | null>(null);
    const [isFetchingRain, setIsFetchingRain] = useState(false);
    const form = useForm<FormFields>(emptyFields());

    const openNew = () => {
        form.clearErrors();
        form.setData(emptyFields());
        setEditing('new');
    };

    const openEdit = (event: FloodEventRow) => {
        form.clearErrors();
        form.setData({
            tanggal_kejadian: toText(event.tanggal_kejadian),
            kabupaten: event.kabupaten,
            kode_identitas: toText(event.kode_identitas),
            lokasi: toText(event.lokasi),
            penyebab: toText(event.penyebab),
            meninggal: toText(event.meninggal),
            hilang: toText(event.hilang),
            terluka: toText(event.terluka),
            rumah_rusak: toText(event.rumah_rusak),
            rumah_terendam: toText(event.rumah_terendam),
            fasum_rusak: toText(event.fasum_rusak),
            curah_hujan_mm: toText(event.curah_hujan_mm),
            jumlah_penduduk_ribu: toText(event.jumlah_penduduk_ribu),
        });
        setEditing(event);
    };

    const close = () => {
        setEditing(null);
        form.clearErrors();
    };

    const changeRegion = (name: string) => {
        form.setData((data) => ({
            ...data,
            kabupaten: name,
            jumlah_penduduk_ribu: toText(population(name)),
        }));
    };

    const pullRainfall = async () => {
        if (!form.data.kabupaten || !form.data.tanggal_kejadian) {
            toast.error(
                'Pilih kabupaten dan tanggal kejadian terlebih dahulu.',
            );

            return;
        }

        setIsFetchingRain(true);

        try {
            const response = await fetch(
                rainfall.url({
                    query: {
                        kabupaten: form.data.kabupaten,
                        tanggal: form.data.tanggal_kejadian,
                    },
                }),
                { headers: { Accept: 'application/json' } },
            );
            const body = await response.json();

            if (!response.ok) {
                toast.error(
                    body.message ??
                        body.errors?.tanggal?.[0] ??
                        'Gagal menarik data NASA POWER.',
                );

                return;
            }

            form.setData('curah_hujan_mm', String(body.curah_hujan_mm));
            toast.success(
                `Curah hujan ${formatNumber(body.curah_hujan_mm, 2)} mm/hari dari NASA POWER.`,
            );
        } catch {
            toast.error('NASA POWER tidak dapat dihubungi.');
        } finally {
            setIsFetchingRain(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) =>
            Object.fromEntries(
                Object.entries(data).map(([key, value]) => [
                    key,
                    value.trim() === '' ? null : value.trim(),
                ]),
            ),
        );

        const options = {
            preserveScroll: true,
            onSuccess: () => setEditing(null),
            onError: () =>
                toast.error('Periksa kembali isian data kejadian banjir.'),
        };

        if (editing === 'new') {
            form.post(store.url(), options);
        } else if (editing) {
            form.put(update.url(editing.id), options);
        }
    };

    const remove = (event: FloodEventRow) => {
        if (
            !window.confirm(
                `Hapus kejadian banjir ${event.kabupaten} tanggal ${formatDate(event.tanggal_kejadian)}?`,
            )
        ) {
            return;
        }

        router.delete(destroy.url(event.id), { preserveScroll: true });
    };

    const error = (name: FieldName) =>
        form.errors[name] ? (
            <p className="mt-1 text-[10px] text-rose-300">
                {form.errors[name]}
            </p>
        ) : null;

    return (
        <div className="space-y-3">
            {/* Status periode input */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-slate-200">
                    Data Kejadian {year} ({dataEntry.events.length})
                </span>
                {dataEntry.yearEditable ? (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-bold text-emerald-300">
                        <LockOpen className="h-3 w-3" />
                        Terbuka s/d {deadlines[year]}
                    </span>
                ) : (
                    <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 font-bold text-slate-300">
                        <Lock className="h-3 w-3" />
                        Terkunci
                    </span>
                )}
            </div>

            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px] leading-relaxed text-slate-300">
                {dataEntry.yearEditable
                    ? `Data ${year} masih dapat ditambah, diubah, dan dihapus. `
                    : `${dataEntry.lockMessage} `}
                {canAdd
                    ? `Periode input terbuka: ${editableYears
                          .map((open) => `${open} (s/d ${deadlines[open]})`)
                          .join(', ')}. `
                    : 'Saat ini tidak ada tahun yang terbuka untuk input. '}
                Tahun {dataEntry.lockedThroughYear} ke bawah sudah final.
            </p>

            {editing === null && (
                <button
                    type="button"
                    onClick={openNew}
                    disabled={!canAdd}
                    className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#facc15] px-3 py-2 text-xs font-bold text-[#090f1d] transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah kejadian banjir manual
                </button>
            )}

            {/* Formulir input manual */}
            {editing !== null && (
                <form
                    onSubmit={submit}
                    className="space-y-3 rounded-2xl border border-[#facc15]/30 bg-[#facc15]/[0.04] p-3.5"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                            {editing === 'new'
                                ? 'Tambah kejadian banjir'
                                : `Ubah kejadian #${editing.id}`}
                        </span>
                        <button
                            type="button"
                            onClick={close}
                            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                            title="Tutup formulir"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <Section title="DIBI BNPB • kejadian">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <Field label="Tanggal kejadian">
                                <input
                                    type="date"
                                    required
                                    min={minDate}
                                    max={today}
                                    value={form.data.tanggal_kejadian}
                                    onChange={(event) =>
                                        form.setData(
                                            'tanggal_kejadian',
                                            event.target.value,
                                        )
                                    }
                                    className={INPUT_CLASS}
                                />
                                {error('tanggal_kejadian')}
                            </Field>
                            <Field label="Kabupaten/Kota">
                                <select
                                    required
                                    value={form.data.kabupaten}
                                    onChange={(event) =>
                                        changeRegion(event.target.value)
                                    }
                                    className={INPUT_CLASS}
                                >
                                    {regions.map((region) => (
                                        <option
                                            key={region.name}
                                            value={region.name}
                                        >
                                            {region.name}
                                        </option>
                                    ))}
                                </select>
                                {error('kabupaten')}
                            </Field>
                            <Field label="Kode identitas bencana (opsional)">
                                <input
                                    type="text"
                                    value={form.data.kode_identitas}
                                    onChange={(event) =>
                                        form.setData(
                                            'kode_identitas',
                                            event.target.value,
                                        )
                                    }
                                    className={INPUT_CLASS}
                                />
                                {error('kode_identitas')}
                            </Field>
                            <Field label="Lokasi (kecamatan/desa)">
                                <input
                                    type="text"
                                    value={form.data.lokasi}
                                    onChange={(event) =>
                                        form.setData(
                                            'lokasi',
                                            event.target.value,
                                        )
                                    }
                                    className={INPUT_CLASS}
                                />
                                {error('lokasi')}
                            </Field>
                        </div>
                        <Field label="Penyebab (sesuai catatan DIBI BNPB, opsional)">
                            <input
                                type="text"
                                value={form.data.penyebab}
                                onChange={(event) =>
                                    form.setData('penyebab', event.target.value)
                                }
                                placeholder="mis. Hujan dengan intensitas tinggi"
                                className={INPUT_CLASS}
                            />
                            {error('penyebab')}
                        </Field>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                            {COUNT_FIELDS.map((field) => (
                                <Field key={field.name} label={field.label}>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        inputMode="numeric"
                                        value={form.data[field.name]}
                                        onChange={(event) =>
                                            form.setData(
                                                field.name,
                                                event.target.value,
                                            )
                                        }
                                        placeholder="0"
                                        className={INPUT_CLASS}
                                    />
                                    {error(field.name)}
                                </Field>
                            ))}
                        </div>
                    </Section>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <Section title="NASA POWER • curah hujan (C4)">
                            <div className="flex gap-1.5">
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    inputMode="decimal"
                                    value={form.data.curah_hujan_mm}
                                    onChange={(event) =>
                                        form.setData(
                                            'curah_hujan_mm',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="mm/hari"
                                    className={INPUT_CLASS}
                                />
                                <button
                                    type="button"
                                    onClick={pullRainfall}
                                    disabled={isFetchingRain}
                                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-400/15 px-2.5 text-[11px] font-bold text-sky-200 transition hover:bg-sky-400/25 disabled:cursor-wait disabled:opacity-60"
                                    title="Tarik curah hujan harian NASA POWER di titik kabupaten pada tanggal kejadian"
                                >
                                    <CloudDownload className="h-3.5 w-3.5" />
                                    {isFetchingRain ? 'Menarik...' : 'Tarik'}
                                </button>
                            </div>
                            {error('curah_hujan_mm')}
                        </Section>
                        <Section title="BPS • penduduk 2025 (C5)">
                            <input
                                type="number"
                                min={0}
                                step="0.1"
                                inputMode="decimal"
                                value={form.data.jumlah_penduduk_ribu}
                                onChange={(event) =>
                                    form.setData(
                                        'jumlah_penduduk_ribu',
                                        event.target.value,
                                    )
                                }
                                placeholder="ribu jiwa"
                                className={INPUT_CLASS}
                            />
                            <p className="mt-1 text-[10px] text-slate-400">
                                Terisi otomatis dari BPS, boleh diubah.
                            </p>
                            {error('jumlah_penduduk_ribu')}
                        </Section>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={close}
                            className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.14]"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="cursor-pointer rounded-xl bg-[#facc15] px-3 py-1.5 text-[11px] font-bold text-[#090f1d] hover:bg-yellow-300 disabled:opacity-60"
                        >
                            {form.processing
                                ? 'Menyimpan...'
                                : editing === 'new'
                                  ? 'Simpan & hitung ulang'
                                  : 'Perbarui & hitung ulang'}
                        </button>
                    </div>
                </form>
            )}

            {/* Daftar kejadian tahun terpilih */}
            <div className="custom-scrollbar max-h-[34rem] space-y-1.5 overflow-y-auto pr-1">
                {dataEntry.events.length === 0 && (
                    <p className="py-3 text-center text-[11px] text-slate-400">
                        Belum ada kejadian banjir tercatat untuk tahun {year}.
                    </p>
                )}
                {dataEntry.events.map((event) => (
                    <div
                        key={event.id}
                        className={`ios-metric-tile flex items-center justify-between gap-2 p-2.5 text-[11px] ${
                            editing !== 'new' && editing?.id === event.id
                                ? 'border-[#facc15]/60'
                                : ''
                        }`}
                    >
                        <div className="min-w-0">
                            <div className="truncate font-semibold text-white">
                                {formatDate(event.tanggal_kejadian)} •{' '}
                                {shortRegionName(event.kabupaten)}
                            </div>
                            <div className="truncate text-[10px] text-slate-400">
                                {formatNumber(event.rumah_terendam ?? 0)} rumah
                                terendam •{' '}
                                {formatNumber(event.fasum_rusak ?? 0)} fasum •{' '}
                                {event.curah_hujan_mm === null
                                    ? 'curah hujan n/a'
                                    : `${formatNumber(event.curah_hujan_mm, 2)} mm`}
                                {event.lokasi
                                    ? ` • ${event.lokasi.replace(/\\n/g, ' ')}`
                                    : ''}
                            </div>
                        </div>
                        {dataEntry.yearEditable ? (
                            <div className="flex shrink-0 gap-1">
                                <button
                                    type="button"
                                    onClick={() => openEdit(event)}
                                    className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-slate-200 hover:bg-white/[0.14]"
                                    title="Ubah kejadian"
                                >
                                    <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(event)}
                                    className="cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/25"
                                    title="Hapus kejadian"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ) : (
                            <Lock
                                className="h-3.5 w-3.5 shrink-0 text-slate-500"
                                aria-label="Terkunci"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] font-bold tracking-wider text-[#facc15] uppercase">
                {title}
            </div>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] text-slate-400">
                {label}
            </span>
            {children}
        </label>
    );
}
