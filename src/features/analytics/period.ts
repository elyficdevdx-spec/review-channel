export type Period = "today" | "7d" | "30d";
const DAY = 86_400_000;
const JST = 9 * 3_600_000;
export function periodRange(period: Period, now = new Date()) {
  const shifted = new Date(now.getTime() + JST);
  const midnight =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - JST;
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  return {
    from: new Date(midnight - (days - 1) * DAY).toISOString(),
    to: now.toISOString(),
  };
}
export function jstDay(date: Date | string) {
  return new Date(new Date(date).getTime() + JST).toISOString().slice(0, 10);
}
export function periodDays(from: string, to: string) {
  const result: string[] = [];
  for (
    let time = new Date(from).getTime();
    time <= new Date(to).getTime();
    time += DAY
  )
    result.push(jstDay(new Date(time)));
  return result;
}
export function displayTime(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}
