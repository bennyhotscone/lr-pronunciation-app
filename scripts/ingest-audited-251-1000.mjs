/**
 * Ingest /home/brix/Descargas/LRMastery_AUDITED_251-1000.txt
 * into block6.json … block20.json (50 words each).
 * Does NOT touch block1–5.
 *
 * Run: node scripts/ingest-audited-251-1000.mjs
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "src", "lib", "japanese", "blocks");
const defaultSrc = "/home/brix/Descargas/LRMastery_AUDITED_251-1000.txt";
const srcPath = process.argv[2] || defaultSrc;

if (!existsSync(srcPath)) {
  console.error("Missing source file:", srcPath);
  process.exit(1);
}

/** Minimal romaji → hiragana for TTS audio field. */
const BASIC = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
  ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wo: "を", n: "ん",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  ti_ext: "てぃ", di_ext: "でぃ",
  vu: "ゔ",
};

const LONGEST = Object.keys(BASIC).sort((a, b) => b.length - a.length);

function romajiToHiragana(romaji) {
  let s = romaji
    .toLowerCase()
    .replace(/[〜～]/g, "")
    .replace(/-/g, "")
    .replace(/'/g, "")
    .replace(/\s+/g, "")
    .replace(/ou/g, "ō")
    .replace(/uu/g, "ū")
    .replace(/aa/g, "ā")
    .replace(/ee/g, "ē")
    .replace(/ii/g, "ī");
  // long vowels → vowel + う/あ etc.
  s = s
    .replace(/ā/g, "aa")
    .replace(/ī/g, "ii")
    .replace(/ū/g, "uu")
    .replace(/ē/g, "ee")
    .replace(/ō/g, "ou");

  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s[i] === "n" && (i === s.length - 1 || !"aiueoy".includes(s[i + 1]))) {
      out += "ん";
      i += 1;
      continue;
    }
    // small tsu for double consonants
    if (
      i + 1 < s.length &&
      s[i] === s[i + 1] &&
      !"aiueon".includes(s[i])
    ) {
      out += "っ";
      i += 1;
      continue;
    }
    let matched = false;
    for (const key of LONGEST) {
      if (s.startsWith(key, i)) {
        out += BASIC[key];
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // leave latin (loanwords) as-is for TTS via jp field fallback
      out += s[i];
      i += 1;
    }
  }
  return out;
}

function mnemonicFor(romaji, english) {
  const r = romaji.trim();
  const en = english.trim().split("/")[0].trim().toUpperCase();
  const hook = r.toUpperCase().replace(/[^A-Z]/g, " ").replace(/\s+/g, "-");
  return `"${hook}" → ${en}. → ${r}.`;
}

const text = readFileSync(srcPath, "utf8");
const lineRe =
  /^(\d+)\s*\|\s*B(\d+)\.(\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*ENG #(\d+)\s*\|\s*CEJC #(\d+)\s*$/;

const byBlock = {};
for (const line of text.split(/\r?\n/)) {
  const m = line.match(lineRe);
  if (!m) continue;
  const globalRank = Number(m[1]);
  const block = Number(m[2]);
  const slot = Number(m[3]);
  const romaji = m[4].trim();
  const japanese = m[5].trim();
  const english = m[6].trim();
  const engFreq = Number(m[7]);
  const cejc = Number(m[8]);
  if (!byBlock[block]) byBlock[block] = [];
  byBlock[block].push({
    globalRank,
    slot,
    romaji,
    japanese,
    english,
    engFreq,
    cejc,
  });
}

const blocks = Object.keys(byBlock)
  .map(Number)
  .sort((a, b) => a - b);

for (const block of blocks) {
  if (block < 6 || block > 20) {
    console.warn("Unexpected block", block);
    continue;
  }
  const rows = byBlock[block].sort((a, b) => a.slot - b.slot);
  if (rows.length !== 50) {
    console.error(`Block ${block} has ${rows.length} words, expected 50`);
    process.exit(1);
  }
  const words = rows.map((row) => {
    const audio = romajiToHiragana(row.romaji);
    return {
      jp: row.japanese,
      audio: /[ぁ-んァ-ン]/.test(audio) ? audio : row.japanese,
      r: row.romaji,
      en: row.english,
      m: mnemonicFor(row.romaji, row.english),
      id: `b${block}-r${row.globalRank}`,
      globalRank: row.globalRank,
      block,
      cejcRank: row.cejc,
      englishFrequencyRank: row.engFreq,
    };
  });
  const outPath = join(outDir, `block${block}.json`);
  writeFileSync(outPath, JSON.stringify(words, null, 2) + "\n");
  console.log(
    `Wrote block${block}.json (${words.length}) first=${words[0].r} last=${words[49].r}`,
  );
}

console.log("Done. Blocks:", blocks.join(", "));
