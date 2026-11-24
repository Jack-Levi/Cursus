import os

# Centro de Distribución predeterminado (Estación de Entrega Monterrey Norte / San Nicolás)
DEFAULT_HUB_NAME = "Estación de Entrega DS-MTY1 (Monterrey Norte)"
DEFAULT_HUB_LAT = 25.7250
DEFAULT_HUB_LON = -100.3130

# Parámetros de jornada laboral predeterminados
DEFAULT_SHIFT_HOURS = 8.0          # 8 horas de turno
DEFAULT_SERVICE_TIME_MIN = 12.0     # 12 minutos por entrega de paquete
DEFAULT_RETURN_BUFFER_MIN = 15.0   # Margen de seguridad para regreso al Hub

# Velocidades promedio estimadas por tipo de vía en OSM (km/h)
HIGHWAY_SPEEDS = {
    "motorway": 80.0,
    "trunk": 70.0,
    "primary": 50.0,
    "secondary": 40.0,
    "tertiary": 30.0,
    "residential": 25.0,
    "living_street": 15.0,
    "unclassified": 30.0,
}
DEFAULT_SPEED_KMH = 30.0

# Endpoints públicos para Overpass API (con espejos de respaldo)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Configuración de Nominatim (OSM Geocoding)
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "CursusLogisticsOptimizer/1.0"
