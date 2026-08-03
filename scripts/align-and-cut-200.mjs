/**
 * Align expected words to silencedetect segments via ASR, then re-cut.
 * Skips spurious blips instead of assuming 1:1 order.
 */
import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_MP3 = process.env.SOURCE_MP3 || "C:\\Users\\Administrator\\Downloads\\0001 (4).mp3";
const OUT_DIR = join(ROOT, "public", "audio", "mandarin-vocab");
const TMP = join(__dirname, "_align_tmp");
const WORDS = JSON.parse(readFileSync(join(__dirname, "words-1-200.json"), "utf8"));
const COUNT = 200;
const PAD = 0.08;

const ALIASES = {
  the: ["d", "duh", "thee", "da", "d-"],
  be: ["bee", "b"],
  a: ["hey", "uh", "ah", "ay"],
  i: ["bye", "eye", "ay", "hi"],
  he: ["hee", "e"],
  it: ["its", "it's"],
  to: ["two", "too"],
  for: ["four", "fore", "full", "fur"],
  do: ["due", "dew", "two"],
  they: ["day", "dhey", "d-hey", "there"],
  she: ["see", "shi", "shii"],
  his: ["is", "he's"],
  by: ["bye", "buy"],
  one: ["1", "won"],
  two: ["2", "to", "too"],
  mr: ["mister"],
  its: ["it's", "it"],
  our: ["are", "hour"],
  their: ["there"],
  there: ["their", "yeah"],
  no: ["know"],
  know: ["no"],
  will: ["we'll", "well"],
  well: ["will"],
};

function slugNorm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .replace(/'/g, "");
}

function scoreMatch(expected, heard) {
  const e = slugNorm(expected);
  const h = slugNorm(heard);
  if (!h) return 0;
  if (h === e) return 3;
  if (h.startsWith(e) || e.startsWith(h)) return 2;
  if ((ALIASES[e] || []).some((a) => slugNorm(a) === h || h.includes(slugNorm(a)))) return 2;
  if (h.includes(e) && e.length >= 3) return 1;
  return 0;
}

function slugify(word) {
  return String(word)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "word";
}

function expectedName(rank, word) {
  return `${String(rank).padStart(4, "0")}-${slugify(word)}.mp3`;
}

