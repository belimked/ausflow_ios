export const API_BASE = 'https://uat.ausflow.saulxj.ggff.net'
export const ENV_LABEL = 'UAT'
// Same threshold the web console uses to flag a pickup as "not at device".
export const LOCATION_FLAG_METRES = 200

export const FEATURES = {
  // Trailers / dogs exist nowhere on the backend yet. 'mock' shows a local-only demo (nothing is sent to the
  // server) until the client confirms whether they are used; 'off' hides it.
  trailers: 'mock' as 'mock' | 'off',
}
