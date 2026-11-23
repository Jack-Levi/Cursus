import requests
from typing import Optional, Dict, Any, Tuple
from app.config import NOMINATIM_URL, USER_AGENT

# Caché en memoria para evitar llamadas redundantes a OSM
_GEOCODE_CACHE: Dict[str, Tuple[float, float, str]] = {}
_REVERSE_CACHE: Dict[str, str] = {}

def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """Convierte una dirección de texto a coordenadas (lat, lon) usando Nominatim."""
    clean_addr = address.strip()
    if not clean_addr:
        return None

    if clean_addr in _GEOCODE_CACHE:
        lat, lon, display = _GEOCODE_CACHE[clean_addr]
        return {"lat": lat, "lon": lon, "display_name": display}

    headers = {"User-Agent": USER_AGENT}
    params = {
        "q": clean_addr,
        "format": "json",
        "limit": 1,
        "addressdetails": 1
    }

    try:
        response = requests.get(f"{NOMINATIM_URL}/search", params=params, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                item = data[0]
                lat = float(item["lat"])
                lon = float(item["lon"])
                display = item.get("display_name", clean_addr)
                _GEOCODE_CACHE[clean_addr] = (lat, lon, display)
                return {"lat": lat, "lon": lon, "display_name": display}
    except Exception as e:
        print(f"[Geocoding Error] Error consultando Nominatim: {e}")

    return None

def reverse_geocode(lat: float, lon: float) -> str:
    """Obtiene el nombre de la dirección o calle a partir de coordenadas."""
    key = f"{round(lat, 5)},{round(lon, 5)}"
    if key in _REVERSE_CACHE:
        return _REVERSE_CACHE[key]

    headers = {"User-Agent": USER_AGENT}
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 17,
        "addressdetails": 1
    }

    try:
        response = requests.get(f"{NOMINATIM_URL}/reverse", params=params, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            display = data.get("display_name", f"{lat:.5f}, {lon:.5f}")
            _REVERSE_CACHE[key] = display
            return display
    except Exception as e:
        print(f"[Reverse Geocoding Error] {e}")

    return f"Punto ({lat:.4f}, {lon:.4f})"
