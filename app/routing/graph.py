import math
import networkx as nx
from typing import Dict, Any, List, Tuple, Optional
from app.routing.overpass import haversine_distance_m, fetch_street_network
from app.config import HIGHWAY_SPEEDS, DEFAULT_SPEED_KMH

class RoadNetwork:
    """Administra el grafo vial de OpenStreetMap y el cálculo de distancias/tiempos con Dijkstra."""

    def __init__(self):
        self.graph = nx.DiGraph()
        self.node_coords: Dict[int, Tuple[float, float]] = {}

    def build_from_overpass(self, overpass_data: Dict[str, Any]):
        """Construye un grafo dirigido a partir de los elementos devueltos por Overpass API."""
        self.graph.clear()
        self.node_coords.clear()

        elements = overpass_data.get("elements", [])
        ways = []

        # Paso 1: Indexar nodos geográficos
        for el in elements:
            if el["type"] == "node":
                nid = el["id"]
                self.node_coords[nid] = (el["lat"], el["lon"])

        # Paso 2: Procesar vías y sentidos de circulación
        for el in elements:
            if el["type"] == "way":
                ways.append(el)

        for way in ways:
            nodes = way.get("nodes", [])
            tags = way.get("tags", {})
            highway_type = tags.get("highway", "residential")
            speed = HIGHWAY_SPEEDS.get(highway_type, DEFAULT_SPEED_KMH)

            # Verificar si tiene velocidad máxima explícita en OSM
            if "maxspeed" in tags:
                try:
                    speed = float(tags["maxspeed"].split()[0])
                except (ValueError, IndexError):
                    pass

            oneway = tags.get("oneway", "no")
            is_forward = oneway in ["yes", "1", "true"]
            is_backward = oneway == "-1"
            is_bidirectional = oneway in ["no", "0", "false"] or not oneway

            for i in range(len(nodes) - 1):
                u, v = nodes[i], nodes[i + 1]
                if u not in self.node_coords or v not in self.node_coords:
                    continue

                lat1, lon1 = self.node_coords[u]
                lat2, lon2 = self.node_coords[v]
                dist_m = haversine_distance_m(lat1, lon1, lat2, lon2)
                travel_time_sec = dist_m / (speed * (1000.0 / 3600.0))

                if is_forward or is_bidirectional:
                    self.graph.add_edge(u, v, length_m=dist_m, speed_kmh=speed, travel_time_sec=travel_time_sec)

                if is_backward or is_bidirectional:
                    self.graph.add_edge(v, u, length_m=dist_m, speed_kmh=speed, travel_time_sec=travel_time_sec)

    def find_nearest_node(self, target_lat: float, target_lon: float) -> Optional[int]:
        """Encuentra el nodo del grafo más cercano a una coordenada dada."""
        if not self.node_coords:
            return None

        best_node = None
        min_dist = float("inf")

        for nid, (lat, lon) in self.node_coords.items():
            d = (lat - target_lat)**2 + (lon - target_lon)**2
            if d < min_dist:
                min_dist = d
                best_node = nid

        return best_node

    def get_shortest_path(self, origin_lat: float, origin_lon: float,
                          dest_lat: float, dest_lon: float) -> Tuple[float, float, List[List[float]]]:
        """
        Retorna (distancia_km, tiempo_min, polilínea_coords) usando Dijkstra sobre el grafo.
        Si no hay camino o el grafo está vacío, usa estimación vial urbana de respaldo.
        """
        u = self.find_nearest_node(origin_lat, origin_lon)
        v = self.find_nearest_node(dest_lat, dest_lon)

        if u is not None and v is not None and nx.has_path(self.graph, u, v):
            try:
                path = nx.shortest_path(self.graph, u, v, weight="travel_time_sec")
                total_time_sec = sum(self.graph[path[i]][path[i+1]]["travel_time_sec"] for i in range(len(path)-1))
                total_dist_m = sum(self.graph[path[i]][path[i+1]]["length_m"] for i in range(len(path)-1))

                polyline = [[origin_lat, origin_lon]]
                for node_id in path:
                    polyline.append(list(self.node_coords[node_id]))
                polyline.append([dest_lat, dest_lon])

                return total_dist_m / 1000.0, total_time_sec / 60.0, polyline
            except nx.NetworkXNoPath:
                pass

        # Respaldo: Estimación urbana realista (factor de retícula 1.3x de distancia y velocidad 32 km/h)
        direct_m = haversine_distance_m(origin_lat, origin_lon, dest_lat, dest_lon)
        urban_m = direct_m * 1.30
        dist_km = urban_m / 1000.0
        time_min = (dist_km / 32.0) * 60.0

        # Polilínea simplificada con punto medio
        mid_lat = (origin_lat + dest_lat) / 2.0
        mid_lon = (origin_lon + dest_lon) / 2.0
        polyline = [[origin_lat, origin_lon], [mid_lat, mid_lon], [dest_lat, dest_lon]]
        return dist_km, time_min, polyline

def build_cost_matrices(hub_coord: Tuple[float, float],
                        order_coords: List[Tuple[float, float]],
                        road_network: RoadNetwork) -> Tuple[List[List[float]], List[List[float]], Dict[Tuple[int, int], List[List[float]]]]:
    """
    Construye las matrices de distancia (km) y tiempo (min) entre todos los puntos.
    El índice 0 representa el Centro de Distribución (Hub).
    Los índices 1..N representan las órdenes.
    """
    points = [hub_coord] + order_coords
    n = len(points)
    dist_matrix = [[0.0] * n for _ in range(n)]
    time_matrix = [[0.0] * n for _ in range(n)]
    path_geometries: Dict[Tuple[int, int], List[List[float]]] = {}

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            lat1, lon1 = points[i]
            lat2, lon2 = points[j]
            d_km, t_min, polyline = road_network.get_shortest_path(lat1, lon1, lat2, lon2)
            dist_matrix[i][j] = d_km
            time_matrix[i][j] = t_min
            path_geometries[(i, j)] = polyline

    return dist_matrix, time_matrix, path_geometries
