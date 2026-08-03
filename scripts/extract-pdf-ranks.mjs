/**
 * Extract frequency ranks 1–200 from A Frequency Dictionary INDEX.pdf
 */
import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pdf from "pdf-parse/lib/pdf-parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PDF = "C:/Users/Administrator/Downloads/A Frequency Dictionary INDEX.pdf";

const buf = fs.readFileSync(PDF);
const data = await pdf(buf);
const text = data.text;

const all = [];
for (const t of text.split(/\s+/)) {
  const m = t.match(/^([A-Za-z][A-Za-z'/-]*)([a-z])(\d+)$/);
  if (m) all.push({ word: m[1], pos: m[2], rank: Number(m[3]), raw: t });
}

const byRank = new Map();
for (const e of all) {
  if (!byRank.has(e.rank)) byRank.set(e.rank, []);
  byRank.get(e.rank).push(e);
}

const missing = [];
for (let r = 1; r <= 200; r++) if (!byRank.has(r)) missing.push(r);

console.log("parsed entries", all.length);
console.log("missing 1-200", missing.join(",") || "(none)");

const re19 = [...text.matchAll(/[A-Za-z][A-Za-z'/-]*[a-z]19(?!\d)/g)].map((x) => x[0]);
const re30 = [...text.matchAll(/[A-Za-z][A-Za-z'/-]*[a-z]30(?!\d)/g)].map((x) => x[0]);
console.log("regex hits *19", re19);
console.log("regex hits *30", re30);

// Look for broken OCR: "s" possessive, "by", etc.
const shortLines = text
  .split(/\n/)
  .map((l) => l.trim())
  .filter((l) => /(?:^|[^0-9])(19|30)(?:$|[^0-9])/.test(l) && l.length < 50)
  .slice(0, 60);
console.log("short lines with 19/30:\n" + shortLines.join("\n"));

console.log("\n--- book ranks 1-40 ---");
for (let r = 1; r <= 40; r++) {
  const es = byRank.get(r) || [];
  console.log(String(r).padStart(3), es.map((e) => `${e.word}/${e.pos}`).join(" | ") || "MISSING");
}

// Primary list: one entry per rank number (first POS if multiple)
const bookRanked = [];
for (let r = 1; r <= 220; r++) {
  const es = byRank.get(r);
  if (!es) continue;
  bookRanked.push({ rank: r, word: es[0].word, pos: es[0].pos, all: es });
}

fs.writeFileSync(
  join(__dirname, "pdf-book-ranks.json"),
  JSON.stringify({ missing, bookRanked: bookRanked.filter((x) => x.rank <= 200), allCount: all.length }, null, 2),
);

// Compare to approved 1-20 (lemma list used in app)
const approved = JSON.parse(fs.readFileSync(join(__dirname, "words-1-200.json"), "utf8")).slice(0, 20);
console.log("\n--- conflict vs approved 1-20 ---");
for (let i = 0; i < 20; i++) {
  const a = approved[i];
  const b = byRank.get(i + 1)?.[0]?.word ?? "MISSING";
  const ok = a.toLowerCase() === String(b).toLowerCase();
  console.log(`${i + 1}: approved=${a} book=${b} ${ok ? "OK" : "CONFLICT"}`);
}
