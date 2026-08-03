import { pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const wavDir = 'public/audio/mandarin-vocab/_wav_probe';
const files = readdirSync(wavDir).filter(f => f.endsWith('.wav')).sort();

function readWavPcm(path) {
  const buf = readFileSync(path);
  const dataIdx = buf.indexOf(Buffer.from('data'));
  if (dataIdx < 0) throw new Error('no data chunk ' + path);
  const pcm = buf.subarray(dataIdx + 8);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = pcm.readInt16LE(i * 2) / 32768;
  }
  return samples;
}

console.log('loading whisper-tiny.en...');
const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', { dtype: 'fp32' });
const results = [];
for (const file of files) {
  const samples = readWavPcm(join(wavDir, file));
  const out = await transcriber(samples, { sampling_rate: 16000, return_timestamps: false });
  const text = (out.text || '').trim().toLowerCase().replace(/[^a-z'\s]/g,'').trim();
  results.push({ file, text });
  console.log(file, '=>', JSON.stringify(text));
}
writeFileSync('public/audio/mandarin-vocab/asr-probe.json', JSON.stringify(results, null, 2));
console.log('done', results.length);
