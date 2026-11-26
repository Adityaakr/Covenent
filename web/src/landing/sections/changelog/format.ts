const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Framer toDateString, dateStyle "long" (en-US): "November 26, 2026". Parsed from the ISO date, no time zone shift. */
export function formatLongDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
