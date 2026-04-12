import { useCallback, useEffect, useState } from "react";
import type { Weather } from "@dad-golf/shared";
import { api } from "../api.js";

type Props =
  | { roomCode: string; courseId?: undefined; courseLocation: string | null }
  | { roomCode?: undefined; courseId: string; courseLocation: string | null };

/** Map WMO weather codes to a label and a simple text icon. */
function weatherLabel(code: number, isDay: boolean): { label: string; icon: string } {
  // WMO Weather interpretation codes (WW)
  // https://open-meteo.com/en/docs
  if (code === 0) return { label: "Clear", icon: isDay ? "\u2600" : "\u263E" }; // ☀ ☾
  if (code <= 2) return { label: "Partly cloudy", icon: isDay ? "\u26C5" : "\u2601" }; // ⛅ ☁
  if (code === 3) return { label: "Overcast", icon: "\u2601" }; // ☁
  if (code <= 48) return { label: "Fog", icon: "\u2601" }; // ☁
  if (code <= 57) return { label: "Drizzle", icon: "\u{1F327}" }; // 🌧
  if (code <= 67) return { label: "Rain", icon: "\u{1F327}" }; // 🌧
  if (code <= 77) return { label: "Snow", icon: "\u{1F328}" }; // 🌨
  if (code <= 82) return { label: "Showers", icon: "\u{1F326}" }; // 🌦
  if (code <= 86) return { label: "Snow showers", icon: "\u{1F328}" }; // 🌨
  if (code <= 99) return { label: "Thunderstorm", icon: "\u26C8" }; // ⛈
  return { label: "Unknown", icon: "\u2601" };
}

function windCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function WeatherWidget({ roomCode, courseId, courseLocation }: Props) {
  const [weather, setWeather] = useState<Weather | null>(null);

  const fetchWeather = useCallback(() => {
    const promise = roomCode ? api.getRoundWeather(roomCode) : api.getCourseWeather(courseId!);
    return promise.then((res) => res.weather);
  }, [roomCode, courseId]);

  useEffect(() => {
    let cancelled = false;
    fetchWeather()
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchWeather]);

  // Refresh every 15 minutes
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(
      () => {
        fetchWeather()
          .then((w) => {
            if (!cancelled) setWeather(w);
          })
          .catch(() => {});
      },
      15 * 60 * 1000,
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchWeather]);

  if (!weather) return null;

  const { label, icon } = weatherLabel(weather.weatherCode, weather.isDay);

  return (
    <div className="weather-widget" title={`Weather at ${courseLocation ?? "course"}`}>
      <span className="weather-icon">{icon}</span>
      <div className="weather-details">
        <span className="weather-temp">{Math.round(weather.temperature)}°C</span>
        <span className="weather-desc">{label}</span>
        <span className="weather-wind">
          {Math.round(weather.windSpeed)} km/h {windCompass(weather.windDirection)}
        </span>
      </div>
    </div>
  );
}
