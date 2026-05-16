import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { SavedTrack } from '@/lib/database';
import { RaceEvent } from '@/components/race/RaceCalendar';
import RaceDayWeatherCard from '@/components/race/RaceDayWeatherCard';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MapPin,
  Mountain,
  Calendar,
  Trophy,
  Timer,
  Gauge,
  Loader2,
  RefreshCw,
  X,
  Star,
  AlertCircle,
  Cloud,
  Flag,
  Navigation as NavigationIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// TrackMapView — interactive Leaflet map of all saved tracks
// ═══════════════════════════════════════════════════════════════════════
// • Loads Leaflet JS + CSS from CDN on mount (no npm install required)
// • Pins every saved_track using its street address + elevation
// • Tracks without cached lat/lon are geocoded via the
//   `lookup-track-elevation` edge function (which returns lat/lon as a
//   byproduct of geocoding Photon / Nominatim)
// • Click a pin → right-hand sidebar shows:
//     - Track details (elevation, address, total visits)
//     - Upcoming events AT THAT TRACK
//     - Last race results AT THAT TRACK
//     - One-click "Fetch Race-Day Weather" button that uses the track's
//       actual GPS coords (falls back to city/state if coords missing)
// ═══════════════════════════════════════════════════════════════════════

// Leaflet CDN assets — pinned version for stability
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Session-storage key for caching geocoded lat/lon per track (avoids hammering the edge fn)
const GEO_CACHE_KEY = 'raceCalendar_trackGeocache_v1';

interface GeoCoord {
  lat: number;
  lon: number;
  geocodedAt: number;
}

type GeoCache = Record<string, GeoCoord>;

