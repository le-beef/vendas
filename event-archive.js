// 23:59 do dia seguinte no horário de Brasília (UTC−03:00).
export function eventArchiveDeadline(event) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event?.date || '')) return Infinity;
  const midnight = Date.parse(`${event.date}T00:00:00-03:00`);
  return Number.isFinite(midnight) ? midnight + (47 * 60 + 59) * 60000 : Infinity;
}
export function eventIsArchived(event, now = Date.now()) {
  if (!event) return false;
  if (event.archived === true) return true;
  if (event.archiveRestoredDate === event.date) return false;
  return now >= eventArchiveDeadline(event);
}