function ffmpeg(args, capture = false) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (capture) return `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-400));
  return "";
}

function loadSegments() {
  const segs = JSON.parse(readFileSync(join(__dirname, "speech-segments.json"), "utf8"));
  // Need more than 200 — reload full detect if short
  return segs;
}

function detectMany() {
  const log = ffmpeg(
    [
      "-hide_banner",
      "-ss",
      "0",
      "-t",
      "900",
      "-i",
      SOURCE_MP3,
      "-af",
      "silencedetect=noise=-35dB:d=0.22",
      "-f",
      "null",
      "-",
    ],
    true,
  );
  const starts = [];
  const ends = [];
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*([0-9.]+)/);
    const e = line.match(/silence_end:\s*([0-9.]+)/);
    if (s) starts.push(Number(s[1]));
    if (e) ends.push(Number(e[1]));
  }
  const segments = [];
  for (let i = 0; i < ends.length; i++) {
    const speechStart = ends[i];
    const nextStart = starts.find((t) => t > speechStart + 0.01);
    const speechEnd = nextStart != null ? nextStart : speechStart + 0.8;
    const dur = speechEnd - speechStart;
    if (dur >= 0.12 && dur <= 2.2) segments.push({ start: speechStart, end: speechEnd, dur });
  }
  writeFileSync(join(__dirname, "speech-segments.json"), JSON.stringify(segments, null, 2));
  return segments;
}

function readWavPcm(path) {
  const buf = readFileSync(path);
  const dataIdx = buf.indexOf(Buffer.from("data"));
  const pcm = buf.subarray(dataIdx + 8);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  console.log("detecting segments...");
  const segments = detectMany();
  console.log("segments", segments.length);

  // Transcribe first COUNT+80 segments for alignment slack
  const probeN = Math.min(segments.length, COUNT + 80);
  console.log("loading whisper...");
  const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
    dtype: "fp32",
  });

  const heard = [];
  for (let i = 0; i < probeN; i++) {
    const seg = segments[i];
    const wav = join(TMP, `seg-${String(i).padStart(4, "0")}.wav`);
    if (!existsSync(wav)) {
      const start = Math.max(0, seg.start - 0.02);
      const dur = seg.end - seg.start + 0.04;
      ffmpeg(["-y", "-ss", start.toFixed(3), "-i", SOURCE_MP3, "-t", dur.toFixed(3), "-ac", "1", "-ar", "16000", wav]);
    }
    const out = await transcriber(readWavPcm(wav), {
      sampling_rate: 16000,
      return_timestamps: false,
    });
    const text = String(out.text || "")
      .trim()
      .toLowerCase()
      .replace(/[.?!,]/g, "")
      .trim();
    heard.push(text);
    if ((i + 1) % 25 === 0) console.log(`asr segments ${i + 1}/${probeN}`);
  }
  writeFileSync(join(__dirname, "segment-asr.json"), JSON.stringify(heard, null, 2));

  // Greedy forward alignment with limited skip of spurious segments
  const aligned = [];
  let segIdx = 0;
  for (let w = 0; w < COUNT; w++) {
    const word = WORDS[w];
    let best = null;
    const maxLook = Math.min(heard.length, segIdx + 6);
    for (let j = segIdx; j < maxLook; j++) {
      const sc = scoreMatch(word, heard[j]);
      const skipPenalty = (j - segIdx) * 0.35;
      const total = sc - skipPenalty;
      if (!best || total > best.total) best = { j, sc, total, heard: heard[j] };
      // strong exact-ish match at earliest: take it
      if (sc >= 2 && j === segIdx) break;
    }
    if (!best || best.sc <= 0) {
      // force take next segment anyway, mark review
      best = { j: segIdx, sc: 0, total: 0, heard: heard[segIdx] || "" };
    }
    aligned.push({
      rank: w + 1,
      word,
      segIndex: best.j,
      heard: best.heard,
      score: best.sc,
      segment: segments[best.j],
      needsReview: best.sc <= 0,
    });
    segIdx = best.j + 1;
    if ((w + 1) % 25 === 0) {
      console.log(
        `aligned ${w + 1}: ${word} <- seg ${best.j} "${best.heard}" score=${best.sc}`,
      );
    }
  }

  // Re-cut from aligned segments
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith(".mp3")) unlinkSync(join(OUT_DIR, f));
  }

  const clips = [];
  for (const row of aligned) {
    const seg = row.segment;
    const start = Math.max(0, seg.start - PAD);
    const end = seg.end + PAD;
    const dur = end - start;
    const name = expectedName(row.rank, row.word);
    ffmpeg([
      "-y",
      "-ss",
      start.toFixed(3),
      "-i",
      SOURCE_MP3,
      "-t",
      dur.toFixed(3),
      "-ac",
      "1",
      "-ar",
      "44100",
      "-b:a",
      "128k",
      join(OUT_DIR, name),
    ]);
    clips.push({
      rank: row.rank,
      word: row.word,
      audio: name,
      startTime: Number(start.toFixed(3)),
      endTime: Number(end.toFixed(3)),
      duration: Number(dur.toFixed(3)),
      heard: row.heard,
      asrScore: row.score,
      needsReview: row.needsReview || row.duration < 0.28 || row.duration > 1.6,
      segIndex: row.segIndex,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    method: "silencedetect + whisper-tiny alignment",
    sourceMp3: SOURCE_MP3,
    wordList: "filiph/english_words frequency lemmas",
    clips,
    reviewCount: clips.filter((c) => c.needsReview).length,
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(__dirname, "align-result.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `Done. ${clips.length} clips. needsReview=${manifest.reviewCount}`,
  );
  console.log(
    "first25:",
    clips
      .slice(0, 25)
      .map((c) => `${c.rank}:${c.word}~${c.heard}`)
      .join(" | "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
