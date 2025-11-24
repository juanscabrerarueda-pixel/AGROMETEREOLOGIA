import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const DEFAULT_CENTER = { lat: 4.711, lon: -74.072 };
export function MiniMap({ lat, lon, status, label }) {
    const centerLat = Number.isFinite(lat) ? lat : DEFAULT_CENTER.lat;
    const centerLon = Number.isFinite(lon) ? lon : DEFAULT_CENTER.lon;
    const zoom = 5;
    const tile = latLonToTile(centerLat, centerLon, zoom);
    const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;
    const statusLabel = status === 'alert' ? 'Estado crítico' : status === 'warn' ? 'Latencia moderada' : 'En tiempo';
    return (_jsxs("div", { className: `mini-map ${status}`, children: [_jsx("div", { className: "mini-map-image", style: { backgroundImage: `url(${tileUrl})` }, children: _jsx("span", { className: "mini-map-dot" }) }), _jsxs("div", { className: "mini-map-meta", children: [_jsx("span", { className: "tiny", children: label ?? 'Estación actual' }), _jsxs("strong", { children: [centerLat.toFixed(2), "\u00B0, ", centerLon.toFixed(2), "\u00B0"] }), _jsx("p", { className: "muted tiny", children: statusLabel })] })] }));
}
function latLonToTile(latitude, longitude, zoom) {
    const latRad = (latitude * Math.PI) / 180;
    const n = 2 ** zoom;
    return {
        x: Math.floor(((longitude + 180) / 360) * n),
        y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
    };
}
//# sourceMappingURL=MiniMap.js.map