const loadGeoCache = (): GeoCache => {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveGeoCache = (cache: GeoCache) => {
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
};

// ── Leaflet loader (singleton promise) ──────────────────────────────────
let leafletPromise: Promise<any> | null = null;

const loadLeaflet = (): Promise<any> => {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    // CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // JS
    const existingScript = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).L));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Leaflet')));
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.crossOrigin = '';
    script.onload = () => {
      if ((window as any).L) {
        resolve((window as any).L);
      } else {
        reject(new Error('Leaflet loaded but window.L is undefined'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet script'));
    document.head.appendChild(script);
  });

  return leafletPromise;
};

interface TrackMapViewProps {
  savedTracks: SavedTrack[];
  raceEvents: RaceEvent[];
  onSelectEvent?: (event: RaceEvent) => void;
}

const TrackMapView: React.FC<TrackMapViewProps> = ({ savedTracks, raceEvents, onSelectEvent }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [leafletError, setLeafletError] = useState<string | null>(null);

  const [geoCache, setGeoCache] = useState<GeoCache>(() => loadGeoCache());
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number } | null>(null);

  const [selectedTrack, setSelectedTrack] = useState<SavedTrack | null>(null);
  const [showWeather, setShowWeather] = useState(false);

  // Tracks that need geocoding (missing lat/lon in cache) — memoized
  const tracksNeedingGeocode = useMemo(() => {
    return savedTracks.filter(t => !geoCache[t.id]);
  }, [savedTracks, geoCache]);

  // Tracks that have coords available (either cached or — future — stored on the track)
  const tracksWithCoords = useMemo(() => {
    return savedTracks
      .map(t => {
        const coord = geoCache[t.id];
        return coord ? { track: t, lat: coord.lat, lon: coord.lon } : null;
      })
      .filter((x): x is { track: SavedTrack; lat: number; lon: number } => x !== null);
  }, [savedTracks, geoCache]);

  // ── Step 1: Load Leaflet from CDN ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(L => {
        if (cancelled) return;
        leafletRef.current = L;
        setLeafletReady(true);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[TrackMapView] Leaflet load failed:', err);
        setLeafletError(err.message || 'Failed to load map library');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 2: Geocode any tracks that don't have cached coords ────────
  const geocodeTrack = useCallback(async (track: SavedTrack): Promise<GeoCoord | null> => {
    const query = track.address?.trim() || track.zip?.trim() || track.location?.trim();
    if (!query && !track.name) return null;

    try {
      const { data, error } = await supabase.functions.invoke('lookup-track-elevation', {
        body: {
          location: query || track.location,
          trackName: track.name,
        },
      });
      if (error) {
        console.warn(`[TrackMapView] Geocode failed for ${track.name}:`, error);
        return null;
      }
      if (data?.success && typeof data.lat === 'number' && typeof data.lon === 'number') {
        return { lat: data.lat, lon: data.lon, geocodedAt: Date.now() };
      }
      // Even non-success responses often include lat/lon from the geocoder
      if (typeof data?.lat === 'number' && typeof data?.lon === 'number') {
        return { lat: data.lat, lon: data.lon, geocodedAt: Date.now() };
      }
      return null;
    } catch (err) {
      console.warn(`[TrackMapView] Geocode exception for ${track.name}:`, err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (tracksNeedingGeocode.length === 0) return;
    if (isGeocoding) return;

    let cancelled = false;
    const run = async () => {
      setIsGeocoding(true);
      setGeocodeProgress({ done: 0, total: tracksNeedingGeocode.length });
      const newCache: GeoCache = { ...geoCache };
      let done = 0;

      for (const t of tracksNeedingGeocode) {
        if (cancelled) break;
        const coord = await geocodeTrack(t);
        done += 1;
        if (coord) {
          newCache[t.id] = coord;
          // Update cache + state progressively so pins appear as they resolve
          saveGeoCache(newCache);
          setGeoCache({ ...newCache });
        }
        setGeocodeProgress({ done, total: tracksNeedingGeocode.length });
      }

      if (!cancelled) {
        setIsGeocoding(false);
        setGeocodeProgress(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracksNeedingGeocode.length]);

  // ── Step 3: Initialize the Leaflet map ──────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = leafletRef.current;
    if (!L) return;

    // Default center: continental US
    const map = L.map(mapContainerRef.current, {
      center: [39.5, -98.35],
      zoom: 4,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Force resize so the map fills its container even when flexbox changes
    setTimeout(() => {
      try { map.invalidateSize(); } catch {}
    }, 100);

    return () => {
      try { map.remove(); } catch {}
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [leafletReady]);

  // ── Step 4: Update markers whenever tracks or coords change ─────────
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const L = leafletRef.current;
    if (!L) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    // Orange drop-pin icon using an inline SVG data URL so we don't rely on
    // Leaflet's default image assets (which fail on CDN-only setups).
    const pinSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <defs>
          <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#f97316" filter="url(#s)"/>
        <circle cx="16" cy="16" r="6" fill="#fff"/>
      </svg>`
    );
    const favPinSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <defs>
          <filter id="sf" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#eab308" filter="url(#sf)"/>
        <path d="M16 8l2.3 4.7 5.2.7-3.8 3.6.9 5.1L16 19.8 11.4 22.1l.9-5.1-3.8-3.6 5.2-.7L16 8z" fill="#fff"/>
      </svg>`
    );

    const pinIcon = L.icon({
      iconUrl: `data:image/svg+xml,${pinSvg}`,
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -40],
    });
    const favPinIcon = L.icon({
      iconUrl: `data:image/svg+xml,${favPinSvg}`,
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -40],
    });

    const bounds: any[] = [];

    tracksWithCoords.forEach(({ track, lat, lon }) => {
      const icon = track.isFavorite ? favPinIcon : pinIcon;
      const marker = L.marker([lat, lon], { icon });

      const upcomingCount = raceEvents.filter(
        e => e.trackName?.toLowerCase() === track.name.toLowerCase()
          && e.startDate >= getLocalDateString()
          && e.status !== 'Cancelled'
      ).length;

      const popupHtml = `
        <div style="min-width:180px;font-family:system-ui,-apple-system,sans-serif">
          <div style="font-weight:600;font-size:14px;color:#111;margin-bottom:4px;">
            ${track.isFavorite ? '★ ' : ''}${escapeHtml(track.name)}
          </div>
          <div style="font-size:12px;color:#555;margin-bottom:2px">${escapeHtml(track.location || '')}</div>
          ${track.elevation ? `<div style="font-size:12px;color:#555;margin-bottom:2px">Elev: ${track.elevation.toLocaleString()} ft</div>` : ''}
          ${upcomingCount > 0 ? `<div style="font-size:12px;color:#f97316;font-weight:600;margin-top:4px">${upcomingCount} upcoming event${upcomingCount !== 1 ? 's' : ''}</div>` : ''}
          <div style="font-size:11px;color:#888;margin-top:4px">Click pin for full details</div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setSelectedTrack(track);
        setShowWeather(false);
      });
      marker.addTo(layer);
      bounds.push([lat, lon]);
    });

    // Fit map to markers if we have any
    if (bounds.length > 0) {
      try {
        if (bounds.length === 1) {
          map.setView(bounds[0], 9);
        } else {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        }
      } catch (err) {
        console.warn('[TrackMapView] fitBounds failed:', err);
      }
    }
  }, [tracksWithCoords, raceEvents]);

  // ── Re-invalidate size when the container becomes visible ───────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const t = setTimeout(() => {
      try { mapInstanceRef.current.invalidateSize(); } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [leafletReady, savedTracks.length]);

  // ── Helpers for the sidebar ─────────────────────────────────────────
  const upcomingForTrack = useMemo(() => {
    if (!selectedTrack) return [];
    const today = getLocalDateString();
    return raceEvents
      .filter(e => e.trackName?.toLowerCase() === selectedTrack.name.toLowerCase())
      .filter(e => e.startDate >= today && e.status !== 'Cancelled')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
  }, [raceEvents, selectedTrack]);

  const pastResultsForTrack = useMemo(() => {
    if (!selectedTrack) return [];
    const today = getLocalDateString();
    return raceEvents
      .filter(e => e.trackName?.toLowerCase() === selectedTrack.name.toLowerCase())
      .filter(e => e.startDate < today || e.status === 'Completed')
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 5);
  }, [raceEvents, selectedTrack]);

  // Re-geocode one track manually (used by "Retry" button)
  const handleRetryGeocode = async (track: SavedTrack) => {
    toast.info(`Looking up coordinates for ${track.name}...`);
    const coord = await geocodeTrack(track);
    if (coord) {
      const newCache = { ...geoCache, [track.id]: coord };
      saveGeoCache(newCache);
      setGeoCache(newCache);
      toast.success(`Pinned ${track.name} on map`);
    } else {
      toast.error(`Could not geocode ${track.name}`, {
        description: 'Add a more specific address or ZIP code in Initial Setup.',
      });
    }
  };

  const selectedCoord = selectedTrack ? geoCache[selectedTrack.id] : null;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Map column ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          {/* Map header */}
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg font-semibold text-white">Track Map</h3>
              <span className="text-xs text-slate-500">
                ({tracksWithCoords.length} of {savedTracks.length} pinned)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {isGeocoding && geocodeProgress && (
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Geocoding {geocodeProgress.done}/{geocodeProgress.total}…
                </span>
              )}
              <span className="flex items-center gap-1 text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" /> Saved
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" /> Favorite
              </span>
            </div>
          </div>

          {/* Map body */}
          <div className="relative" style={{ height: '560px' }}>
            {leafletError ? (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-center p-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-red-400 font-medium">Could not load map library</p>
                <p className="text-slate-400 text-sm">{leafletError}</p>
                <p className="text-slate-500 text-xs">Check your internet connection and refresh.</p>
              </div>
            ) : !leafletReady ? (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-slate-400 text-sm">Loading map…</p>
              </div>
            ) : savedTracks.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-center p-4">
                <MapPin className="w-10 h-10 text-slate-600" />
                <p className="text-slate-400">No saved tracks yet</p>
                <p className="text-slate-500 text-xs">Add tracks via Initial Setup → Racetracks, or save a track when adding an event.</p>
              </div>
            ) : null}

            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={{ background: '#0f172a' }}
            />
          </div>

          {/* Tracks without coords notice */}
          {leafletReady && tracksNeedingGeocode.length > 0 && !isGeocoding && (
            <div className="px-4 py-2 bg-yellow-500/10 border-t border-yellow-500/20 text-xs text-yellow-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {tracksNeedingGeocode.length} track{tracksNeedingGeocode.length !== 1 ? 's' : ''} couldn't be geocoded automatically. Add a street address or ZIP code for best results.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar column ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {!selectedTrack ? (
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 text-center">
            <NavigationIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium mb-1">Select a track</p>
            <p className="text-slate-500 text-sm">Click any pin on the map to see upcoming events, past results, and race-day weather.</p>
          </div>
        ) : (
          <>
            {/* Selected track card */}
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-1.5 flex-wrap">
                    {selectedTrack.isFavorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                    <span className="truncate">{selectedTrack.name}</span>
                  </h3>
                  <p className="text-sm text-slate-400 mt-0.5">{selectedTrack.location}</p>
                </div>
                <button
                  onClick={() => { setSelectedTrack(null); setShowWeather(false); }}
                  className="text-slate-400 hover:text-white flex-shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                {selectedTrack.address && (
                  <div className="flex items-start gap-2 text-slate-300">
                    <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{selectedTrack.address}</span>
                  </div>
                )}
                {selectedTrack.elevation ? (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mountain className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span>{selectedTrack.elevation.toLocaleString()} ft elevation</span>
                  </div>
                ) : null}
                {selectedTrack.trackLength && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Flag className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span>{selectedTrack.trackLength} · {selectedTrack.surfaceType || 'Concrete'}</span>
                  </div>
                )}
                {selectedTrack.visitCount > 0 && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Visited {selectedTrack.visitCount} time{selectedTrack.visitCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {selectedCoord && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                    <NavigationIcon className="w-3 h-3" />
                    {selectedCoord.lat.toFixed(5)}, {selectedCoord.lon.toFixed(5)}
                  </div>
                )}
              </div>

              {/* Fetch Race-Day Weather button */}
              <button
                onClick={() => setShowWeather(v => !v)}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-700 transition-all"
              >
                <Cloud className="w-4 h-4" />
                {showWeather ? 'Hide Race-Day Weather' : 'Fetch Race-Day Weather'}
              </button>

              {/* If we don't have coords yet, offer a retry */}
              {!selectedCoord && (
                <button
                  onClick={() => handleRetryGeocode(selectedTrack)}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry lookup
                </button>
              )}
            </div>

            {/* Race-day weather (uses nearest upcoming event date, or today) */}
            {showWeather && (
              <RaceDayWeatherCard
                trackName={selectedTrack.name}
                trackLocation={
                  // Prefer precise GPS coords when available — RaceDayWeatherCard's
                  // underlying fetchRaceDayForecast accepts "lat,lon" as a location
                  // string and routes it through geocoders that pass numeric input through.
                  selectedCoord
                    ? `${selectedCoord.lat.toFixed(5)},${selectedCoord.lon.toFixed(5)}`
                    : selectedTrack.location
                }
                eventDate={
                  upcomingForTrack[0]?.startDate || getLocalDateString()
                }
                eventTitle={upcomingForTrack[0]?.title || `${selectedTrack.name} — Track Weather`}
                trackElevation={selectedTrack.elevation || 0}
              />
            )}

            {/* Upcoming events at this track */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-400" />
                Upcoming Events
                {upcomingForTrack.length > 0 && (
                  <span className="text-xs text-slate-500">({upcomingForTrack.length})</span>
                )}
              </h4>
              {upcomingForTrack.length === 0 ? (
                <p className="text-slate-500 text-xs">No upcoming events at this track</p>
              ) : (
                <div className="space-y-2">
                  {upcomingForTrack.map(evt => (
                    <button
                      key={evt.id}
                      onClick={() => onSelectEvent?.(evt)}
                      className="w-full text-left p-2.5 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white text-sm font-medium truncate group-hover:text-orange-400">
                          {evt.title}
                        </span>
                        {evt.sanctioningBody && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex-shrink-0">
                            {evt.sanctioningBody}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {evt.startDate}
                        {evt.endDate && evt.endDate !== evt.startDate && ` → ${evt.endDate}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Past results at this track */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                Last Race Results
              </h4>
              {pastResultsForTrack.length === 0 ? (
                <p className="text-slate-500 text-xs">No previous races at this track</p>
              ) : (
                <div className="space-y-2">
                  {pastResultsForTrack.map(evt => (
                    <button
                      key={evt.id}
                      onClick={() => onSelectEvent?.(evt)}
                      className="w-full text-left p-2.5 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-white text-sm font-medium truncate group-hover:text-orange-400">
                          {evt.title}
                        </span>
                        {evt.result && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                            evt.result === 'Win'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {evt.result}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {evt.startDate}
                        </span>
                        {evt.bestET && (
                          <span className="flex items-center gap-1 text-green-400 font-mono">
                            <Timer className="w-3 h-3" />
                            {evt.bestET.toFixed(3)}
                          </span>
                        )}
                        {evt.bestMPH && (
                          <span className="flex items-center gap-1 text-blue-400 font-mono">
                            <Gauge className="w-3 h-3" />
                            {evt.bestMPH.toFixed(1)} mph
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Utility: HTML escape for popup content ─────────────────────────────
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default TrackMapView;
