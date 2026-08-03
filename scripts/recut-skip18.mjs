/**
 * Re-cut first 200 words using silencedetect segments.
 * Empirically: segments 0..17 map to words 1..18; skip spurious seg 18
 * (duplicate "say"); words 19..200 use segments 19..200.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SOURCE_MP3 = "C:\\Users\\Administrator\\Downloads\\0001 (4).mp3";
const OUT_DIR = join(ROOT, "public", "audio", "mandarin-vocab");
const WORDS = JSON.parse(readFileSync(join(__dirname, "words-1-200.json"), "utf8"));
const PAD = 0.09;
const SKIP_SEG_INDEX = 18; // spurious duplicate after "say"

function slugify(word) {
  return String(word)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "word";
}

function ffmpeg(args, capture = false) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (capture) return `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.status !== 0) throw new Error((r.stderr || "").slice(-400));
  return "";
}

function detect() {
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
  return segments;
}

function segIndexForRank(rank) {
  const i = rank - 1;
  if (i < SKIP_SEG_INDEX) return i;
  return i + 1; // skip spurious segment
}

const segments = detect();
console.log("segments", segments.length);

for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith(".mp3")) unlinkSync(join(OUT_DIR, f));
}

const clips = [];
for (let rank = 1; rank <= 200; rank++) {
  const word = WORDS[rank - 1];
  const si = segIndexForRank(rank);
  const seg = segments[si];
  if (!seg) throw new Error(`Missing segment ${si} for rank ${rank}`);
  const start = Math.max(0, seg.start - PAD);
  const end = seg.end + PAD;
  const dur = end - start;
  const audio = `${String(rank).padStart(4, "0")}-${slugify(word)}.mp3`;
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
    join(OUT_DIR, audio),
  ]);
  clips.push({
    rank,
    word,
    audio,
    startTime: Number(start.toFixed(3)),
    endTime: Number(end.toFixed(3)),
    duration: Number(dur.toFixed(3)),
    segIndex: si,
  });
  if (rank % 25 === 0) console.log("cut", rank, audio, `seg=${si}`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  method: "silencedetect 1:1 with skip duplicate segment after say (index 18)",
  sourceMp3: SOURCE_MP3,
  wordList: "filiph/english_words frequency lemmas",
  skipSegIndex: SKIP_SEG_INDEX,
  clips,
};
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("done", clips.length);
