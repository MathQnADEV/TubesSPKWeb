import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const LOGO_SRC = '/images/logos/logo.webp';

/**
 * Logo aplikasi SPK Mitigasi Banjir Sulawesi Selatan (perisai, peta Sulawesi, grafik, dan gelombang).
 */
export default function AppLogoIcon({
    className,
    alt = 'Logo SPK Mitigasi Banjir Sulawesi Selatan',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src={LOGO_SRC}
            alt={alt}
            draggable={false}
            {...props}
            className={cn('object-contain select-none', className)}
        />
    );
}
