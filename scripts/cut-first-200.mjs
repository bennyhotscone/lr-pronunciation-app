/**
 * Cut first N spoken segments from the source MP3 using ffmpeg silencedetect.
 * Pads each clip slightly so consonants are not clipped.
 * Writes clips + manifest; does NOT assume every silence boundary is perfect.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_MP3 = process.env.SOURCE_MP3 || "C:\\Users\\Administrator\\Downloads\\0001 (4).mp3";
const OUT_DIR = join(ROOT, "public", "audio", "mandarin-vocab");
const WORDS = JSON.parse(readFileSync(join(__dirname, "words-1-200.json"), "utf8"));
const COUNT = Number(process.env.CUT_COUNT || 200);
const ANALYZE_SECONDS = Number(process.env.ANALYZE_SECONDS || 900); // 15 min margin
const PAD = Number(process.env.PAD_SEC || 0.08);
const MIN_SPEECH = 0.12;
const MAX_SPEECH = 2.2;
const NOISE_DB = process.env.NOISE_DB || "-35dB";
const MIN_SILENCE = process.env.MIN_SILENCE || "0.22";

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

function runFfmpeg(args, capture = false) {
  const r = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (capture) return `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed (${r.status}): ${(r.stderr || "").slice(-500)}`);
  }
  return r.stderr || "";
}

function detectSpeechSegments() {
  const log = runFfmpeg(
    [
      "-hide_banner",
      "-ss",
      "0",
      "-t",
      String(ANALYZE_SECONDS),
      "-i",
      SOURCE_MP3,
      "-af",
      `silencedetect=noise=${NOISE_DB}:d=${MIN_SILENCE}`,
      "-f",
      "null",
      "-",
    ],
    true,
  );
  writeFileSync(join(__dirname, "silence-cut-log.txt"), log);

  const starts = [];
  const ends = [];
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*([0-9.]+)/);
    const e = line.match(/silence_end:\s*([0-9.]+)/);
    if (s) starts.push(Number(s[1]));
    if (e) ends.push(Number(e[1]));
  }

  // Speech = silence_end[i] .. silence_start[i+1] (or next start after each end)
  const segments = [];
  for (let i = 0; i < ends.length; i++) {
    const speechStart = ends[i];
    // find first silence_start strictly after this end
    const nextStart = starts.find((t) => t > speechStart + 0.01);
    const speechEnd = nextStart != null ? nextStart : Math.min(speechStart + 0.8, ANALYZE_SECONDS);
    const dur = speechEnd - speechStart;
    if (dur >= MIN_SPEECH && dur <= MAX_SPEECH) {
      segments.push({ start: speechStart, end: speechEnd, dur });
    }
  }
  return segments;
}

function clearOldClips() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith(".mp3")) unlinkSync(join(OUT_DIR, f));
  }
}

function cutClip(rank, word, seg) {
  const start = Math.max(0, seg.start - PAD);
  const end = seg.end + PAD;
  const dur = Math.max(0.05, end - start);
  const name = expectedName(rank, word);
  const out = join(OUT_DIR, name);
  runFfmpeg([
    "-hide_banner",
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
    out,
  ]);
  return {
    rank,
    word,
    audio: name,
    startTime: Number(start.toFixed(3)),
    endTime: Number(end.toFixed(3)),
    speechStart: Number(seg.start.toFixed(3)),
    speechEnd: Number(seg.end.toFixed(3)),
    duration: Number(dur.toFixed(3)),
  };
}

function main() {
  if (!existsSync(SOURCE_MP3)) throw new Error(`Missing source: ${SOURCE_MP3}`);
  console.log(`Detecting speech in first ${ANALYZE_SECONDS}s...`);
  const segments = detectSpeechSegments();
  console.log(`Candidate speech segments: ${segments.length}`);
  writeFileSync(join(__dirname, "speech-segments.json"), JSON.stringify(segments.slice(0, 250), null, 2));

  if (segments.length < COUNT) {
    throw new Error(`Only found ${segments.length} segments, need ${COUNT}. Adjust silence thresholds.`);
  }

  clearOldClips();
  const clips = [];
  const n = Math.min(COUNT, WORDS.length, segments.length);
  for (let i = 0; i < n; i++) {
    const rank = i + 1;
    const word = WORDS[i];
    const row = cutClip(rank, word, segments[i]);
    clips.push(row);
    if (rank % 25 === 0 || rank === n) console.log(`cut ${rank}/${n}: ${row.audio}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceMp3: SOURCE_MP3,
    wordList: "filiph/english_words frequency lemmas (single 'to')",
    noiseDb: NOISE_DB,
    minSilence: MIN_SILENCE,
    padSec: PAD,
    analyzeSeconds: ANALYZE_SECONDS,
    candidateSegments: segments.length,
    clips,
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(__dirname, "manifest-1-200.json"), JSON.stringify(manifest, null, 2));
  console.log(`Done. Wrote ${clips.length} clips to ${OUT_DIR}`);
}

main();
