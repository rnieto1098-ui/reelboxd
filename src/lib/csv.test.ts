import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEscape, toCsv, unguardSpreadsheetCell } from "./csv.ts";

test("plain values pass through unquoted", () => {
  assert.equal(csvEscape("The Godfather"), "The Godfather");
  assert.equal(csvEscape("Amélie"), "Amélie");
});

test("commas, quotes and line breaks are quoted", () => {
  assert.equal(csvEscape("Crouching Tiger, Hidden Dragon"), '"Crouching Tiger, Hidden Dragon"');
  assert.equal(csvEscape('The "Real" Thing'), '"The ""Real"" Thing"');
  assert.equal(csvEscape("Line\rBreak"), '"Line\rBreak"');
  assert.equal(csvEscape("Line\nBreak"), '"Line\nBreak"');
});

test("formula-leading values are guarded with an apostrophe", () => {
  assert.equal(csvEscape("+1"), "'+1");
  assert.equal(csvEscape("-ism"), "'-ism");
  assert.equal(csvEscape("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvEscape("@Suicide Room"), "'@Suicide Room");
});

test("guarding and quoting combine", () => {
  assert.equal(csvEscape("+1, the sequel"), `"'+1, the sequel"`);
});

test("toCsv joins header and rows", () => {
  assert.equal(toCsv(["Name", "Year"], [["+1", "2013"], ["Heat", "1995"]]), "Name,Year\n'+1,2013\nHeat,1995");
});

test("unguard reverses the formula guard and nothing else", () => {
  assert.equal(unguardSpreadsheetCell("'+1"), "+1");
  assert.equal(unguardSpreadsheetCell("'@Suicide Room"), "@Suicide Room");
  assert.equal(unguardSpreadsheetCell("'Round Midnight"), "'Round Midnight");
  assert.equal(unguardSpreadsheetCell("Heat"), "Heat");
});
