#!/usr/bin/env python3
"""
zone_mapper.py — Divide una región en cuadrícula de coordenadas
para hacer búsquedas exhaustivas en Google Maps celda a celda.
"""

import math
from dataclasses import dataclass
from typing import Optional

# ─── Zonas predefinidas (lat_min, lat_max, lon_min, lon_max) ─────────────────
PRESET_ZONES = {
    # España — Comunidades Autónomas
    "comunidad de madrid":      (40.14, 41.17, -4.58, -3.05),
    "madrid":                   (40.14, 41.17, -4.58, -3.05),
    "cataluña":                 (40.52, 42.86, 0.16,  3.33),
    "barcelona provincia":      (41.07, 41.99, 1.49,  2.93),
    "andalucía":                (36.00, 38.72, -7.52, -1.63),
    "comunidad valenciana":     (37.84, 40.79, -1.53,  0.53),
    "país vasco":               (42.44, 43.46, -3.45, -1.72),
    "galicia":                  (41.81, 43.79, -9.30, -6.73),
    "castilla y león":          (40.00, 43.07, -6.97, -2.04),
    "castilla la mancha":       (38.08, 41.34, -5.37, -1.58),
    "aragón":                   (39.73, 42.92, -2.17,  0.76),
    "extremadura":              (37.91, 40.47, -7.55, -4.64),
    "murcia":                   (37.38, 38.76, -2.34, -0.65),
    "asturias":                 (42.92, 43.68, -7.14, -4.52),
    "navarra":                  (41.88, 43.31, -2.50, -0.39),
    "cantabria":                (42.77, 43.51, -4.84, -3.36),
    "la rioja":                 (41.93, 42.65, -3.17, -1.64),
    "islas baleares":           (38.64, 40.10,  1.19,  4.34),
    "islas canarias":           (27.63, 29.42, -18.17, -13.34),
    # Ciudades principales (radio más pequeño)
    "madrid ciudad":            (40.33, 40.53, -3.83, -3.56),
    "barcelona ciudad":         (41.32, 41.48,  2.07,  2.23),
    "sevilla ciudad":           (37.30, 37.45, -6.08, -5.92),
    "valencia ciudad":          (39.40, 39.52, -0.44, -0.30),
    "bilbao":                   (43.22, 43.32, -2.98, -2.88),
    "zaragoza ciudad":          (41.60, 41.70, -0.97, -0.84),
    "málaga ciudad":            (36.68, 36.74, -4.50, -4.40),
    "murcia ciudad":            (37.95, 38.02, -1.17, -1.08),
    "palma de mallorca":        (39.53, 39.60,  2.61,  2.72),
    "las palmas":               (27.89, 28.17, -15.57, -15.37),
    "alicante ciudad":          (38.32, 38.38, -0.52, -0.44),
    "córdoba ciudad":           (37.82, 37.92, -4.83, -4.74),
    "valladolid ciudad":        (41.60, 41.68, -4.78, -4.68),
    "vigo":                     (42.19, 42.26, -8.75, -8.65),
}


@dataclass
class GridCell:
    lat_center: float
    lon_center: float
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    row: int
    col: int
    label: str = ""

    @property
    def zoom_url_fragment(self) -> str:
        """Fragment para centrar Google Maps en esta celda."""
        return f"@{self.lat_center},{self.lon_center},13z"

    @property
    def search_location(self) -> str:
        """Cadena de texto para añadir a la búsqueda."""
        return f"{self.lat_center:.4f},{self.lon_center:.4f}"


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Distancia en km entre dos puntos."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def build_grid(
    lat_min: float, lat_max: float,
    lon_min: float, lon_max: float,
    cell_km: float = 8.0          # tamaño de cada celda en km
) -> list[GridCell]:
    """
    Divide el bounding box en celdas de ~cell_km x cell_km.
    Solapamiento del 20% para no perder negocios en los bordes.
    """
    overlap = 0.20
    effective_km = cell_km * (1 - overlap)

    # Grados por km (aproximación)
    lat_deg_per_km = 1.0 / 111.0
    mid_lat = (lat_min + lat_max) / 2.0
    lon_deg_per_km = 1.0 / (111.0 * math.cos(math.radians(mid_lat)))

    step_lat = effective_km * lat_deg_per_km
    step_lon = effective_km * lon_deg_per_km

    cells = []
    row = 0
    lat = lat_min
    while lat < lat_max:
        col = 0
        lon = lon_min
        while lon < lon_max:
            # Clamp center to always be inside the bbox
            c_lat = min(lat + step_lat / 2, lat_max - 0.001)
            c_lon = min(lon + step_lon / 2, lon_max - 0.001)
            cells.append(GridCell(
                lat_center=round(c_lat, 5),
                lon_center=round(c_lon, 5),
                lat_min=round(lat, 5),
                lat_max=round(min(lat + step_lat, lat_max), 5),
                lon_min=round(lon, 5),
                lon_max=round(min(lon + step_lon, lon_max), 5),
                row=row, col=col,
                label=f"R{row}C{col}"
            ))
            col += 1
            lon += step_lon
        row += 1
        lat += step_lat

    return cells


def resolve_zone(zone_input: str) -> Optional[tuple[float, float, float, float]]:
    """
    Devuelve (lat_min, lat_max, lon_min, lon_max) para una zona.
    Busca en presets, o acepta formato 'lat_min,lat_max,lon_min,lon_max'.
    """
    z = zone_input.strip().lower()
    if z in PRESET_ZONES:
        return PRESET_ZONES[z]
    # Try manual bbox: "40.1,41.2,-4.5,-3.0"
    parts = [p.strip() for p in z.split(",")]
    if len(parts) == 4:
        try:
            return tuple(float(p) for p in parts)
        except ValueError:
            pass
    return None


def get_cell_size_for_density(zone_name: str) -> float:
    """Ajusta el tamaño de celda según la densidad esperada de la zona."""
    z = zone_name.lower()
    # Ciudades grandes → celdas pequeñas
    for city in ["ciudad", "bilbao", "vigo", "palma", "las palmas"]:
        if city in z:
            return 4.0
    # Comunidades grandes → celdas medianas
    for region in ["cataluña", "andalucía", "castilla", "aragón", "extremadura"]:
        if region in z:
            return 12.0
    return 8.0  # default


def list_presets() -> list[str]:
    return sorted(PRESET_ZONES.keys())
