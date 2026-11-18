import { Head, Link, router } from '@inertiajs/react';
import {
    Building2,
    Calculator,
    ChevronDown,
    CloudRain,
    Compass,
    ClipboardPen,
    Home,
    Info,
    ListOrdered,
    Lock,
    MapPin,
    Repeat,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import AppLogoIcon from '@/components/app-logo-icon';
import { PrioritySourceDialog } from '@/components/priority-source-dialog';
import type {
    LeafletLayer,
    LeafletLayerGroup,
    LeafletMap,
    LeafletMarker,
    LeafletStatic,
} from '@/lib/leaflet';
import { loadLeaflet } from '@/lib/leaflet';
import {
    CATEGORY_STYLES,
    criterionValue,
    escapeHtml,
    fixed,
    formatNumber,
    shortRegionName,
} from '@/lib/spk';
import { home } from '@/routes';
import { calculation, data as dataPage } from '@/routes/spk';
import type { Alternative, Category, SpkIndexProps } from '@/types/spk';

type Filter = 'ALL' | Category;
type Basemap = 'dark' | 'street' | 'satellite';

const MAP_CENTER: [number, number] = [-4.1, 119.9];

const BASEMAPS: Record<Basemap, { label: string; url: string; attr: string }> =
    {
        dark: {
            label: 'Dark Mode',
            // CARTO kini mewajibkan API key; Esri Dark Gray masih bebas dipakai.
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            attr: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
        },
        street: {
            label: 'Street',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attr: '&copy; OpenStreetMap contributors',
        },
        satellite: {
            label: 'Satellite',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attr: 'Tiles &copy; Esri',
        },
    };

const CRITERION_ICONS = [Repeat, Home, Building2, CloudRain, Users];

const FILTERS: Filter[] = ['ALL', 'Tinggi', 'Sedang', 'Rendah'];

export default function SpkIndex({
    years,
    result,
    pairwiseLabels,
    isDefaultPairwise,
    lockedThroughYear,
}: SpkIndexProps) {
    const ranked = useMemo(
        () =>
            [...result.alternatives].sort(
                (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
            ),
        [result.alternatives],
    );

    const [selectedName, setSelectedName] = useState<string>(
        ranked[0]?.name ?? '',
    );
    const [filter, setFilter] = useState<Filter>('ALL');
    const [search, setSearch] = useState('');
    const [showHeroDetails, setShowHeroDetails] = useState(false);
    const [detailName, setDetailName] = useState<string | null>(null);
    const [basemap, setBasemap] = useState<Basemap>('dark');
    const [leaflet, setLeaflet] = useState<LeafletStatic | null>(null);

    const mapElement = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const tileRef = useRef<LeafletLayer | null>(null);
    const markersRef = useRef<LeafletLayerGroup | null>(null);
    const markerRefs = useRef<Record<string, LeafletMarker>>({});
    // Marker yang popup-nya harus dibuka lagi setelah marker digambar ulang.
    const pendingPopup = useRef<string | null>(null);

    const selected =
        ranked.find((item) => item.name === selectedName) ?? ranked[0];

    // Sinkronkan state lokal ketika data dari server berubah (ganti tahun / bobot / upload).

    useEffect(() => {
        if (!ranked.some((item) => item.name === selectedName)) {
            setSelectedName(ranked[0]?.name ?? '');
        }
    }, [ranked, selectedName]);

    const filtered = ranked.filter(
        (item) =>
            (filter === 'ALL' || item.category === filter) &&
            item.name.toLowerCase().includes(search.toLowerCase()),
    );

    const calculationHref = calculation.url({
        query: {
            tahun: result.year,
            ...(isDefaultPairwise ? {} : { pw: pairwiseLabels }),
        },
    });

    const visit = (
        params: { tahun?: number; pw?: Record<string, string> | null } = {},
    ) => {
        const query: Record<string, unknown> = {
            tahun: params.tahun ?? result.year,
        };
        const pw =
            params.pw === undefined
                ? isDefaultPairwise
                    ? null
                    : pairwiseLabels
                : params.pw;

        if (pw) {
            query.pw = pw;
        }

        router.get(home.url(), query as never, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // ------------------------------------------------------------------
    // Peta Leaflet
    // ------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;

        loadLeaflet()
            .then((L) => {
                if (cancelled || !mapElement.current || mapRef.current) {
                    return;
                }

                const map = L.map(mapElement.current, {
                    center: MAP_CENTER,
                    zoom: 7,
                    zoomControl: false,
                });
                L.control.zoom({ position: 'bottomright' }).addTo(map);
                markersRef.current = L.layerGroup().addTo(map);
                mapRef.current = map;
                setLeaflet(L);
            })
            .catch(() =>
                toast.error(
                    'Peta gagal dimuat. Periksa koneksi internet untuk memuat Leaflet.',
                ),
            );

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;

        if (!leaflet || !map) {
            return;
        }

        if (tileRef.current) {
            map.removeLayer(tileRef.current);
        }

        tileRef.current = leaflet
            .tileLayer(BASEMAPS[basemap].url, {
                attribution: BASEMAPS[basemap].attr,
                maxZoom: 18,
                maxNativeZoom: basemap === 'dark' ? 16 : 18,
            })
            .addTo(map);
    }, [leaflet, basemap]);

    useEffect(() => {
        const group = markersRef.current;

        if (!leaflet || !group) {
            return;
        }

        group.clearLayers();
        markerRefs.current = {};

        ranked.forEach((item) => {
            if (item.lat === null || item.lng === null) {
                return;
            }

            const style = CATEGORY_STYLES[item.category];
            const isSelected = item.name === selected?.name;
            const size = isSelected ? 34 : item.category === 'Tinggi' ? 28 : 24;
            const pulse =
                isSelected || item.category === 'Tinggi'
                    ? `<div class="marker-pulse" style="position:absolute;inset:-6px;border-radius:9999px;background:${style.hex};opacity:.45"></div>`
                    : '';

            const icon = leaflet.divIcon({
                html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">${pulse}<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${style.hex};color:#0e172a;font-weight:800;font-size:${isSelected ? 12 : 10}px;display:flex;align-items:center;justify-content:center;border:${isSelected ? '3px solid #fff' : '2px solid #0e172a'};box-shadow:0 4px 12px rgba(0,0,0,.55);cursor:pointer">${item.rank}</div></div>`,
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
            });

            const marker = leaflet
                .marker([item.lat, item.lng], { icon })
                .bindPopup(
                    `<div style="min-width:200px;font-family:Inter,sans-serif">
                        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
                            <span style="font-size:11px;font-weight:800;color:#facc15">PERINGKAT #${item.rank}</span>
                            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:${style.hex}25;color:${style.hex};border:1px solid ${style.hex}55">${item.category}</span>
                        </div>
                        <div style="font-size:14px;font-weight:800;margin-bottom:6px">${escapeHtml(item.name)}</div>
                        <div style="font-size:11px;color:#CBD5E1;line-height:1.45;margin-bottom:10px">${escapeHtml(item.explanation)}</div>
                        <button type="button" data-spk-detail="${escapeHtml(item.name)}" style="width:100%;cursor:pointer;border-radius:10px;border:1px solid rgba(250,204,21,.45);background:rgba(250,204,21,.14);color:#facc15;font-family:Inter,sans-serif;font-size:11px;font-weight:700;padding:6px 10px">Asal angka &amp; perhitungan →</button>
                    </div>`,
                    {
                        maxWidth: Math.min(280, window.innerWidth - 90),
                        autoPanPaddingTopLeft: [16, 130],
                        autoPanPaddingBottomRight: [16, 70],
                    },
                )
                .on('click', () => {
                    if (!isSelected) {
                        pendingPopup.current = item.name;
                    }

                    setSelectedName(item.name);
                });

            marker.addTo(group);
            markerRefs.current[item.name] = marker;

            if (pendingPopup.current === item.name) {
                pendingPopup.current = null;
                marker.openPopup();
            }
        });
    }, [leaflet, ranked, selected?.name]);

    // Tombol "Asal angka" di popup Leaflet: popup menghentikan propagasi klik,
    // jadi klik ditangkap pada fase capture di kontainer peta.
    useEffect(() => {
        const element = mapElement.current;

        if (!element) {
            return;
        }

        const onClick = (event: MouseEvent) => {
            const trigger = (
                event.target as HTMLElement | null
            )?.closest<HTMLElement>('[data-spk-detail]');

            if (trigger?.dataset.spkDetail) {
                setDetailName(trigger.dataset.spkDetail);
            }
        };

        element.addEventListener('click', onClick, true);

        return () => element.removeEventListener('click', onClick, true);
    }, []);

    const focusRegion = (item: Alternative) => {
        setSelectedName(item.name);

        // Di layar sempit peta berada di bawah daftar: gulir ke peta dulu,
        // baru jalankan animasi peta agar keduanya tidak saling memotong.
        const isNarrow = window.innerWidth < 1024;
        const map = mapElement.current?.closest('main');

        if (isNarrow && map) {
            window.scrollTo({
                top: map.getBoundingClientRect().top + window.scrollY,
                behavior: 'smooth',
            });
        }

        if (!mapRef.current || item.lat === null || item.lng === null) {
            return;
        }

        const target: [number, number] = [item.lat, item.lng];

        window.setTimeout(
            () => {
                mapRef.current?.flyTo(target, 9, { duration: 1 });
                window.setTimeout(
                    () => markerRefs.current[item.name]?.openPopup(),
                    1100,
                );
            },
            isNarrow ? 600 : 0,
        );
    };

    const selectedStyle = selected ? CATEGORY_STYLES[selected.category] : null;

    return (
        <>
            <Head title="Dashboard Prioritas Sulawesi Selatan">
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
                />
            </Head>

            <div className="spk-root flex min-h-screen flex-col selection:bg-[#facc15] selection:text-[#0e172a] lg:h-screen lg:overflow-hidden">
                <div className="flex h-full w-full flex-1 flex-col lg:flex-row lg:overflow-hidden">
                    {/* KOLOM KIRI */}
                    <aside className="custom-scrollbar relative flex w-full shrink-0 flex-col gap-5 border-b border-white/10 bg-[#090f1d] p-4 sm:p-6 lg:h-screen lg:w-[46%] lg:overflow-y-auto lg:border-r lg:border-b-0 xl:w-[45%] [&>*]:shrink-0">
                        <div className="pointer-events-none fixed inset-y-0 left-0 z-0 w-full overflow-hidden lg:w-[46%] xl:w-[45%]">
                            <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-[95px]" />
                            <div className="absolute top-1/3 right-[-60px] h-72 w-72 rounded-full bg-indigo-500/20 blur-[90px]" />
                            <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-blue-600/15 blur-[100px]" />
                            <div className="absolute top-[58%] left-1/3 h-56 w-56 rounded-full bg-[#facc15]/10 blur-[85px]" />
                        </div>

                        {/* HEADER */}
                        <header className="relative z-10 flex flex-col gap-3.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <AppLogoIcon className="h-12 w-12 shrink-0 drop-shadow-[0_4px_14px_rgba(56,189,248,0.35)]" />
                                    <div>
                                        <h1 className="text-sm leading-tight font-extrabold tracking-tight text-white sm:text-base">
                                            SPK Mitigasi Banjir{' '}
                                            <span className="text-[#facc15]">
                                                • Sulawesi Selatan
                                            </span>
                                        </h1>
                                        <p className="text-[11px] text-slate-400">
                                            Sistem Pendukung Keputusan Prioritas
                                            Daerah
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={calculationHref}
                                    className="ios-floating-glass shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-[#facc15]"
                                    title="Lihat rincian perhitungan"
                                >
                                    AHP-TOPSIS
                                </Link>
                            </div>

                            <div className="group relative w-full">
                                <Search className="absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#facc15]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder={`Cari ${ranked.length} kabupaten/kota terdampak banjir...`}
                                    className="ios-floating-glass w-full rounded-2xl py-3 pr-4 pl-10 text-base text-slate-100 placeholder-slate-400 focus:border-[#facc15]/60 focus:outline-none sm:text-sm"
                                />
                            </div>
                        </header>

                        {/* CARD 1: DATA, TAHUN & BOBOT AHP */}
                        <div className="ios-glass-card ios-glass-card-hover relative z-10 p-4 sm:p-5">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-[#facc15] shadow-[0_0_8px_#facc15]" />
                                    <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                                        Data Kejadian Banjir (BNPB)
                                    </h2>
                                    {!isDefaultPairwise && (
                                        <Link
                                            href={calculationHref}
                                            className="flex items-center gap-1 rounded-full border border-[#facc15]/40 bg-[#facc15]/15 px-2 py-0.5 text-[10px] font-bold text-[#facc15]"
                                            title="Bobot AHP sedang memakai perbandingan berpasangan kustom. Ubah di halaman Perhitungan."
                                        >
                                            <SlidersHorizontal className="h-3 w-3" />
                                            Bobot kustom
                                        </Link>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Link
                                        href={dataPage.url({
                                            query: { tahun: result.year },
                                        })}
                                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-slate-100 transition hover:bg-white/[0.14]"
                                        title="Input manual, unggah CSV, dan kelola data kejadian banjir"
                                    >
                                        <ClipboardPen className="h-3.5 w-3.5 text-[#facc15]" />
                                        <span>Input Data</span>
                                    </Link>
                                    <Link
                                        href={calculationHref}
                                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-[#facc15] transition hover:bg-white/[0.14]"
                                        title="Rincian tahap perhitungan AHP & TOPSIS"
                                    >
                                        <Calculator className="h-3.5 w-3.5" />
                                        <span>Perhitungan</span>
                                    </Link>
                                </div>
                            </div>

                            {/* Pilih tahun */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="mr-1 shrink-0 text-[11px] text-slate-400">
                                    Tahun
                                </span>
                                {years.map((year) => (
                                    <button
                                        key={year}
                                        type="button"
                                        onClick={() => visit({ tahun: year })}
                                        className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs transition ${
                                            year === result.year
                                                ? 'bg-[#facc15] font-bold text-[#090f1d]'
                                                : 'border border-white/10 bg-white/[0.06] font-semibold text-slate-200 hover:bg-white/[0.14]'
                                        }`}
                                        title={
                                            year <= lockedThroughYear
                                                ? `Data ${year} sudah final (terkunci)`
                                                : undefined
                                        }
                                    >
                                        <span className="flex items-center gap-1">
                                            {year <= lockedThroughYear && (
                                                <Lock className="h-2.5 w-2.5 opacity-60" />
                                            )}
                                            {year}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* CARD 2: HERO */}
                        {selected && selectedStyle && (
                            <div className="ios-glass-card ios-glass-card-hover relative z-10 overflow-hidden p-5">
                                <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-[#facc15]/15 blur-3xl" />

                                <div className="mb-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-300/80">
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#facc15]" />
                                            <span className="truncate">
                                                Wilayah Evaluasi Terpilih •{' '}
                                                {result.year}
                                            </span>
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-md sm:px-3 sm:py-1 sm:text-xs ${selectedStyle.badge}`}
                                        >
                                            Prioritas {selected.category}
                                        </span>
                                    </div>
                                    <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white sm:text-xl">
                                        {String(selected.rank).padStart(2, '0')}{' '}
                                        • {shortRegionName(selected.name)}
                                    </h2>
                                </div>

                                <div className="my-3.5 flex items-center gap-4">
                                    <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#facc15]/25 to-sky-400/20 shadow-inner sm:flex">
                                        <ShieldAlert className="h-7 w-7 text-[#facc15]" />
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <div className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                                            {fixed(selected.preference)}
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-slate-100 sm:text-sm">
                                                Skor prioritas mitigasi
                                            </div>
                                            <div className="text-xs text-slate-300/80">
                                                Peringkat #{selected.rank} dari{' '}
                                                {ranked.length} daerah terdampak
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-xs">
                                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[#facc15]">
                                        <Info className="h-3.5 w-3.5" />
                                        Mengapa prioritas {selected.category}?
                                    </div>
                                    <p className="leading-relaxed text-slate-200">
                                        {selected.explanation}
                                    </p>
                                    {selected.causes.length > 0 ? (
                                        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-300">
                                            <span className="font-semibold text-slate-200">
                                                Penyebab tercatat (DIBI BNPB):
                                            </span>{' '}
                                            {selected.causes
                                                .map(
                                                    (cause) =>
                                                        `${cause.text} (${cause.count}×)`,
                                                )
                                                .join('; ')}
                                        </p>
                                    ) : (
                                        <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-slate-400">
                                            Penyebab kejadian tidak tercatat
                                            pada data DIBI BNPB tahun{' '}
                                            {result.year}.
                                        </p>
                                    )}
                                </div>

                                {/* Rincian teknis AHP-TOPSIS (dropdown) */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowHeroDetails((value) => !value)
                                    }
                                    aria-expanded={showHeroDetails}
                                    className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.1]"
                                >
                                    <span className="flex items-center gap-1.5 text-left">
                                        <Calculator className="h-3.5 w-3.5 shrink-0 text-[#facc15]" />
                                        Rincian perhitungan AHP-TOPSIS
                                    </span>
                                    <ChevronDown
                                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showHeroDetails ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {showHeroDetails && (
                                    <div className="mt-3 space-y-3">
                                        <div className="custom-scrollbar overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead className="text-slate-400">
                                                    <tr>
                                                        <th className="py-1.5 pr-2 text-left font-semibold">
                                                            Kriteria
                                                        </th>
                                                        <th className="px-1.5 py-1.5 text-right font-semibold">
                                                            Nilai (x)
                                                        </th>
                                                        <th className="px-1.5 py-1.5 text-right font-semibold">
                                                            W
                                                        </th>
                                                        <th className="px-1.5 py-1.5 text-right font-semibold">
                                                            r
                                                        </th>
                                                        <th className="py-1.5 pl-1.5 text-right font-semibold">
                                                            y
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-slate-200">
                                                    {result.criteria.map(
                                                        (criterion, index) => {
                                                            const Icon =
                                                                CRITERION_ICONS[
                                                                    index
                                                                ];

                                                            return (
                                                                <tr
                                                                    key={
                                                                        criterion.code
                                                                    }
                                                                    className="border-t border-white/10"
                                                                >
                                                                    <td className="py-1.5 pr-2">
                                                                        <span className="flex items-center gap-1">
                                                                            {Icon && (
                                                                                <Icon className="h-3 w-3 shrink-0 text-slate-400" />
                                                                            )}
                                                                            <strong className="text-[#facc15]">
                                                                                {
                                                                                    criterion.code
                                                                                }
                                                                            </strong>{' '}
                                                                            <span className="truncate">
                                                                                {
                                                                                    criterion.name
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap text-white">
                                                                        {criterionValue(
                                                                            selected,
                                                                            index,
                                                                        )}
                                                                    </td>
                                                                    <td className="px-1.5 py-1.5 text-right tabular-nums">
                                                                        {fixed(
                                                                            result
                                                                                .ahp
                                                                                .weights[
                                                                                index
                                                                            ],
                                                                        )}
                                                                    </td>
                                                                    <td className="px-1.5 py-1.5 text-right tabular-nums">
                                                                        {fixed(
                                                                            selected
                                                                                .normalized[
                                                                                index
                                                                            ],
                                                                        )}
                                                                    </td>
                                                                    <td className="py-1.5 pl-1.5 text-right tabular-nums">
                                                                        {fixed(
                                                                            selected
                                                                                .weighted[
                                                                                index
                                                                            ],
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        },
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="ios-metric-tile p-2">
                                                <div className="text-[10px] text-slate-400">
                                                    Jarak ke ideal positif D+
                                                </div>
                                                <div className="text-sm font-bold text-white tabular-nums">
                                                    {fixed(
                                                        selected.distance_positive,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ios-metric-tile p-2">
                                                <div className="text-[10px] text-slate-400">
                                                    Jarak ke ideal negatif D−
                                                </div>
                                                <div className="text-sm font-bold text-white tabular-nums">
                                                    {fixed(
                                                        selected.distance_negative,
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ios-metric-tile p-2">
                                                <div className="text-[10px] text-slate-400">
                                                    Vi = D− / (D+ + D−)
                                                </div>
                                                <div className="text-sm font-bold text-[#facc15] tabular-nums">
                                                    {fixed(selected.preference)}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] leading-relaxed text-slate-400">
                                            x = nilai kriteria, W = bobot AHP, r
                                            = x / √Σx² (normalisasi vektor), y =
                                            W × r. Kategori: Vi ≥ 0,67 Tinggi, ≥
                                            0,34 Sedang, selain itu Rendah.{' '}
                                            <Link
                                                href={calculationHref}
                                                className="font-semibold text-[#facc15] hover:underline"
                                            >
                                                Lihat semua tahap →
                                            </Link>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CARD 3: PERANKINGAN */}
                        <div className="ios-glass-card relative z-10 flex flex-1 flex-col p-5">
                            <div className="mb-3.5 flex items-center justify-between gap-2">
                                <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
                                    <ListOrdered className="h-4 w-4 shrink-0 text-[#facc15]" />
                                    <span className="truncate">
                                        Perankingan
                                        <span className="hidden sm:inline">
                                            {' '}
                                            Mitigasi Daerah
                                        </span>{' '}
                                        {result.year}
                                    </span>
                                </h2>
                                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-300">
                                    {filtered.length} Kab/Kota
                                </span>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                {FILTERS.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setFilter(value)}
                                        className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs transition sm:px-3.5 ${
                                            filter === value
                                                ? 'bg-[#facc15] font-bold text-[#090f1d] shadow-sm'
                                                : 'border border-white/10 bg-white/[0.06] font-semibold text-slate-200 hover:bg-white/[0.14]'
                                        }`}
                                    >
                                        {value === 'ALL' ? 'Semua' : value}
                                    </button>
                                ))}
                            </div>

                            <div className="custom-scrollbar max-h-[30rem] space-y-2.5 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible lg:pr-0">
                                {filtered.length === 0 && (
                                    <div className="py-8 text-center text-xs text-slate-400">
                                        Tidak ada wilayah yang sesuai dengan
                                        filter pencarian.
                                    </div>
                                )}

                                {filtered.map((item) => {
                                    const isSelected =
                                        item.name === selected?.name;
                                    const style =
                                        CATEGORY_STYLES[item.category];

                                    return (
                                        <div
                                            key={item.name}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => focusRegion(item)}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === 'Enter' ||
                                                    event.key === ' '
                                                ) {
                                                    event.preventDefault();
                                                    focusRegion(item);
                                                }
                                            }}
                                            className={`cursor-pointer p-3.5 ${isSelected ? 'ios-rank-item-active' : 'ios-rank-item'}`}
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <span
                                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                                                            isSelected
                                                                ? 'bg-[#facc15] text-[#090f1d] shadow-sm'
                                                                : 'border border-white/10 bg-white/[0.08] text-slate-200'
                                                        }`}
                                                    >
                                                        {item.rank}
                                                    </span>
                                                    <span className="truncate text-xs font-bold text-slate-100 sm:text-sm">
                                                        <span className="sm:hidden">
                                                            {shortRegionName(
                                                                item.name,
                                                            )}
                                                        </span>
                                                        <span className="hidden sm:inline">
                                                            {item.name}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <span
                                                        className={`hidden rounded-full border px-2.5 py-0.5 text-[10px] font-bold sm:inline-block ${style.badge}`}
                                                    >
                                                        {item.category}
                                                    </span>
                                                    <span
                                                        className={`w-12 text-right text-xs font-extrabold sm:text-sm ${isSelected ? 'text-[#facc15]' : 'text-white'}`}
                                                    >
                                                        {fixed(item.preference)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                <div className="h-1.5 flex-1 basis-full overflow-hidden rounded-full bg-white/[0.08] sm:basis-auto">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(Math.round(item.preference * 100), 100)}%`,
                                                            backgroundColor:
                                                                style.hex,
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold sm:hidden ${style.badge}`}
                                                >
                                                    {item.category}
                                                </span>
                                                <span className="min-w-0 text-[10px] text-slate-300/80 sm:shrink-0">
                                                    {formatNumber(
                                                        item.values[0],
                                                    )}{' '}
                                                    kejadian •{' '}
                                                    {formatNumber(
                                                        item.values[1],
                                                    )}{' '}
                                                    rumah terendam
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* KOLOM KANAN: PETA */}
                    <main className="relative flex h-[540px] w-full flex-col bg-[#080e1c] lg:h-screen lg:w-[54%] xl:w-[55%]">
                        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
                            <div className="ios-floating-glass flex items-center gap-1 rounded-2xl p-1.5">
                                {(Object.keys(BASEMAPS) as Basemap[]).map(
                                    (key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setBasemap(key)}
                                            className={`cursor-pointer rounded-xl px-2.5 py-1.5 text-[11px] transition sm:px-3 sm:text-xs ${
                                                basemap === key
                                                    ? 'bg-[#facc15] font-bold text-[#090f1d] shadow-sm'
                                                    : 'font-semibold text-slate-200 hover:bg-white/[0.12]'
                                            }`}
                                        >
                                            {BASEMAPS[key].label}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>

                        <div className="absolute top-[4.25rem] right-4 left-4 z-20 flex flex-wrap items-center gap-2 sm:top-4 sm:left-auto sm:justify-end">
                            <div className="ios-floating-glass flex items-center gap-2 rounded-2xl px-2.5 py-2 text-[10px] font-medium xl:gap-2.5 xl:px-3.5 xl:text-[11px]">
                                {(
                                    ['Tinggi', 'Sedang', 'Rendah'] as Category[]
                                ).map((category) => (
                                    <span
                                        key={category}
                                        className="flex items-center gap-1.5 text-slate-100"
                                    >
                                        <i
                                            className="inline-block h-2.5 w-2.5 rounded-full"
                                            style={{
                                                background:
                                                    CATEGORY_STYLES[category]
                                                        .hex,
                                                boxShadow: `0 0 6px ${CATEGORY_STYLES[category].hex}`,
                                            }}
                                        />
                                        {category}
                                    </span>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    mapRef.current?.flyTo(MAP_CENTER, 7, {
                                        duration: 1,
                                    })
                                }
                                title="Reset Peta Sulsel"
                                aria-label="Reset Peta Sulsel"
                                className="ios-floating-glass flex cursor-pointer items-center gap-1.5 rounded-2xl px-3 py-2 text-[11px] font-bold text-[#facc15] hover:-translate-y-0.5 xl:px-3.5 xl:text-xs"
                            >
                                <Compass className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">
                                    Reset Peta Sulsel
                                </span>
                            </button>
                        </div>

                        <div
                            ref={mapElement}
                            className="h-full w-full flex-1"
                        />

                        <div className="pointer-events-none absolute right-14 bottom-7 left-4 z-20 sm:bottom-4">
                            <div className="ios-floating-glass pointer-events-auto inline-flex max-w-full items-center gap-2.5 rounded-2xl px-4 py-2.5">
                                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#facc15] shadow-[0_0_8px_#facc15]" />
                                <span className="truncate text-xs text-slate-100">
                                    {selected ? (
                                        <>
                                            Terpilih:{' '}
                                            <strong className="text-white">
                                                {selected.name}
                                            </strong>{' '}
                                            • Peringkat #{selected.rank} (Vi:{' '}
                                            <strong className="text-[#facc15]">
                                                {fixed(selected.preference)}
                                            </strong>
                                            )
                                        </>
                                    ) : (
                                        `Tidak ada kejadian banjir pada tahun ${result.year}`
                                    )}
                                </span>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            <PrioritySourceDialog
                alternative={
                    ranked.find((item) => item.name === detailName) ?? null
                }
                result={result}
                total={ranked.length}
                calculationHref={calculationHref}
                onClose={() => setDetailName(null)}
            />
        </>
    );
}
