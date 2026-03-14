import osmtogeojson from 'osmtogeojson';

/**
 * Fetch water bodies (rivers, lakes, canals) for a bounding box.
 * bbox: { minLat, minLon, maxLat, maxLon }
 */
export async function fetchWaterBodies(bbox) {
  const { minLat, minLon, maxLat, maxLon } = bbox;
  const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;
  const query = `
    [out:json][timeout:60];
    (
      way["waterway"~"river|canal|stream"](${bboxStr});
      relation["waterway"~"river|canal|stream"](${bboxStr});
      way["natural"="water"](${bboxStr});
      relation["natural"="water"](${bboxStr});
    );
    out geom;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const osmData = await res.json();
  return osmtogeojson(osmData);
}

/**
 * Split a LineString feature into segments of `size` coords each.
 */
export function splitIntoSegments(feature, size = 8) {
  const coords = feature.geometry.coordinates;
  const segments = [];
  for (let i = 0; i < coords.length - 1; i += size) {
    const slice = coords.slice(i, i + size + 1);
    if (slice.length < 2) continue;
    segments.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: slice },
      properties: { ...feature.properties },
    });
  }
  return segments;
}
