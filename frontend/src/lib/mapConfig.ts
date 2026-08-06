// Mapbox configuration — يُعوَّض بالـ token الحقيقي على السيرفر
export const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoiYXNkZnNkZyIsImEiOiJjbXNnajkxNjAwa250MnlzMmtpYTkyeTd3In0.YrHTbGIpx78DPXd1MF-8nQ";

export const getMapboxTileUrl = () =>
  `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
