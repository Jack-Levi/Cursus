# Cursus

Sistema de simulación y benchmarking logístico para centros de distribución de paquetería, enfocado en el problema de ruteo de vehículos (VRP) con restricciones de jornada laboral y comparación de tres metaheurísticas bioinspiradas: **Algoritmos Genéticos (GA)**, **Optimización por Enjambre de Partículas (PSO)** y **Optimización por Colonia de Hormigas (ACO)**.

---

## Características Principales

1. **Geolocalización Real y Red Vial (100% Abierto y Gratuito)**:
   - **Nominatim (OpenStreetMap)**: Geocodificación directa de direcciones de entrega a coordenadas geográficas.
   - **Overpass API**: Extracción en tiempo real de la red vial (calles, sentidos de circulación y velocidades) alrededor del Centro de Distribución.
   - **Grafo Dirigido (NetworkX + Dijkstra)**: Cálculo de matrices de distancias y tiempos de traslado reales sobre la malla vial.
2. **Restricción de Jornada Laboral**:
   - Asignación y optimización de órdenes garantizando que:
     $$\text{Tiempo de conducción total} + \sum \text{Tiempo de entrega por paquete} + \text{Tiempo de retorno al Hub} \le \text{Jornada Laboral}$$
3. **Benchmarking Comparativo**:
   - Evaluación simultánea de **GA**, **PSO** y **ACO** bajo idénticas condiciones de red vial, órdenes y límites de turno.
   - Métricas: distancia total recorrida (km), tiempo total de ruta (horas/minutos), órdenes entregadas vs descartadas por límite de tiempo, y tiempo de ejecución computacional.
4. **Visualización Interactiva**:
   - **Leaflet 1.9.4** con capas de **OpenStreetMap** y estilización cálida.
   - Visualización de secuencias de entrega y polilíneas de ruta generadas por cada algoritmo.

---

## Arquitectura del Proyecto

```
Cursus/
├── app/
│   ├── algorithms/       # Motores de optimización (GA, PSO, ACO, Dijkstra)
│   ├── models/           # Esquemas de datos (Pydantic)
│   ├── routing/          # Geocodificación (Nominatim), Overpass API y grafo vial
│   ├── static/           # CSS (filtro cálido OSM) y JavaScript (Leaflet + dashboard)
│   ├── templates/        # Vistas HTML
│   ├── config.py         # Configuración central
│   └── main.py           # API FastAPI y servidor de aplicación
├── render.yaml           # Despliegue automatizado en Render
├── requirements.txt      # Dependencias del proyecto
└── README.md
```

---

## Despliegue en Render

El proyecto incluye el manifiesto `render.yaml` para despliegue directo como Web Service en **Render**:
* **Runtime**: Python 3.12
* **Build Command**: `pip install -r requirements.txt`
* **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
