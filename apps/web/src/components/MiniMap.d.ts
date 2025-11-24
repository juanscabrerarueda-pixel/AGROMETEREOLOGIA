type MiniMapProps = {
    lat?: number;
    lon?: number;
    status: 'calm' | 'warn' | 'alert';
    label?: string;
};
export declare function MiniMap({ lat, lon, status, label }: MiniMapProps): import("react/jsx-runtime").JSX.Element;
export {};
