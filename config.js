// Edit these defaults, then commit the change in GitHub to update your website.
// No build step, API key, or installation is required.
export const settings = {
  searchRadiiMeters: [2000, 5000, 10000],
  defaultRadiusMeters: 5000, // Must also appear in searchRadiiMeters.
  resultLimit: 3, // Closest results shown. KML export still includes all results.
  requestTimeoutMs: 32000,
  dataServices: [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ],
};
