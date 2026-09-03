const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "japanese");
const SPOKEN = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "spoken-english-frequency-5000.json"), "utf8"));
const ENGLISH_COCA = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "english-frequency-5000.json"), "utf8"));
const existing = JSON.parse(fs.readFileSync(path.join(OUT, "blocks-1-10.json"), "utf8"));

function csvEscape(s) {
  const t = String(s ?? "");
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
function toCsv(rows, header) {
  return [header.join(",")].concat(rows.map((r) => header.map((h) => csvEscape(r[h])).join(","))).join("\n") + "\n";
}
function extractLemmas(en) {
  return String(en || "").toLowerCase().replace(/\([^)]*\)/g, " ").split(/[/|,;]+/).flatMap((s) => s.trim().split(/\s+/)).map((s) => s.replace(/[^a-z']/g, "")).filter(Boolean);
}

const coveredEnglish = new Set();
for (const row of existing) {
  for (const L of extractLemmas(row.english)) coveredEnglish.add(L);
}

const spokenRank = new Map(SPOKEN.map((w, i) => [String(w).toLowerCase(), i + 1]));

let inSpokenTop500 = 0, inSpokenTop5000 = 0;
const notInSpoken = [];
let sliceEnContains = 0, exactFirstLemmaMatch = 0;
for (const row of existing) {
  const lemmas = extractLemmas(row.english);
  const ranks = lemmas.map((L) => spokenRank.get(L)).filter((r) => typeof r === "number");
  const best = ranks.length ? Math.min(...ranks) : null;
  if (best != null && best <= 500) inSpokenTop500++;
  if (best != null) inSpokenTop5000++;
  else notInSpoken.push({ block: row.block, romaji: row.romaji, english: row.english });
  const slice = String(SPOKEN[(row.block - 1) * 50 + row.index] || "").toLowerCase();
  if (String(row.english).toLowerCase().includes(slice) || lemmas.includes(slice)) sliceEnContains++;
  if (lemmas[0] === slice) exactFirstLemmaMatch++;
}

let spokenTop500Covered = 0;
const spokenTop500Missing = [];
for (let i = 0; i < 500; i++) {
  const w = String(SPOKEN[i]).toLowerCase();
  if (coveredEnglish.has(w)) spokenTop500Covered++;
  else spokenTop500Missing.push({ rank: i + 1, lemma: w });
}

const FUNCTION_SKIP = new Set("the a an to of and or but in on at for with from by as into about up out if than then so that this these those it its is are was were be been being do does did have has had will would could should may might shall can must not no yes i you he she we they me him her us them my your his our their who whom whose which what where when why how oh ah uh um huh ya yeah yep nah gonna wanna gotta kinda sorta cuz cause ok okay alright whoa wow hey hi bye mr mrs ms dr la r o somehow somewhere anywhere everywhere himself herself itself themselves myself yourself yourselves ourselves cannot ought rather unless except none less longer meant".split(" "));
const PROPER_OR_JUNK = new Set("jesus chang frank george bobby billy steve tony paris french lord god christ bitch fuck shit damn hell ass bastard putt nut freak cop murder scar gentlemen ma daddy momma sir maam captain detective soldier president million billion bobby joe sam mike charlie tom david ray al paul peter bob mary johnny harry danny jimmy henry ed robert richard joey max america american york nam christmas angel goddamn asshole bullshit dude sweetheart mommy mama darling buddy fella doc lieutenant colonel killer queen king english crap suck sex tire hop meant cannot ought rather unless except none less longer himself herself itself themselves myself yourself ooh hmm yo ha ls th il ln mil fir clos sav sho dur wed ben mark roger dick larry piss kelly ow wild bust jim jerry nick luke sergeant motherfucker outta dat pal stat pant gay hid bless rat bury hook".split(" "));
const ALIAS = { alway: "always", morn: "morning", sometime: "sometimes", died: "die", using: "use", spent: "spend", dying: "die", cloth: "clothes", upstair: "upstairs", congratulation: "congratulations", pant: "pants", hid: "hide" };

// Load gloss map if present
const glossPath = path.join(ROOT, "src", "data", "spoken-en-jp-glosses.json");
const GLOSS = fs.existsSync(glossPath) ? JSON.parse(fs.readFileSync(glossPath, "utf8")) : {};

const proposed = [];
const skipped = [];
const seen = new Set();

for (let i = 0; i < SPOKEN.length && proposed.length < 500; i++) {
  const raw = String(SPOKEN[i]).toLowerCase();
  const lemma = ALIAS[raw] || raw;
  const rank = i + 1;
  if (seen.has(lemma) || seen.has(raw)) { skipped.push({ rank, lemma: raw, reason: "duplicate" }); continue; }
  if (coveredEnglish.has(lemma) || coveredEnglish.has(raw)) { skipped.push({ rank, lemma: raw, reason: "already in blocks 1-10" }); continue; }
  if (FUNCTION_SKIP.has(raw) || FUNCTION_SKIP.has(lemma)) { skipped.push({ rank, lemma: raw, reason: "function/filler skip" }); continue; }
  if (PROPER_OR_JUNK.has(raw) || PROPER_OR_JUNK.has(lemma)) { skipped.push({ rank, lemma: raw, reason: "proper-noun/junk/offensive" }); continue; }
  if (lemma.length <= 1) { skipped.push({ rank, lemma: raw, reason: "too short" }); continue; }

  const gloss = GLOSS[lemma] || GLOSS[raw] || null;
  const flags = [];
  if (!gloss || !gloss.jp || gloss.jp === "TBD") flags.push("TBD_GLOSS");
  if (gloss && gloss.note && String(gloss.note).includes("multi-sense")) flags.push("MULTI_SENSE");
  if (gloss && gloss.note && String(gloss.note).includes("adult")) flags.push("ADULT");
  if (ALIAS[raw]) flags.push("TRUNCATED_LEMMA");
  if (rank <= 500) flags.push("GAP_FROM_FIRST_500");

  const blockNumber = 11 + Math.floor(proposed.length / 50);
  const wordIndex = proposed.length % 50;
  const jp = gloss && gloss.jp ? gloss.jp : "TBD";
  const romaji = gloss && gloss.romaji ? gloss.romaji : "TBD";
  proposed.push({
    block: blockNumber,
    index: wordIndex,
    spokenRank: rank,
    englishLemma: lemma,
    sourceLemma: raw,
    jp,
    romaji,
    audio: romaji !== "TBD" ? String(romaji).split(" / ")[0].trim() : "TBD",
    english: lemma,
    note: (gloss && gloss.note) || "",
    flags: flags.join("|"),
    questionable: flags.includes("TBD_GLOSS") || flags.includes("ADULT") || flags.includes("MULTI_SENSE"),
  });
  seen.add(lemma); seen.add(raw);
}

fs.writeFileSync(path.join(OUT, "proposed-blocks-11-20.json"), JSON.stringify(proposed, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "proposed-blocks-11-20.csv"), toCsv(proposed, ["block","index","spokenRank","englishLemma","sourceLemma","jp","romaji","audio","english","note","flags","questionable"]));

const junkInFirst500 = SPOKEN.slice(0, 500).filter((w) => PROPER_OR_JUNK.has(String(w).toLowerCase()));
const audit = {
  generatedAt: new Date().toISOString(),
  sourcesFound: {
    spokenEnglishXlsx: "C:/Users/Administrator/Downloads/top_5000_spoken_english_lemmatised.xlsx",
    spokenEnglishJson: "src/data/spoken-english-frequency-5000.json",
    spokenEnglishCount: SPOKEN.length,
    cocaStyleJson: "src/data/english-frequency-5000.json",
    cocaStyleCount: ENGLISH_COCA.length,
    japaneseFrequencyListInRepo: false,
    japaneseFrequencyListInDownloads: false,
    note: "No Japanese frequency dictionary/spreadsheet found in repo or Downloads. American English Frequency Dictionary PDFs exist but were not used for JP block content.",
  },
  historicalUsage: {
    frequencyTsUsesSpokenListForLabels: true,
    blocks1to10BuiltAs1to1SpokenSlice: false,
    blocks1to10AreHandCuratedConversationalJapanese: true,
    honestVerdict: "Spoken English list was imported and wired for curriculum scaffolding (rank labels / 100-block plan). Blocks 1-10 content was NOT built as a faithful mapping of spoken ranks 1-500 to Japanese. No Japanese frequency list was referenced.",
  },
  first500Stats: {
    totalWords: existing.length,
    englishGlossInSpokenTop500: inSpokenTop500,
    englishGlossInSpokenTop5000: inSpokenTop5000,
    notInSpokenTop5000: notInSpoken.length,
    notInSpokenSample: notInSpoken.slice(0, 40),
    slicePositionEnContainsLemma: sliceEnContains,
    exactFirstLemmaEqualsSlice: exactFirstLemmaMatch,
    spokenTop500LemmasCoveredByBlockEnglish: spokenTop500Covered,
    spokenTop500LemmasMissing: spokenTop500Missing.length,
    spokenTop500MissingSample: spokenTop500Missing.slice(0, 80),
    junkProperInSpokenRanks1to500: junkInFirst500,
  },
  proposedNext500: {
    count: proposed.length,
    tbdGlossCount: proposed.filter((p) => p.jp === "TBD").length,
    gapFromFirst500Included: proposed.filter((p) => String(p.flags).includes("GAP_FROM_FIRST_500")).length,
    skippedCount: skipped.length,
    selectionMethod: "Walk spoken-english-frequency-5000 in rank order; skip lemmas already covered by blocks 1-10 English glosses, function/filler words, proper nouns/junk; take next 500 teachable candidates for blocks 11-20.",
  },
  downloads: {
    first500: ["/japanese/blocks-1-10.csv", "/japanese/blocks-1-10.json"],
    next500: ["/japanese/proposed-blocks-11-20.csv", "/japanese/proposed-blocks-11-20.json"],
    audit: ["/japanese/frequency-audit.json"],
  },
};
fs.writeFileSync(path.join(OUT, "frequency-audit.json"), JSON.stringify(audit, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "proposed-skip-log.json"), JSON.stringify(skipped, null, 2) + "\n");
console.log(JSON.stringify({ proposed: proposed.length, tbd: audit.proposedNext500.tbdGlossCount, gaps: audit.proposedNext500.gapFromFirst500Included, spokenTop500Covered, missing: spokenTop500Missing.length, sliceEnContains, exactFirstLemmaMatch, notInSpoken: notInSpoken.length }, null, 2));
