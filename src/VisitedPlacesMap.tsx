import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";

// Add custom styles for the map
const mapStyles = `
  .leaflet-div-icon {
    background: transparent !important;
    border: none !important;
  }
  .custom-marker-pin {
    background: transparent !important;
    border: none !important;
  }
  .leaflet-container {
    background: #f8fafc;
  }
  .dark .leaflet-container {
    background: #0f172a;
  }
`;

// Fix default marker icons (Vite/Webpack) - create custom icon
const createCustomIcon = (index: number) => {
  return L.divIcon({
    className: 'custom-marker-pin',
    html: `<div class="marker-pin-${index}" style="
      width: 16px;
      height: 16px;
      background: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      position: relative;
      z-index: 1000;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// --- your visited places
type Visit = { city: string; country: string; date: string; lat: number; lng: number };

const VISITS: Visit[] = [
  { city: "Gramado",        country: "Brazil",       date: "2021", lat: -29.4,      lng: -50.867 },
  { city: "Campo Grande",   country: "Brazil",       date: "2022", lat: -20.469,    lng: -54.62 },
  { city: "Dhaka",          country: "Bangladesh",   date: "2022", lat: 23.8103,    lng: 90.4125 },
  { city: "Luxor",          country: "Egypt",        date: "2024", lat: 25.6872,    lng: 32.6396 },
  { city: "Chapecó",        country: "Brazil",       date: "2023", lat: -27.1,      lng: -52.615 },
  { city: "Guadalajara",    country: "Mexico",       date: "2024", lat: 20.67667,   lng: -103.34750 },
  { city: "Astana",         country: "Kazakhstan",   date: "2024", lat: 51.1694,    lng: 71.4491 },
  { city: "Salvador",       country: "Brazil",       date: "2025", lat: -12.9777,   lng: -38.5016 },
  { city: "João Pessoa",    country: "Brazil",       date: "2024", lat: -7.1195,    lng: -34.845 },
  { city: "Baku",           country: "Azerbaijan",   date: "2025", lat: 40.4093,    lng: 49.8671 },
  { city: "Washington, D.C.", country: "USA",       date: "2024", lat: 38.9072,    lng: -77.0369 },
  { city: "Campinas",       country: "Brazil",       date: "2020", lat: -22.9056,   lng: -47.0608 },
];

// Fit the map to markers once they exist
function FitToMarkers({ points }: { points: Visit[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { 
      padding: [20, 20], 
      maxZoom: 6 
    });
  }, [map, points]);
  return null;
}

// Invalidate size on mount + container resize (prevents “half‑loaded” tiles)
function AutoResize() {
  const map = useMap();
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    containerRef.current = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    if (containerRef.current) ro.observe(containerRef.current);

    const t1 = setTimeout(() => map.invalidateSize(false), 0);
    const t2 = setTimeout(() => map.invalidateSize(false), 250);
    const onWin = () => map.invalidateSize(false);
    window.addEventListener("resize", onWin);

    return () => {
      window.removeEventListener("resize", onWin);
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map]);

  return null;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/50">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}

export default function CuriosityMap() {
  const stats = useMemo(() => {
    const cities = VISITS.length;
    const countries = new Set(VISITS.map(v => v.country)).size;
    const years = VISITS.map(v => Number(v.date)).filter(n => !Number.isNaN(n));
    const first = Math.min(...years);
    const last = Math.max(...years);
    return { cities, countries, first, last };
  }, []);

  // Add styles to head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = mapStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fallback center; bounds will override after mount
  const center: LatLngExpression = [15, 0];

  return (
    <section id="curiosity" className="scroll-mt-24 py-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Curiosity</h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Places I’ve visited through competitions
        </span>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/40 p-4 shadow-sm sm:grid-cols-4">
        <Stat label="Countries" value={stats.countries} />
        <Stat label="Cities" value={stats.cities} />
        <Stat label="First trip" value={stats.first} />
        <Stat label="Latest trip" value={stats.last} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
        <MapContainer
          className="h-[420px] w-full"
          center={center}
          zoom={2}
          minZoom={1}
          maxZoom={10}
          scrollWheelZoom={false}
          worldCopyJump={false}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AutoResize />
          <FitToMarkers points={VISITS} />
          {VISITS.map((v, index) => (
            <Marker key={`${v.city}-${v.date}`} position={[v.lat, v.lng]} icon={createCustomIcon(index)}>
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div className="text-sm">
                  <div className="font-semibold">{v.city}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    {v.country} · {v.date}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
