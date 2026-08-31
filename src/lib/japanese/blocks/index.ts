import type { JapaneseWord } from "../types";
import block1 from "./block1.json";

const BLOCKS: Record<number, JapaneseWord[]> = {
  1: block1 as JapaneseWord[],
};

export function getJapaneseBlock(blockNumber: number): JapaneseWord[] {
  const words = BLOCKS[blockNumber];
  if (!words) throw new Error(`Japanese block ${blockNumber} not loaded`);
  return words;
}

export function getAvailableBlockNumbers(): number[] {
  return Object.keys(BLOCKS)
    .map(Number)
    .sort((a, b) => a - b);
}
