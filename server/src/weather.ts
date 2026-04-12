import type { Weather } from "@dad-golf/shared";

const OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "dad-golf/1.0";

// In-memory cache: key = "lat,lng" → { data, fetchedAt }
const weatherCache = new Map<string, { data: Weather; fetchedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

function parseNominatimResult(r: NominatimResult): GeocodingResult | null {
  const latitude = parseFloat(r.lat);
  const longitude = parseFloat(r.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const fallbackName = r.display_name.split(",")[0]?.trim() || r.display_name;
  return {
    latitude,
    longitude,
    name: r.name?.trim() || fallbackName,
    displayName: r.display_name,
  };
}

export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "au",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
  });
  if (!res.ok) throw new Error("geocoding service unavailable");
  const data = (await res.json()) as NominatimResult[];
  if (data.length === 0) return null;
  return parseNominatimResult(data[0]);
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "au",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
  });
  if (!res.ok) throw new Error("geocoding service unavailable");
  const data = (await res.json()) as NominatimResult[];
  const results: GeocodingResult[] = [];
  for (const r of data) {
    const parsed = parseNominatimResult(r);
    if (parsed) results.push(parsed);
  }
  return results;
}

export async function fetchWeather(latitude: number, longitude: number): Promise<Weather | null> {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });

  let res: Response;
  try {
    res = await fetch(`${OPEN_METEO_WEATHER_URL}?${params}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
      weather_code: number;
      is_day: number;
    };
  };

  const c = data.current;
  const weather: Weather = {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    weatherCode: c.weather_code,
    isDay: c.is_day === 1,
  };

  weatherCache.set(cacheKey, { data: weather, fetchedAt: Date.now() });
  return weather;
}
