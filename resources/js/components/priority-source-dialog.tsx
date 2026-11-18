import { Link } from '@inertiajs/react';
import { ArrowRight, Calculator, Database, Scale, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    CATEGORY_STYLES,
    CRITERION_SOURCES,
    criterionValue,
    fixed,
} from '@/lib/spk';
import type { Alternative, SpkResult } from '@/types/spk';

function Step({
    number,
    icon,
    title,
    children,
}: {
    number: number;
    icon: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#facc15] text-[10px] font-extrabold text-[#090f1d]">
                    {number}
                </span>
                <span className="text-[#facc15]">{icon}</span>
                {title}
            </h3>
            {children}
        </section>
    );
}

/**
 * Pop-up singkat: dari mana angka suatu daerah berasal sampai menjadi nilai Vi.
 */
export function PrioritySourceDialog({
    alternative,
    result,
    total,
    calculationHref,
    onClose,
}: {
    alternative: Alternative | null;
    result: SpkResult;
    total: number;
    calculationHref: string;
    onClose: () => void;
}) {
    const style = alternative ? CATEGORY_STYLES[alternative.category] : null;
    const thresholds = result.categories
        .filter((category) => category.min > 0)
        .map(
            (category) =>
                `${category.label} ≥ ${String(category.min).replace('.', ',')}`,
        )
        .join(', ');

    return (
        <Dialog
            open={alternative !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="custom-scrollbar max-h-[90vh] overflow-y-auto rounded-3xl border-white/15 bg-[#0f1a2e]/95 p-5 text-slate-100 shadow-2xl backdrop-blur-xl sm:max-w-xl [&>button]:text-slate-300"
                style={{ fontFamily: 'Inter, sans-serif' }}
            >
                {alternative && style && (
                    <div className="space-y-4">
                        <div className="pr-6">
                            <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-extrabold text-white">
                                Asal angka • {alternative.name}
                                <span
                                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${style.badge}`}
                                >
                                    {alternative.category}
                                </span>
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-[11px] text-slate-400">
                                Tahun {result.year} • peringkat #
                                {alternative.rank} dari {total} daerah
                            </DialogDescription>
                        </div>

                        <Step
                            number={1}
                            icon={<Database className="h-3.5 w-3.5" />}
                            title="Data kriteria & sumbernya"
                        >
                            <div className="custom-scrollbar overflow-x-auto">
                                <table className="w-full text-[11px]">
                                    <thead className="text-slate-400">
                                        <tr>
                                            <th className="py-1 pr-2 text-left font-semibold">
                                                Kriteria
                                            </th>
                                            <th className="py-1 pl-1.5 text-right font-semibold">
                                                Nilai
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.criteria.map(
                                            (criterion, index) => {
                                                const source =
                                                    CRITERION_SOURCES[
                                                        criterion.code
                                                    ];

                                                return (
                                                    <tr
                                                        key={criterion.code}
                                                        className="border-t border-white/10"
                                                    >
                                                        <td className="py-1.5 pr-2">
                                                            <strong className="text-[#facc15]">
                                                                {criterion.code}
                                                            </strong>{' '}
                                                            {source?.label ??
                                                                criterion.name}
                                                            <div className="text-[10px] text-slate-400">
                                                                {source?.source}{' '}
                                                                •{' '}
                                                                {source?.aggregation.toLowerCase()}
                                                            </div>
                                                        </td>
                                                        <td className="py-1.5 pl-1.5 text-right align-top font-semibold whitespace-nowrap text-white">
                                                            {criterionValue(
                                                                alternative,
                                                                index,
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            },
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Step>

                        <Step
                            number={2}
                            icon={<Scale className="h-3.5 w-3.5" />}
                            title="Dibobot dengan AHP"
                        >
                            <p className="text-[11px] leading-relaxed text-slate-300">
                                Nilai tiap kriteria dinormalisasi (r = x / √Σx²
                                semua daerah) lalu dikali bobot AHP (y = W × r).
                            </p>
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] sm:grid-cols-5">
                                {result.criteria.map((criterion, index) => (
                                    <div
                                        key={criterion.code}
                                        className="ios-metric-tile p-1.5"
                                    >
                                        <div className="font-bold text-[#facc15]">
                                            {criterion.code}
                                        </div>
                                        <div className="text-slate-400">
                                            W {fixed(result.ahp.weights[index])}
                                        </div>
                                        <div className="font-semibold text-white">
                                            y{' '}
                                            {fixed(alternative.weighted[index])}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Step>

                        <Step
                            number={3}
                            icon={<Target className="h-3.5 w-3.5" />}
                            title="Diranking dengan TOPSIS"
                        >
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[11px] leading-relaxed text-slate-300">
                                Jarak ke solusi ideal positif{' '}
                                <strong className="text-white">
                                    D+ = {fixed(alternative.distance_positive)}
                                </strong>{' '}
                                dan ke solusi ideal negatif{' '}
                                <strong className="text-white">
                                    D− = {fixed(alternative.distance_negative)}
                                </strong>
                                , sehingga
                                <div className="my-1.5 text-center text-sm font-bold text-white">
                                    Vi = D− / (D+ + D−) ={' '}
                                    <span className="text-[#facc15]">
                                        {fixed(alternative.preference)}
                                    </span>
                                </div>
                                Kategori{' '}
                                <strong className="text-white">
                                    {alternative.category}
                                </strong>{' '}
                                ({thresholds}, selain itu Rendah).
                            </div>
                        </Step>

                        <Link
                            href={calculationHref}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#facc15] px-3 py-2 text-xs font-bold text-[#090f1d] transition hover:bg-yellow-300"
                        >
                            <Calculator className="h-3.5 w-3.5" />
                            Lihat perhitungan lengkap AHP-TOPSIS
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
