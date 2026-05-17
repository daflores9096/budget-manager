/**
 * Calendar YYYY-MM-DD in the user's local timezone (not UTC midnight from toISOString()).
 */
export function toLocalIsoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
