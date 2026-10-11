// Spreadsheet apps treat a cell starting with one of these as a formula: a
// film titled "+1" opens in Excel as the number 1, and "=..." or "@..." as an
// error. A leading apostrophe makes the cell literal text, and Excel/Sheets
// hide the apostrophe itself.
const FORMULA_LEADERS = /^[=+\-@\t\r]/;

export function csvEscape(value: string): string {
  const guarded = FORMULA_LEADERS.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

// The inverse of csvEscape's formula guard, for reading our own exports back
// in. Only strips an apostrophe that's guarding a formula character, so a
// title that genuinely starts with one ("'Round Midnight") is left alone.
export function unguardSpreadsheetCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}
