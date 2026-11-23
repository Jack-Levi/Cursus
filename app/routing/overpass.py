import math
import requests
from typing import Dict, Any, List, Tuple, Optional
from app.config import OVERPASS_ENDPOINTS, HIGHWAY_SPEEDS, DEFAULT_SPEED_KMH

def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia ortodrómica en metros entre dos coordenadas."""
    r = 6371000.0  # Radio terrestre en metros
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

def calculate_bounding_box(coords: List[Tuple[float, float]], buffer_deg: float = 0.025) -> Tuple[float, float, float, float]:
    """Calcula (min_lat, min_lon, max_lat, max_lon) con un margen de seguridad."""
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return (
        min(lats) - buffer_deg,
        min(lons) - buffer_deg,
        max(lats) + buffer_deg,
        max(lons) + buffer_deg
    )

def fetch_street_network(coords: List[Tuple[float, float]]) -> Optional[Dict[str, Any]]:
    """Consulta Overpass API para obtener las vías vehiculares dentro del área de interés."""
    min_lat, min_lon, max_lat, max_lon = calculate_bounding_box(coords)

    # Consulta Overpass QL para calles y avenidas transitables
    query = f"""
    [out:json][timeout:20];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street"]
        ({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = requests.post(endpoint, data={"data": query}, timeout=12)
            if response.status_code == 200:
                data = response.json()
                if "elements" in data and len(data["elements"]) > 0:
                    return data
        except Exception as e:
            print(f"[Overpass Warning] Servidor {endpoint} no respondió: {e}. Probando respaldo...")

    print("[Overpass Warning] Ningún servidor Overpass respondió a tiempo. Se activará el estimador vial robusto.")
    return None
