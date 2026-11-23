from typing import List, Dict, Tuple, Any
from app.models.schemas import Order, HubConfig, ShiftConfig, StopDetail, AlgorithmResult

class RouteEvaluator:
    """Evalúa rutas considerando restricciones de jornada laboral y matrices de coste."""

    def __init__(self,
                 hub: HubConfig,
                 orders: List[Order],
                 dist_matrix: List[List[float]],
                 time_matrix: List[List[float]],
                 path_geometries: Dict[Tuple[int, int], List[List[float]]],
                 shift: ShiftConfig):
        self.hub = hub
        self.orders = orders
        self.dist_matrix = dist_matrix
        self.time_matrix = time_matrix
        self.path_geometries = path_geometries
        self.shift = shift
        self.max_shift_min = shift.max_hours * 60.0

    def evaluate_sequence(self, sequence: List[int]) -> Tuple[float, int, float, float]:
        """
        Dada una permutación de índices de órdenes (1-based index):
        Determina cuántas órdenes caben en la jornada laboral y calcula el coste.
        Retorna (fitness, ordenes_entregadas, distancia_km, tiempo_min).
        """
        current_node = 0  # 0 es el Hub
        elapsed_time = 0.0
        total_distance = 0.0
        delivered_count = 0

        for order_idx in sequence:
            # Tiempo de viaje al siguiente punto
            travel_time = self.time_matrix[current_node][order_idx]
            travel_dist = self.dist_matrix[current_node][order_idx]

            # Tiempo de servicio en la entrega
            service_time = self.orders[order_idx - 1].service_time_min

            # Tiempo de retorno al Hub desde ese nuevo punto
            return_time = self.time_matrix[order_idx][0]

            # Verificar si cabe en la jornada laboral con el retorno incluido
            projected_total = elapsed_time + travel_time + service_time + return_time + self.shift.buffer_time_min
            if projected_total <= self.max_shift_min:
                elapsed_time += travel_time + service_time
                total_distance += travel_dist
                current_node = order_idx
                delivered_count += 1
            else:
                # No alcanza el tiempo para entregar este paquete y regresar seguro
                break

        # Regreso final al Hub desde el último nodo atendido
        total_distance += self.dist_matrix[current_node][0]
        elapsed_time += self.time_matrix[current_node][0]

        # Función de fitness:
        # Prioridad 1: Maximizar órdenes entregadas (gran bonificación negativa al coste)
        # Prioridad 2: Minimizar distancia recorrida
        # Coste menor = mejor solución
        unassigned_penalty = (len(sequence) - delivered_count) * 1000.0
        fitness = total_distance + unassigned_penalty

        return fitness, delivered_count, total_distance, elapsed_time

    def build_result(self, algorithm_name: str, best_sequence: List[int],
                     convergence_curve: List[float], execution_time: float) -> AlgorithmResult:
        """Construye el objeto detallado de resultado para el frontend y Leaflet."""
        current_node = 0
        elapsed_time = 0.0
        total_dist_km = 0.0
        driving_time_min = 0.0
        service_time_min = 0.0
        delivered_orders: List[int] = []
        stops: List[StopDetail] = []
        full_polyline: List[List[float]] = []

        for order_idx in best_sequence:
            travel_time = self.time_matrix[current_node][order_idx]
            travel_dist = self.dist_matrix[current_node][order_idx]
            order = self.orders[order_idx - 1]
            service_time = order.service_time_min
            return_time = self.time_matrix[order_idx][0]

            projected_total = elapsed_time + travel_time + service_time + return_time + self.shift.buffer_time_min
            if projected_total <= self.max_shift_min:
                arrival = elapsed_time + travel_time
                departure = arrival + service_time

                stops.append(StopDetail(
                    order_id=order.id,
                    address=order.address,
                    lat=order.lat,
                    lon=order.lon,
                    arrival_time_min=round(arrival, 1),
                    departure_time_min=round(departure, 1),
                    distance_from_prev_km=round(travel_dist, 2),
                    travel_time_from_prev_min=round(travel_time, 1)
                ))

                # Segmento de polilínea geométrica
                seg = self.path_geometries.get((current_node, order_idx), [])
                if seg:
                    if full_polyline and full_polyline[-1] == seg[0]:
                        full_polyline.extend(seg[1:])
                    else:
                        full_polyline.extend(seg)

                elapsed_time = departure
                total_dist_km += travel_dist
                driving_time_min += travel_time
                service_time_min += service_time
                current_node = order_idx
                delivered_orders.append(order_idx)
            else:
                break

        # Tramo de retorno al Hub
        return_dist = self.dist_matrix[current_node][0]
        return_time = self.time_matrix[current_node][0]
        total_dist_km += return_dist
        driving_time_min += return_time
        elapsed_time += return_time

        return_seg = self.path_geometries.get((current_node, 0), [])
        if return_seg:
            if full_polyline and full_polyline[-1] == return_seg[0]:
                full_polyline.extend(return_seg[1:])
            else:
                full_polyline.extend(return_seg)

        dropped_count = len(self.orders) - len(delivered_orders)

        return AlgorithmResult(
            name=algorithm_name,
            total_distance_km=round(total_dist_km, 2),
            total_time_hours=round(elapsed_time / 60.0, 2),
            driving_time_hours=round(driving_time_min / 60.0, 2),
            service_time_hours=round(service_time_min / 60.0, 2),
            orders_delivered=len(delivered_orders),
            orders_dropped=dropped_count,
            stops=stops,
            route_polyline=full_polyline,
            convergence_curve=[round(c, 2) for c in convergence_curve],
            execution_time_sec=round(execution_time, 3),
            within_shift=elapsed_time <= self.max_shift_min
        )
