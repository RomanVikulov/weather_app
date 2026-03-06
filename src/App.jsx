import { useState, useEffect, useCallback } from 'react';
import '../App.css';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
/* ===== WEATHER TRANSLATE ===== */

const translateWeather = (desc) => {
  const map = {
    'clear sky': 'ясно',
    'few clouds': 'малохмарно',
    'scattered clouds': 'хмарно',
    'broken clouds': 'хмарно',
    'overcast clouds': 'суцільна хмарність',

    'light rain': 'невеликий дощ',
    'moderate rain': 'дощ',
    'heavy intensity rain': 'сильний дощ',

    'light snow': 'невеликий сніг',
    snow: 'сніг',
    'heavy snow': 'сильний сніг',

    mist: 'туман',
    fog: 'туман',
  };

  return map[desc] || desc;
};

/* ===== MAP FLY ===== */

function ChangeMapView({ coords }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([coords.lat, coords.lon], 11);
  }, [coords, map]);

  return null;
}

const getWeatherBackground = (weather) => {
  if (!weather) return 'bg-default';

  const main = weather.weather?.[0]?.main?.toLowerCase();

  switch (main) {
    case 'clear':
      return 'bg-sun';
    case 'rain':
    case 'drizzle':
      return 'bg-rain';
    case 'snow':
      return 'bg-snow';
    case 'clouds':
      return 'bg-clouds';
    case 'thunderstorm':
      return 'bg-storm';
    case 'mist':
    case 'fog':
    case 'haze':
      return 'bg-fog';
    default:
      return 'bg-default';
  }
};

const getCardBackground = (weather) => {
  if (!weather) return 'card-default';

  const main = weather.weather?.[0]?.main?.toLowerCase();

  switch (main) {
    case 'clear':
      return 'card-sun';
    case 'clouds':
      return 'card-clouds';
    case 'rain':
    case 'drizzle':
      return 'card-rain';
    case 'snow':
      return 'card-snow';
    case 'thunderstorm':
      return 'card-storm';
    case 'mist':
    case 'fog':
    case 'haze':
      return 'card-fog';
    default:
      return 'card-default';
  }
};

const getFlagEmoji = (countryCode) =>
  countryCode.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));

/* ===== APP ===== */

