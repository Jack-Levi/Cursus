import time
import random
from typing import List, Tuple
from app.algorithms.base import RouteEvaluator
from app.models.schemas import AlgorithmResult

SwapOperator = Tuple[int, int]

def get_swap_sequence(source: List[int], target: List[int]) -> List[SwapOperator]:
    src = source.copy()
    swaps: List[SwapOperator] = []
    for i in range(len(src)):
        if src[i] != target[i]:
            target_val = target[i]
            target_idx = src.index(target_val)
            src[i], src[target_idx] = src[target_idx], src[i]
            swaps.append((i, target_idx))
    return swaps

def apply_swaps(position: List[int], swaps: List[SwapOperator]) -> List[int]:
    pos = position.copy()
    for i, j in swaps:
        pos[i], pos[j] = pos[j], pos[i]
    return pos

class Particle:
    def __init__(self, base_indices: List[int]):
        self.position = random.sample(base_indices, len(base_indices))
        self.pbest_position = self.position.copy()
        self.pbest_fitness = float("inf")
        self.velocity: List[SwapOperator] = []

def run_pso_algorithm(evaluator: RouteEvaluator,
                      n_particles: int = 50,
                      iterations: int = 100,
                      w: float = 0.7,
                      c1: float = 1.4,
                      c2: float = 1.4) -> AlgorithmResult:
    start_time = time.time()
    n_orders = len(evaluator.orders)

    if n_orders == 0:
        return evaluator.build_result("PSO", [], [0.0], 0.0)

    base_indices = list(range(1, n_orders + 1))
    swarm = [Particle(base_indices) for _ in range(n_particles)]

    gbest_position = swarm[0].position.copy()
    gbest_fitness = float("inf")
    convergence_curve: List[float] = []

    for particle in swarm:
        fit, _, _, _ = evaluator.evaluate_sequence(particle.position)
        particle.pbest_fitness = fit
        if fit < gbest_fitness:
            gbest_fitness = fit
            gbest_position = particle.position.copy()

    convergence_curve.append(gbest_fitness)

    for it in range(iterations):
        for particle in swarm:
            new_velocity: List[SwapOperator] = [
                so for so in particle.velocity if random.random() < w
            ]

            cognitive_swaps = get_swap_sequence(particle.position, particle.pbest_position)
            for so in cognitive_swaps:
                if random.random() < (c1 / 2.0):
                    new_velocity.append(so)

            social_swaps = get_swap_sequence(particle.position, gbest_position)
            for so in social_swaps:
                if random.random() < (c2 / 2.0):
                    new_velocity.append(so)

            particle.velocity = new_velocity
            particle.position = apply_swaps(particle.position, particle.velocity)

            fit, _, _, _ = evaluator.evaluate_sequence(particle.position)

            if fit < particle.pbest_fitness:
                particle.pbest_fitness = fit
                particle.pbest_position = particle.position.copy()

            if fit < gbest_fitness:
                gbest_fitness = fit
                gbest_position = particle.position.copy()

        convergence_curve.append(gbest_fitness)

    exec_time = time.time() - start_time
    return evaluator.build_result("PSO", gbest_position, convergence_curve, exec_time)
