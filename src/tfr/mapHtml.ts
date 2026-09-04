import type { Coords } from "../ui/hooks/useLocation";
import type { ThemeColors } from "../ui/theme";
import { tfrDistanceNm } from "./distance";
import { legalColor } from "./format";
import { LEAFLET_CSS, LEAFLET_JS } from "./leafletVendor";
import type { Tfr } from "./types";

export interface BuildTfrMapHtmlOptions {
  tfrs: Tfr[];
  focusId: string | undefined;
  center: { lat: number; lon: number; label: string } | undefined;
  radiusNm: number | undefined;
  deviceCoords: Coords | null;
  colors: ThemeColors;
}

// Leaflet itself is vendored inline (src/tfr/leafletVendor.ts), so the map
// and every TFR polygon render with no network at all. Only the base-map
// tile images need a live connection — when offline, Leaflet just leaves
// those tiles blank and the polygons still show, which is the best
// "last known" story a raster basemap allows.
//
// The sectional tiles come from the FAA's own ArcGIS Online-hosted
// VFR_Sectional tile service (Aeronautical Information Services) — an
// official source, though this is still just a raster preview, not a
// certified navigation product. If it's ever unreachable, the layer
// switcher's "Street" option still works via OSM.
//
// Shared by the full-screen TfrMapScreen and the smaller embedded preview on
// the Home screen, so both stay in sync automatically.
export function buildTfrMapHtml({ tfrs, focusId, center, radiusNm, deviceCoords, colors }: BuildTfrMapHtmlOptions): string {
  // Same radius filter as the list screen, applied here too so the map
  // matches whatever the user was just looking at.
  const visibleTfrs =
    center && radiusNm != null ? tfrs.filter((t) => tfrDistanceNm(t, center.lat, center.lon) <= radiusNm) : tfrs;

  const features = visibleTfrs.map((t) => ({
    type: "Feature",
    geometry: t.geometry,
    properties: { id: t.id, title: t.title, legal: t.legal, color: legalColor(t.legal) },
  }));
  const geojson = { type: "FeatureCollection", features };
  const isAirportCenter = !!center && center.label !== "your location";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #map { height: 100%; margin: 0; background: ${colors.background}; }
  .tfr-popup { font-family: -apple-system, sans-serif; font-size: 13px; max-width: 240px; }
  .tfr-popup .id { font-weight: 700; }
  .tfr-popup .legal { color: #666; margin-top: 2px; }
  .tfr-popup a { color: #0B5FFF; }
  .you-are-here { width: 16px; height: 16px; border-radius: 50%; background: #0B5FFF; border: 3px solid #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.35); }
  .basemap-switch { position: absolute; top: 90px; left: 10px; z-index: 1000; background: #fff;
    border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.4); overflow: hidden; font-family: -apple-system, sans-serif; }
  .basemap-switch button { display: block; width: 100%; border: 0; background: #fff; color: #12181F;
    font-size: 13px; font-weight: 600; padding: 8px 14px; text-align: left; }
  .basemap-switch button.active { background: #0B5FFF; color: #fff; }
  .basemap-switch button + button { border-top: 1px solid #DADFE3; }
</style>
</head>
<body>
<div id="map"></div>
<div class="basemap-switch">
  <button id="btn-street" class="active" onclick="setBasemap('street')">Street</button>
  <button id="btn-sectional" onclick="setBasemap('sectional')">Sectional</button>
</div>
<script>${LEAFLET_JS}</script>
<script>
  var map = L.map('map', { zoomControl: true }).setView([39.5, -98.35], 4);

  // Street (OpenStreetMap) is the default — it's the one guaranteed to work.
  // Sectional tiles come from ChartBundle, a community re-tiling of FAA
  // charts (unofficial, not sanctioned for navigation) — a nice-to-have the
  // user can opt into, not something to depend on as the default basemap.
  var street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var sectional = L.tileLayer('https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    minNativeZoom: 8,
    maxNativeZoom: 12,
    attribution: 'Sectional tiles &copy; FAA Aeronautical Information Services'
  });
  var currentBasemap = street;
  function setBasemap(which) {
    map.removeLayer(currentBasemap);
    currentBasemap = which === 'sectional' ? sectional : street;
    currentBasemap.addTo(map);
    document.getElementById('btn-street').className = which === 'street' ? 'active' : '';
    document.getElementById('btn-sectional').className = which === 'sectional' ? 'active' : '';
  }

  var geojson = ${JSON.stringify(geojson)};
  var focusId = ${JSON.stringify(focusId ?? null)};
  var center = ${JSON.stringify(center ?? null)};
  var radiusNm = ${JSON.stringify(radiusNm ?? null)};
  var deviceCoords = ${JSON.stringify(deviceCoords)};
  var isAirportCenter = ${JSON.stringify(isAirportCenter)};
  var focusLayer = null;

  var layer = L.geoJSON(geojson, {
    style: function (feature) {
      return { color: feature.properties.color, weight: 2, fillColor: feature.properties.color, fillOpacity: 0.25 };
    },
    onEachFeature: function (feature, lyr) {
      var p = feature.properties;
      lyr.bindPopup(
        '<div class="tfr-popup"><div class="id">' + p.id + '</div>' +
        '<div>' + p.title.replace(/</g, '&lt;') + '</div>' +
        '<div class="legal">' + p.legal + '</div></div>'
      );
      if (focusId && p.id === focusId) focusLayer = lyr;
    }
  }).addTo(map);

  // The search/GPS center used for radius filtering, drawn as a dashed
  // circle. If that center is a searched airport (not the device's own
  // position) it also gets its own marker + label.
  if (center && radiusNm) {
    L.circle([center.lat, center.lon], {
      radius: radiusNm * 1852,
      color: '#0B5FFF',
      weight: 1.5,
      dashArray: '6 6',
      fillOpacity: 0.03,
    }).addTo(map);
  }
  if (center && isAirportCenter) {
    L.marker([center.lat, center.lon]).addTo(map).bindPopup(center.label);
  }

  // The device's actual live GPS position — a "you are here" blue dot,
  // independent of whatever center the radius filter is using.
  if (deviceCoords) {
    L.marker([deviceCoords.lat, deviceCoords.lon], {
      icon: L.divIcon({ className: '', html: '<div class="you-are-here"></div>', iconSize: [16, 16] }),
      zIndexOffset: 1000,
    }).addTo(map).bindPopup('Your location');
  }

  if (focusLayer) {
    map.fitBounds(focusLayer.getBounds(), { padding: [40, 40] });
    focusLayer.openPopup();
  } else if (layer.getLayers().length > 0) {
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  } else if (center) {
    map.setView([center.lat, center.lon], radiusNm ? Math.max(4, 9 - Math.log2(radiusNm / 25)) : 9);
  } else if (deviceCoords) {
    map.setView([deviceCoords.lat, deviceCoords.lon], 8);
  }
</script>
</body>
</html>`;
}
