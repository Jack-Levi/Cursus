import time
import random
from typing import List, Tuple
from app.algorithms.base import RouteEvaluator
from app.models.schemas import AlgorithmResult

def ordered_crossover(parent1: List[int], parent2: List[int]) -> Tuple[List[int], List[int]]:
    size = len(parent1)
    if size < 3:
        return parent1.copy(), parent2.copy()

    a, b = sorted(random.sample(range(size), 2))

    def create_child(p1: List[int], p2: List[int]) -> List[int]:
        child = [None] * size
        child[a:b + 1] = p1[a:b + 1]
        copied = set(child[a:b + 1])

        p2_remaining = [gene for gene in p2[b + 1:] + p2[:b + 1] if gene not in copied]
        idx = (b + 1) % size
        for gene in p2_remaining:
            while child[idx] is not None:
                idx = (idx + 1) % size
            child[idx] = gene
        return child

    return create_child(parent1, parent2), create_child(parent2, parent1)

def mutate(individual: List[int], prob_swap: float = 0.5):
    size = len(individual)
    if size < 2:
        return

    if random.random() < prob_swap:
        i, j = random.sample(range(size), 2)
        individual[i], individual[j] = individual[j], individual[i]
    else:
        i, j = sorted(random.sample(range(size), 2))
        individual[i:j + 1] = reversed(individual[i:j + 1])

def run_genetic_algorithm(evaluator: RouteEvaluator,
                           pop_size: int = 60,
                           generations: int = 100,
                           cx_prob: float = 0.85,
                           mut_prob: float = 0.20) -> AlgorithmResult:
    start_time = time.time()
    n_orders = len(evaluator.orders)

    if n_orders == 0:
        return evaluator.build_result("GA", [], [0.0], 0.0)

    base_indices = list(range(1, n_orders + 1))
    population = [random.sample(base_indices, len(base_indices)) for _ in range(pop_size)]

    best_individual = population[0]
    best_fitness, _, _, _ = evaluator.evaluate_sequence(best_individual)
    convergence_curve = [best_fitness]

    for gen in range(generations):
        fitness_scores = [evaluator.evaluate_sequence(ind)[0] for ind in population]

        for ind, fit in zip(population, fitness_scores):
            if fit < best_fitness:
                best_fitness = fit
                best_individual = ind.copy()

        convergence_curve.append(best_fitness)

        selected = []
        for _ in range(pop_size):
            candidates = random.sample(list(range(pop_size)), 3)
            winner_idx = min(candidates, key=lambda idx: fitness_scores[idx])
            selected.append(population[winner_idx].copy())

        # Elitismo: conservar los dos mejores individuos
        new_population = [best_individual.copy(), best_individual.copy()]

        for i in range(2, pop_size, 2):
            p1 = selected[i % pop_size]
            p2 = selected[(i + 1) % pop_size]

            if random.random() < cx_prob:
                c1, c2 = ordered_crossover(p1, p2)
            else:
                c1, c2 = p1.copy(), p2.copy()

            if random.random() < mut_prob:
                mutate(c1)
            if random.random() < mut_prob:
                mutate(c2)

            new_population.append(c1)
            if len(new_population) < pop_size:
                new_population.append(c2)

        population = new_population[:pop_size]

    exec_time = time.time() - start_time
    return evaluator.build_result("GA", best_individual, convergence_curve, exec_time)
