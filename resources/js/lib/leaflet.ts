/**
 * Memuat Leaflet 1.9.4 dari CDN (sama seperti desain index.html) tanpa
 * menambah dependensi npm. Hanya tipe yang dipakai aplikasi yang didefinisikan.
 */

export type LatLngTuple = [number, number];

export type LeafletLayer = {
    addTo(target: LeafletMap | LeafletLayerGroup): LeafletLayer;
};

export type LeafletMarker = LeafletLayer & {
    bindPopup(
        html: string,
        options?: {
            maxWidth?: number;
            autoPanPaddingTopLeft?: LatLngTuple;
            autoPanPaddingBottomRight?: LatLngTuple;
        },
    ): LeafletMarker;
    openPopup(): LeafletMarker;
    on(event: 'click', handler: () => void): LeafletMarker;
};

export type LeafletLayerGroup = {
    addTo(map: LeafletMap): LeafletLayerGroup;
    clearLayers(): LeafletLayerGroup;
};

export type LeafletMap = {
    flyTo(
        center: LatLngTuple,
        zoom: number,
        options?: { duration?: number },
    ): LeafletMap;
    removeLayer(layer: LeafletLayer): LeafletMap;
    invalidateSize(): LeafletMap;
    remove(): void;
};

export type LeafletStatic = {
    map(
        element: HTMLElement,
        options: { center: LatLngTuple; zoom: number; zoomControl: boolean },
    ): LeafletMap;
    tileLayer(
        url: string,
        options: {
            attribution: string;
            maxZoom: number;
            maxNativeZoom?: number;
        },
    ): LeafletLayer;
    layerGroup(): LeafletLayerGroup;
    marker(position: LatLngTuple, options: { icon: unknown }): LeafletMarker;
    divIcon(options: {
        html: string;
        className: string;
        iconSize: LatLngTuple;
        iconAnchor: LatLngTuple;
    }): unknown;
    control: {
        zoom(options: { position: string }): { addTo(map: LeafletMap): void };
    };
};

declare global {
    interface Window {
        L?: LeafletStatic;
    }
}

const LEAFLET_VERSION = '1.9.4';
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let loader: Promise<LeafletStatic> | null = null;

export function loadLeaflet(): Promise<LeafletStatic> {
    if (window.L) {
        return Promise.resolve(window.L);
    }

    if (loader) {
        return loader;
    }

    loader = new Promise<LeafletStatic>((resolve, reject) => {
        if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = CSS_URL;
            document.head.appendChild(link);
        }

        const script = document.createElement('script');
        script.src = JS_URL;
        script.async = true;
        script.onload = () =>
            window.L
                ? resolve(window.L)
                : reject(new Error('Leaflet gagal dimuat.'));
        script.onerror = () => {
            loader = null;
            reject(new Error('Leaflet gagal dimuat.'));
        };
        document.head.appendChild(script);
    });

    return loader;
}
