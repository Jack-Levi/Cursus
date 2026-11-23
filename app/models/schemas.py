from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Location(BaseModel):
    lat: float
    lon: float
    address: Optional[str] = None

class Order(BaseModel):
    id: str
    lat: float
    lon: float
    address: Optional[str] = None
    package_weight_kg: Optional[float] = 1.0
    service_time_min: float = 12.0

class HubConfig(BaseModel):
    name: str = "Centro de Distribución"
    lat: float
    lon: float

class ShiftConfig(BaseModel):
    max_hours: float = Field(8.0, ge=1.0, le=24.0, description="Duración máxima de la jornada en horas")
    service_time_per_order_min: float = Field(12.0, ge=1.0, le=60.0, description="Tiempo promedio de entrega por paquete en minutos")
    buffer_time_min: float = Field(15.0, ge=0.0, le=60.0, description="Margen de retorno al Hub")

class AlgorithmParameters(BaseModel):
    # Parámetros GA
    ga_population_size: int = 60
    ga_generations: int = 100
    ga_crossover_prob: float = 0.85
    ga_mutation_prob: float = 0.20

    # Parámetros PSO
    pso_particles: int = 50
    pso_iterations: int = 100
    pso_w: float = 0.7       # Inercia
    pso_c1: float = 1.4      # Factor cognitivo
    pso_c2: float = 1.4      # Factor social

    # Parámetros ACO
    aco_ants: int = 30
    aco_iterations: int = 80
    aco_alpha: float = 1.0   # Peso de la feromona
    aco_beta: float = 2.5    # Peso de la heurística (visibilidad/cercanía)
    aco_rho: float = 0.1     # Tasa de evaporación
    aco_q: float = 100.0     # Cantidad de feromona depositada

class OptimizationRequest(BaseModel):
    hub: HubConfig
    orders: List[Order]
    shift: ShiftConfig = ShiftConfig()
    params: AlgorithmParameters = AlgorithmParameters()

class StopDetail(BaseModel):
    order_id: str
    address: Optional[str]
    lat: float
    lon: float
    arrival_time_min: float
    departure_time_min: float
    distance_from_prev_km: float
    travel_time_from_prev_min: float

class AlgorithmResult(BaseModel):
    name: str
    total_distance_km: float
    total_time_hours: float
    driving_time_hours: float
    service_time_hours: float
    orders_delivered: int
    orders_dropped: int
    stops: List[StopDetail]
    route_polyline: List[List[float]]  # Lista de [lat, lon] para Leaflet
    convergence_curve: List[float]      # Mejor fitness (tiempo o distancia) por iteración
    execution_time_sec: float
    within_shift: bool

class ComparisonResponse(BaseModel):
    hub: HubConfig
    total_orders_received: int
    shift_limit_hours: float
    results: Dict[str, AlgorithmResult]
    best_algorithm_by_distance: str
    best_algorithm_by_delivered: str

class GeocodeRequest(BaseModel):
    address: str

class GeocodeResponse(BaseModel):
    address: str
    lat: float
    lon: float
    display_name: str
