// Build-time and page-time helper: lat/lon -> SVG coordinates of us-states.svg.
// Same projection that us-atlas used for states-albers-10m (975 x 610):
// geoAlbersUsa, scale 1300, translate [487.5, 305]. Alaska and Hawaii are the
// standard insets drawn in the lower left.
import { geoAlbersUsa } from 'd3-geo';

export const VIEWBOX = [0, 0, 975, 610];
const proj = geoAlbersUsa().scale(1300).translate([487.5, 305]);

// geoAlbersUsa does NOT return null for Canada near the border (its lower-48
// clip is a rectangle), so BC points would silently land in blank space above
// Washington. isBC() catches the Vancouver / Victoria area (and the BC
// mainland between -125 and -114 east/west, north of the 49th parallel).
export function isBC(lat, lon) {
  if (lat > 49.003 && lat < 60 && lon > -125.5 && lon < -114) return true; // mainland, north of border
  if (lat >= 48.3 && lat <= 49.003 && lon >= -125.5 && lon <= -123.25) return true; // Victoria / Gulf Islands
  return false;
}

// project(lat, lon) -> [x, y] in the us-states.svg viewBox, or null when the
// point is outside the US map (Canada, Mexico, open ocean, BC).
export function project(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (isBC(lat, lon)) return null;
  const p = proj([lon, lat]);
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}

// ---- British Columbia inset -------------------------------------------------
// A small framed box in the Pacific, off Washington/Oregon, at a LARGER scale
// than the main map (equirectangular, cos-latitude corrected). No coastline is
// drawn; it only holds a label and Vancouver-area dots. Label it in the page.
// 2026-10-15: was x 4, y 4, w 78, h 86, which covered the Washington coast (land starts at x 54 to 67 for y 10 to 90)
// and hid Portland and Hillsboro under the box. Now it stops at x 58, y 78, clear of every state outline.
export const BC_BOX = { x: 2, y: 2, w: 56, h: 76 };            // frame, SVG units
const BC_PAD = 6;                                              // inner padding
const BC_LAT = [48.4, 49.6];                                   // south, north (Victoria to the North Shore)
const BC_LON = [-123.6, -122.3];                               // west, east (Victoria to Langley)
const COS = Math.cos((((BC_LAT[0] + BC_LAT[1]) / 2) * Math.PI) / 180);
const innerW = BC_BOX.w - 2 * BC_PAD;
const innerH = BC_BOX.h - 2 * BC_PAD - 14;                     // 14 reserved for label strip
const BC_SCALE = Math.min(innerW / ((BC_LON[1] - BC_LON[0]) * COS), innerH / (BC_LAT[1] - BC_LAT[0]));
const bcW = (BC_LON[1] - BC_LON[0]) * COS * BC_SCALE;
const bcH = (BC_LAT[1] - BC_LAT[0]) * BC_SCALE;
const bcX0 = BC_BOX.x + BC_PAD + (innerW - bcW) / 2;
const bcY0 = BC_BOX.y + BC_PAD + 14 + (innerH - bcH) / 2;
export const BC_LABEL_XY = [BC_BOX.x + BC_PAD, BC_BOX.y + BC_PAD + 6]; // text baseline start

// projectBC(lat, lon) -> [x, y] inside BC_BOX, or null if outside the Vancouver
// area window (lat 48.4..49.6, lon -123.6..-122.3).
export function projectBC(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < BC_LAT[0] || lat > BC_LAT[1] || lon < BC_LON[0] || lon > BC_LON[1]) return null;
  const x = bcX0 + (lon - BC_LON[0]) * COS * BC_SCALE;
  const y = bcY0 + (BC_LAT[1] - lat) * BC_SCALE;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// Convenience: US point via project(), BC point via projectBC().
// Returns { x, y, inset: 'us' | 'bc' } or null.
export function place(lat, lon) {
  const a = project(lat, lon);
  if (a) return { x: a[0], y: a[1], inset: 'us' };
  const b = projectBC(lat, lon);
  if (b) return { x: b[0], y: b[1], inset: 'bc' };
  return null;
}
