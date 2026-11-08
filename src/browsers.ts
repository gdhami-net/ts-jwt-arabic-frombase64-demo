import browserslist from 'browserslist';

// The query Angular CLI builds with for version 22. The text is in
// packages/angular/build/src/utils/supported-browsers.ts and the date is the
// BASELINE_DATE in @angular/build 22.2.5.
export const ANGULAR_22_QUERY = 'baseline widely available on 2026-05-07';

// First version with Uint8Array.fromBase64, from MDN's browser-compat-data 8.1.8.
export const ADDED_IN: Record<string, number> = {
  chrome: 140,
  edge: 140,
  firefox: 133,
  safari: 18.2,
  ios_saf: 18.2,
};

export function supportFloor(): Record<string, number> {
  const floor: Record<string, number> = {};
  for (const entry of browserslist(ANGULAR_22_QUERY)) {
    const [browser, version] = entry.split(' ');
    const v = parseFloat(version);
    if (!(browser in floor) || v < floor[browser]) floor[browser] = v;
  }
  return floor;
}

if (import.meta.main) {
  const floor = supportFloor();
  console.log(ANGULAR_22_QUERY);
  for (const browser of Object.keys(ADDED_IN)) {
    console.log(`${browser.padEnd(9)} oldest supported ${String(floor[browser]).padEnd(6)} has fromBase64 from ${ADDED_IN[browser]}`);
  }
}
