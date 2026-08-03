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

const ranks = [
  1, 2, 3, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22, 23, 30, 40, 50, 60, 75, 90, 100, 120, 140, 160, 175, 190, 200,
];

function readWavPcm(path) {
  const buf = readFileSync(path);
  const dataIdx = buf.indexOf(Buffer.from("data"));
  const pcm = buf.subarray(dataIdx + 8);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
  dtype: "fp32",
});

const rows = [];
for (const rank of ranks) {
  const clip = manifest.clips.find((c) => c.rank === rank);
  const wav = join(TMP, clip.audio.replace(".mp3", ".wav"));
  if (!existsSync(wav)) {
    spawnSync("ffmpeg", ["-y", "-i", join(OUT, clip.audio), "-ac", "1", "-ar", "16000", wav], {
      encoding: "utf8",
    });
  }
  const out = await transcriber(readWavPcm(wav), { sampling_rate: 16000, return_timestamps: false });
  const heard = String(out.text || "")
    .trim()
    .toLowerCase()
    .replace(/[.?!,]/g, "");
  rows.push({ rank, word: clip.word, heard, duration: clip.duration });
  console.log(String(rank).padStart(3), clip.word.padEnd(12), "=>", JSON.stringify(heard));
}
writeFileSync(join(__dirname, "spot-check.json"), JSON.stringify(rows, null, 2));
