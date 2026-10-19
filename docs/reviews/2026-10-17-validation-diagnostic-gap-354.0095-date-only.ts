// Isolated RFC 0095 research, not a production import or activated validator.
export function dateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 10) return false;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year === 0 || month < 1 || month > 12 || day < 1) return false;
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= (leap ? 29 : 28);
  }
  return day <= ([4, 6, 9, 11].includes(month) ? 30 : 31);
}
