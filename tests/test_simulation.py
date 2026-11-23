from app.models.schemas import OptimizationRequest, HubConfig, Order, ShiftConfig
from app.routing.graph import RoadNetwork, build_cost_matrices
from app.algorithms.base import RouteEvaluator
from app.algorithms.genetic import run_genetic_algorithm
from app.algorithms.pso import run_pso_algorithm
from app.algorithms.aco import run_aco_algorithm

def test_full_pipeline():
    hub = HubConfig(name="Hub Monterrey", lat=25.7250, lon=-100.3130)
    orders = [
        Order(id="ORD-1", lat=25.7300, lon=-100.3100, address="Entrega 1", service_time_min=10.0),
        Order(id="ORD-2", lat=25.7200, lon=-100.3200, address="Entrega 2", service_time_min=10.0),
        Order(id="ORD-3", lat=25.7350, lon=-100.3050, address="Entrega 3", service_time_min=10.0),
        Order(id="ORD-4", lat=25.7150, lon=-100.3250, address="Entrega 4", service_time_min=10.0),
        Order(id="ORD-5", lat=25.7400, lon=-100.3000, address="Entrega 5", service_time_min=10.0),
    ]
    shift = ShiftConfig(max_hours=8.0, service_time_per_order_min=10.0, buffer_time_min=15.0)

    hub_coord = (hub.lat, hub.lon)
    order_coords = [(o.lat, o.lon) for o in orders]

    road_network = RoadNetwork()
    dist_mat, time_mat, geoms = build_cost_matrices(hub_coord, order_coords, road_network)

    evaluator = RouteEvaluator(hub, orders, dist_mat, time_mat, geoms, shift)

    res_ga = run_genetic_algorithm(evaluator, pop_size=30, generations=20)
    res_pso = run_pso_algorithm(evaluator, n_particles=25, iterations=20)
    res_aco = run_aco_algorithm(evaluator, n_ants=15, iterations=15)

    print(f"GA  -> Distancia: {res_ga.total_distance_km} km | Tiempo: {res_ga.total_time_hours} hrs | Entregadas: {res_ga.orders_delivered}/{len(orders)}")
    print(f"PSO -> Distancia: {res_pso.total_distance_km} km | Tiempo: {res_pso.total_time_hours} hrs | Entregadas: {res_pso.orders_delivered}/{len(orders)}")
    print(f"ACO -> Distancia: {res_aco.total_distance_km} km | Tiempo: {res_aco.total_time_hours} hrs | Entregadas: {res_aco.orders_delivered}/{len(orders)}")

    assert res_ga.orders_delivered > 0
    assert res_pso.orders_delivered > 0
    assert res_aco.orders_delivered > 0
    print("TEST PASSED: Pipeline completo funciona al 100%!")

if __name__ == "__main__":
    test_full_pipeline()
