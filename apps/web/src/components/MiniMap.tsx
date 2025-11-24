type MiniMapProps = {
  lat?: number;
  lon?: number;
  status: 'calm' | 'warn' | 'alert';
  label?: string;
};

const DEFAULT_CENTER = { lat: 4.711, lon: -74.072 };

export function MiniMap({ lat, lon, status, label }: MiniMapProps) {
  const centerLat = Number.isFinite(lat) ? (lat as number) : DEFAULT_CENTER.lat;
  const centerLon = Number.isFinite(lon) ? (lon as number) : DEFAULT_CENTER.lon;
  const zoom = 5;
  const tile = latLonToTile(centerLat, centerLon, zoom);
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`;
  const statusLabel =
    status === 'alert' ? 'Estado crítico' : status === 'warn' ? 'Latencia moderada' : 'En tiempo';

  return (
    <div className={`mini-map ${status}`}>
      <div className="mini-map-image" style={{ backgroundImage: `url(${tileUrl})` }}>
        <span className="mini-map-dot" />
      </div>
      <div className="mini-map-meta">
        <span className="tiny">{label ?? 'Estación actual'}</span>
        <strong>
          {centerLat.toFixed(2)}°, {centerLon.toFixed(2)}°
        </strong>
        <p className="muted tiny">{statusLabel}</p>
      </div>
    </div>
  );
}

function latLonToTile(latitude: number, longitude: number, zoom: number) {
  const latRad = (latitude * Math.PI) / 180;
  const n = 2 ** zoom;
  return {
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
  };
}
