import time
import random
from typing import List
from app.algorithms.base import RouteEvaluator
from app.models.schemas import AlgorithmResult

def run_aco_algorithm(evaluator: RouteEvaluator,
                      n_ants: int = 30,
                      iterations: int = 80,
                      alpha: float = 1.0,
                      beta: float = 2.5,
                      rho: float = 0.1,
                      q: float = 100.0) -> AlgorithmResult:
    """Ejecuta Optimización por Colonia de Hormigas (ACO) sobre la red vial."""
    start_time = time.time()
    n_orders = len(evaluator.orders)

    if n_orders == 0:
        return evaluator.build_result("Colonia de Hormigas (ACO)", [], [0.0], 0.0)

    total_nodes = n_orders + 1  # 0 es el Hub, 1..n_orders son las entregas

    # Inicialización de matriz de feromonas (tau)
    tau = [[1.0] * total_nodes for _ in range(total_nodes)]

    # Heurística de visibilidad eta = 1 / distancia (a mayor cercanía, mayor deseabilidad)
    eta = [[0.0] * total_nodes for _ in range(total_nodes)]
    for i in range(total_nodes):
        for j in range(total_nodes):
            if i != j:
                d = evaluator.dist_matrix[i][j]
                eta[i][j] = 1.0 / (d + 1e-4)

    gbest_tour: List[int] = list(range(1, n_orders + 1))
    gbest_fitness = float("inf")
    convergence_curve: List[float] = []

    for it in range(iterations):
        iteration_tours: List[List[int]] = []
        iteration_fitnesses: List[float] = []

        for ant in range(n_ants):
            unvisited = set(range(1, total_nodes))
            current_node = 0  # Inicia en el Hub
            tour: List[int] = []

            while unvisited:
                # Calcular probabilidades de transición
                probabilities = []
                nodes_list = list(unvisited)
                weights = []

                for next_node in nodes_list:
                    p_val = (tau[current_node][next_node] ** alpha) * (eta[current_node][next_node] ** beta)
                    weights.append(p_val)

                total_weight = sum(weights)
                if total_weight > 0:
                    chosen_node = random.choices(nodes_list, weights=weights, k=1)[0]
                else:
                    chosen_node = random.choice(nodes_list)

                tour.append(chosen_node)
                unvisited.remove(chosen_node)
                current_node = chosen_node

            fit, _, _, _ = evaluator.evaluate_sequence(tour)
            iteration_tours.append(tour)
            iteration_fitnesses.append(fit)

            if fit < gbest_fitness:
                gbest_fitness = fit
                gbest_tour = tour.copy()

        convergence_curve.append(gbest_fitness)

        # Evaporación de feromonas
        for i in range(total_nodes):
            for j in range(total_nodes):
                tau[i][j] *= (1.0 - rho)
                if tau[i][j] < 0.01:
                    tau[i][j] = 0.01  # Límite mínimo para evitar estancamiento

        # Depósito de feromonas por las hormigas de la iteración
        for tour, fit in zip(iteration_tours, iteration_fitnesses):
            delta = q / (fit + 1e-3)
            # Arco del Hub al primer nodo
            tau[0][tour[0]] += delta
            # Arcos entre entregas sucesivas
            for idx in range(len(tour) - 1):
                tau[tour[idx]][tour[idx + 1]] += delta
            # Arco del último nodo de regreso al Hub
            tau[tour[-1]][0] += delta

        # Depósito adicional de refuerzo en el mejor camino global (Elitist Ant)
        best_delta = (q * 2.0) / (gbest_fitness + 1e-3)
        tau[0][gbest_tour[0]] += best_delta
        for idx in range(len(gbest_tour) - 1):
            tau[gbest_tour[idx]][gbest_tour[idx + 1]] += best_delta
        tau[gbest_tour[-1]][0] += best_delta

    exec_time = time.time() - start_time
    return evaluator.build_result("Colonia de Hormigas (ACO)", gbest_tour, convergence_curve, exec_time)
