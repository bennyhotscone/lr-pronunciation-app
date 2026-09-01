import type { GrammarBlock } from "./types";
import { directionNiBlock } from "./blocks/direction-ni";

const BLOCKS: GrammarBlock[] = [directionNiBlock];

export function getGrammarBlock(id: string): GrammarBlock | undefined {
  return BLOCKS.find((b) => b.id === id);
}

export function getAllGrammarBlocks(): GrammarBlock[] {
  return [...BLOCKS].sort((a, b) => a.order - b.order);
}

export function getDefaultGrammarBlockId(): string {
  return directionNiBlock.id;
}
