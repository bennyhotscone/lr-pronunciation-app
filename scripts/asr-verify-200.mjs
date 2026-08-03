import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "audio", "mandarin-vocab");
const WAV_DIR = join(OUT_DIR, "_wav_probe");
const manifest = JSON.parse(readFileSync(join(OUT_DIR, "manifest.json"), "utf8"));

mkdirSync(WAV_DIR, { recursive: true });

function slugNorm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "")
    .replace(/'/g, "");
}

function readWavPcm(path) {
  const buf = readFileSync(path);
  const dataIdx = buf.indexOf(Buffer.from("data"));
  if (dataIdx < 0) throw new Error("no data " + path);
  const pcm = buf.subarray(dataIdx + 8);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

function toWav(mp3Name) {
  const mp3 = join(OUT_DIR, mp3Name);
  const wav = join(WAV_DIR, mp3Name.replace(/\.mp3$/i, ".wav"));
  if (!existsSync(wav)) {
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-i", mp3, "-ac", "1", "-ar", "16000", wav],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error("ffmpeg wav failed " + mp3Name);
  }
  return wav;
}

// Common whisper-tiny confusions on isolated function words
const ALIASES = {
  the: ["d", "duh", "thee", "da"],
  be: ["bee", "b", "bea"],
  a: ["hey", "uh", "ah", "ay"],
  i: ["bye", "eye", "ay", "hi"],
  he: ["hee", "heat", "e"],
  it: ["its", "it's"],
  to: ["two", "too"],
  for: ["four", "fore", "full", "fur"],
  do: ["due", "dew", "two"],
  they: ["day", "dhey", "theyre", "there"],
  of: ["ov", "have"],
  or: ["oar", "are"],
  as: ["has", "ass"],
  are: ["r", "our"],
  our: ["are", "hour"],
  his: ["is", "he's"],
  him: ["hem"],
  her: ["hear", "hur"],
  she: ["see", "shi"],
  we: ["wee"],
  you: ["u", "yew"],
  no: ["know"],
  know: ["no", "now"],
  new: ["knew"],
  one: ["won"],
  two: ["to", "too"],
  four: ["for", "fore"],
  bye: ["by", "buy"],
  by: ["bye", "buy"],
  their: ["there", "theyre"],
  there: ["their", "theyre"],
  its: ["it's", "it"],
  mr: ["mister", "miss"],
};

function matches(expected, heard) {
  const e = slugNorm(expected);
  const h = slugNorm(heard);
  if (!h) return false;
  if (h === e) return true;
  if (h.includes(e) || e.includes(h)) return true;
  const aliases = ALIASES[e] || [];
  return aliases.some((a) => slugNorm(a) === h || h.includes(slugNorm(a)));
}

console.log("loading whisper-tiny.en...");
const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
  dtype: "fp32",
});

const rows = [];
for (const clip of manifest.clips) {
  const wav = toWav(clip.audio);
  const samples = readWavPcm(wav);
  const out = await transcriber(samples, { sampling_rate: 16000, return_timestamps: false });
  const heard = String(out.text || "")
    .trim()
    .toLowerCase()
    .replace(/[.?!,]/g, "")
    .trim();
  const ok = matches(clip.word, heard);
  const flag =
    clip.duration < 0.28 ? "short" : clip.duration > 1.6 ? "long" : ok ? "ok" : "mismatch";
  rows.push({
    rank: clip.rank,
    word: clip.word,
    audio: clip.audio,
    duration: clip.duration,
    heard,
    flag,
  });
  if (clip.rank % 20 === 0 || flag !== "ok") {
    console.log(
      `${String(clip.rank).padStart(4, "0")} ${clip.word.padEnd(12)} heard=${JSON.stringify(heard).padEnd(16)} ${flag}`,
    );
  }
}

const summary = {
  total: rows.length,
  ok: rows.filter((r) => r.flag === "ok").length,
  mismatch: rows.filter((r) => r.flag === "mismatch").length,
  short: rows.filter((r) => r.flag === "short").length,
  long: rows.filter((r) => r.flag === "long").length,
  flagged: rows.filter((r) => r.flag !== "ok"),
  rows,
};
writeFileSync(join(OUT_DIR, "asr-verify-1-200.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(__dirname, "asr-verify-1-200.json"), JSON.stringify(summary, null, 2));
console.log(
  `SUMMARY ok=${summary.ok} mismatch=${summary.mismatch} short=${summary.short} long=${summary.long}`,
);
