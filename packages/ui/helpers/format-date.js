// Shared date formatting for list timestamps.
// Lists show the date only (DD/MM/YYYY); the full date+time goes in a tooltip.

export function dateShort(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR');
}

export function dateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR');
}