function App() {
  const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

  const [forecast, setForecast] = useState([]);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [city, setCity] = useState('');
  const [cities, setCities] = useState([]);

  const [placeName, setPlaceName] = useState('');

  const [weather, setWeather] = useState(null);

  const [coords, setCoords] = useState({
    lat: 46.4825,
    lon: 30.7233,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ===== USER GEOLOCATION ===== */

  const loadForecast = useCallback(
    async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`,
        );

        const data = await res.json();

        const daily = data.list.filter((item) => item.dt_txt.includes('12:00:00'));

        setForecast(daily.slice(0, 5));
      } catch (e) {
        console.error('Forecast error', e);
      }
    },
    [API_KEY],
  );

  useEffect(() => {
    setLoading(true);

    if (!navigator.geolocation) {
      setLoading(false);
      setError('Геолокація не підтримується браузером');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setCoords({ lat, lon });

      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=en&appid=${API_KEY}`,
        );

        const data = await res.json();

        setWeather(data);
        setPlaceName(data.name);

        loadForecast(lat, lon);
      } catch (e) {
        console.error(e);
        setError('Не вдалося отримати погоду');
      } finally {
        setLoading(false);
      }
    });
  }, [API_KEY, loadForecast]);

  /* ===== SEARCH WEATHER ===== */

  const getWeather = async () => {
    if (!city.trim()) return;

    setLoading(true);
    setError('');
    setWeather(null);
    setCities([]);
    setPlaceName('');

    try {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${city.trim()}&limit=5&appid=${API_KEY}`,
      );

      const geoData = await geoRes.json();

      if (!geoData.length) {
        throw new Error('City not found');
      }

      if (geoData.length === 1) {
        await selectCity(geoData[0]);
        return;
      }

      setCities(geoData);
    } catch (err) {
      console.error(err);
      setError('Місто не знайдено');
    }

    setLoading(false);
  };

  /* ===== SELECT CITY FROM LIST ===== */

  const selectCity = async (c) => {
    setLoading(true);
    setCities([]);
    setCity(`${c.name}, ${c.country}`);
    setPlaceName(`${c.name}${c.state ? `, ${c.state}` : ''}, ${c.country}`);

    setCoords({
      lat: c.lat,
      lon: c.lon,
    });

    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&units=metric&lang=en&appid=${API_KEY}`,
      );

      if (!res.ok) throw new Error('Weather API error');

      const data = await res.json();

      setWeather(data);
      loadForecast(c.lat, c.lon);
    } catch (e) {
      console.error(e);
      setError('Не вдалося отримати погоду');
    }

    setLoading(false);
  };

  /* ===== USER LOCATION BUTTON ===== */

  const getUserLocation = () => {
    setLoading(true);
    setError('');
    setCities([]);
    setCity('');

    if (!navigator.geolocation) {
      setLoading(false);
      setError('Геолокація не підтримується браузером');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          setCoords({ lat, lon });

          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=en&appid=${API_KEY}`,
          );

          if (!res.ok) {
            throw new Error(`Weather error: ${res.status}`);
          }

          const data = await res.json();

          setWeather(data);
          loadForecast(lat, lon);
          // ✔ теперь data существует
          setPlaceName(data.name);
        } catch (e) {
          console.error(e);
          setError('Не вдалося отримати погоду для вашої локації');
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        console.log('Geolocation error:', geoErr);

        if (geoErr.code === 1) setError('Доступ до геолокації заборонено (дозвольте в браузері)');
        else if (geoErr.code === 2) setError('Не вдалося визначити місцезнаходження');
        else if (geoErr.code === 3) setError('Геолокація: таймаут. Спробуйте ще раз');
        else setError('Помилка геолокації');

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      },
    );
  };

  /* ===== UI ===== */

  return (
    <div className={`app ${getWeatherBackground(weather)}`}>
      <h1>Weather Card</h1>

      <div className="search">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔎 Введіть місто"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                getWeather();
              }
            }}
          />

          {cities.length > 0 && (
            <div className="city-list">
              {cities.map((c) => (
                <div key={`${c.lat}-${c.lon}-${c.name}`} className="city-item" onClick={() => selectCity(c)}>
                  {c.name}
                  {c.state ? `, ${c.state}` : ''} {getFlagEmoji(c.country)}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={getWeather}>🌤 Показати</button>

        <button onClick={getUserLocation}>📍 Де я</button>
      </div>

      {loading && <div className="loader"></div>}

      {error && <p className="error">{error}</p>}

      {/* ===== CONTENT ===== */}

      {forecast.length > 0 && (
        <div className="forecast">
          {forecast.map((day) => {
            const date = new Date(day.dt * 1000);

            return (
              <div className="forecast-day" key={day.dt}>
                <div className="forecast-name">{days[date.getDay()]}</div>

                <img src={`https://openweathermap.org/img/wn/${day.weather[0].icon}.png`} alt="" />

                <div className="forecast-temp">{Math.round(day.main.temp)}°</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="content">
        {weather && (
          <div className={`card ${getCardBackground(weather)}`}>
            <h2>📍 {placeName}</h2>

            <div className="weather-main">
  <img
    className="weather-icon"
    src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
    alt="weather icon"
  />

  <div className="temp-block">
    <div className="temp">{Math.round(weather.main.temp)}°C</div>

    <div className="temp-range">
<span className="temp-min">🌙 {Math.round(weather.main.temp_min)}°</span>
<span className="temp-max">☀️ {Math.round(weather.main.temp_max)}°</span>
    </div>
  </div>
</div>

            <p className="description">{translateWeather(weather.weather[0].description)}</p>

            <div className="details">
              <div className="detail">
                <span>💧</span>
                <p>{weather.main.humidity}%</p>
              </div>

              <div className="detail">
                <span>🌬</span>
                <p>{weather.wind.speed} m/s</p>
              </div>
            </div>
          </div>
        )}

        <div className="map">
          <MapContainer
            center={[coords.lat, coords.lon]}
            zoom={11}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <ChangeMapView coords={coords} />

            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <Marker position={[coords.lat, coords.lon]}>
              <Popup>📍 {placeName || 'Ваша локація'}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
