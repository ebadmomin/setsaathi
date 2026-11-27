"""User-triggered public gym lookup.

The public Nominatim service has a strict one-request-per-second limit per app.
Keep this adapter on one backend instance until a hosted geocoder is configured.
"""

from threading import Lock
from time import monotonic, sleep

import httpx
from .config import settings

_cache: dict[str, tuple[float, object]] = {}
_lock = Lock()
_last_nominatim_request = 0.0


def _cached_request(key: str, url: str, params: dict, *, throttle: bool = False):
    global _last_nominatim_request
    with _lock:
        cached = _cache.get(key)
        if cached and monotonic() - cached[0] < 86400:
            return cached[1]
        if throttle:
            sleep(max(0, 1.1 - (monotonic() - _last_nominatim_request)))
            _last_nominatim_request = monotonic()
        response = httpx.get(url, params=params, headers={"User-Agent": settings.gym_lookup_user_agent}, timeout=8)
        response.raise_for_status()
        result = response.json()
        if len(_cache) >= 256:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (monotonic(), result)
        return result


def search_gym(name: str, area: str) -> list[dict]:
    query = " ".join(f"{name} {area}".split())
    records = _cached_request(
        f"place:{query.casefold()}",
        settings.gym_lookup_url,
        {"q": query, "format": "jsonv2", "addressdetails": 1, "namedetails": 1, "limit": 5},
        throttle=True,
    )
    places = []
    for item in records:
        osm_type, osm_id = item.get("osm_type"), item.get("osm_id")
        if osm_type not in {"node", "way", "relation"} or not isinstance(osm_id, int):
            continue
        display = item.get("display_name", "")
        listed_name = item.get("name") or item.get("namedetails", {}).get("name") or display.split(",", 1)[0]
        if not display or not listed_name:
            continue
        places.append({"ref": f"{osm_type}:{osm_id}", "name": listed_name, "address": display})
    return places
