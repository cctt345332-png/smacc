// Mapbox configuration
export const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoiYXNkZnNkZyIsImEiOiJjbXNnajkxNjAwa250MnlzMmtpYTkyeTd3In0.YrHTbGIpx78DPXd1MF-8nQ";

// satellite-streets = صور أقمار صناعية + أسماء الشوارع والمحلات
export const getMapboxTileUrl = () =>
  `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
