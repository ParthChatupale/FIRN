export function number(value: number) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)
    : "Unavailable";
}
export function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
export function formatUtc(value: string | null | undefined) {
  if (!value) return "No observed time";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : date.toISOString().slice(5, 16).replace("T", " ") + " UTC";
}
