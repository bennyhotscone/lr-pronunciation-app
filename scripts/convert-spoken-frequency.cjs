const fs = require("node:fs");
const { inflateRawSync } = require("node:zlib");
const path = require("node:path");
const xlsxPath = process.argv[2] || "c:/Users/Administrator/Downloads/top_5000_spoken_english_lemmatised.xlsx";
const outPath = process.argv[3] || path.join(__dirname, "..", "src", "data", "spoken-english-frequency-5000.json");
const buf = fs.readFileSync(xlsxPath);
const readU32 = (off) => buf.readUInt32LE(off);
const readU16 = (off) => buf.readUInt16LE(off);
function readZipEntries(buffer) {
  const files = [];
  let off = 0;
  while (off < buffer.length) {
    const sig = readU32(off);
    if (sig !== 0x04034b50) break;
    const comp = readU16(off + 8);
    const compSize = readU32(off + 18);
    const nameLen = readU16(off + 26);
    const extraLen = readU16(off + 28);
    const name = buffer.slice(off + 30, off + 30 + nameLen).toString("utf8");
    const dataStart = off + 30 + nameLen + extraLen;
    const data = buffer.slice(dataStart, dataStart + compSize);
    const content = comp === 0 ? data : comp === 8 ? inflateRawSync(data) : null;
    if (!content) throw new Error("bad compression " + comp + " for " + name);
    files.push({ name, content: content.toString("utf8") });
    off = dataStart + compSize;
  }
  return files;
}
function parseSharedStrings(xml) {
  const strings = [];
  const siRe = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let m;
  while ((m = siRe.exec(xml))) {
    strings.push([...m[1].matchAll(/<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/g)].map((x) => x[1]).join(""));
  }
  return strings;
}
function colToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function parseSheet(xml, strings) {
  const rows = [];
  const rowRe = /<(?:\w+:)?row[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml))) {
    const row = [];
    const cellRe = /<(?:\w+:)?c([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const ref = (cellMatch[1].match(/r="([A-Z]+)(\d+)"/) || [])[1];
      const col = ref ? colToIndex(ref) : row.length;
      const t = (cellMatch[1].match(/t="([^"]+)"/) || [])[1];
      const v = (cellMatch[2].match(/<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/) || [])[1] || "";
      row[col] = t === "s" ? strings[Number(v)] : v;
    }
    rows.push(row);
  }
  return rows;
}
const files = readZipEntries(buf);
const sharedXml = files.find((f) => f.name === "xl/sharedStrings.xml")?.content || "";
const sheetXml = files.find((f) => f.name === "xl/worksheets/sheet1.xml")?.content || "";
const strings = parseSharedStrings(sharedXml);
const rows = parseSheet(sheetXml, strings);
const header = rows[0] || [];
const dataRows = rows.slice(1).filter((r) => r.some(Boolean));
console.log("Row count (excluding header):", dataRows.length);
console.log("Columns:", header);
console.log("First 5 data rows:", dataRows.slice(0, 5));
console.log("Rows 100-105:", dataRows.slice(99, 105));
const lowerHeader = header.map((h) => String(h || "").toLowerCase());
const lemmaIdx = lowerHeader.findIndex((h) => h.includes("lemma"));
const wordIdx = lowerHeader.findIndex((h) => h === "word" || h.includes("word"));
const idx = lemmaIdx >= 0 ? lemmaIdx : wordIdx >= 0 ? wordIdx : 1;
const words = dataRows.map((row) => String(row[idx] || "").trim()).filter(Boolean).slice(0, 5000);
console.log("Lemma count:", words.length);
console.log("Ranks 1-5:", words.slice(0, 5).map((w, i) => (i + 1) + ": " + w).join(", "));
console.log("Ranks 101-105:", words.slice(100, 105).map((w, i) => (i + 101) + ": " + w).join(", "));
fs.writeFileSync(outPath, JSON.stringify(words, null, 2) + "\n", "utf8");
console.log("Wrote", outPath);