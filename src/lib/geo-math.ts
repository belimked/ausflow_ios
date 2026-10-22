// Haversine distance in metres; null when either point is missing.
export function distanceM(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 6371e3, rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}
