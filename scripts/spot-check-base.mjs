import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "audio", "mandarin-vocab");
const TMP = join(__dirname, "_spot_wav");
mkdirSync(TMP, { recursive: true });
const manifest = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8"));

const ranks = [];
for (let r = 1; r <= 40; r++) ranks.push(r);
for (let r = 50; r <= 200; r += 10) ranks.push(r);

function readWavPcm(path) {
  const buf = readFileSync(path);
  const dataIdx = buf.indexOf(Buffer.from("data"));
  const pcm = buf.subarray(dataIdx + 8);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "");
}

console.log("loading whisper-base.en...");
const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-base.en", {
  dtype: "fp32",
});

const rows = [];
for (const rank of ranks) {
  const clip = manifest.clips.find((c) => c.rank === rank);
  const wav = join(TMP, clip.audio.replace(".mp3", ".wav"));
  spawnSync("ffmpeg", ["-y", "-i", join(OUT, clip.audio), "-ac", "1", "-ar", "16000", wav], {
    encoding: "utf8",
  });
  const out = await transcriber(readWavPcm(wav), { sampling_rate: 16000, return_timestamps: false });
  const heard = String(out.text || "")
    .trim()
    .toLowerCase()
    .replace(/[.?!,]/g, "");
  const ok =
    norm(heard) === norm(clip.word) ||
    norm(heard).includes(norm(clip.word)) ||
    norm(clip.word).includes(norm(heard));
  rows.push({ rank, word: clip.word, heard, ok, duration: clip.duration });
  console.log(
    `${String(rank).padStart(3)} ${clip.word.padEnd(12)} => ${JSON.stringify(heard).padEnd(16)} ${ok ? "OK" : "??"}`,
  );
}
writeFileSync(join(__dirname, "spot-check-base.json"), JSON.stringify(rows, null, 2));
const bad = rows.filter((r) => !r.ok);
console.log(`checked ${rows.length}, uncertain ${bad.length}`);
