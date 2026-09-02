import { describe, expect, it } from "vitest";
import {
  MILESTONE_STORY_CACHE_VERSION,
  MILESTONE_STORY_VOCAB_ONLY,
  parseMilestoneStoryCacheVersion,
  formatMilestoneStoryProvider,
  storyCacheIsStale,
} from "./milestone-story";

describe("milestone-story cache", () => {
  it("parses cache version from provider string", () => {
    expect(parseMilestoneStoryCacheVersion(null)).toBe(0);
    expect(parseMilestoneStoryCacheVersion("openai")).toBe(0);
    expect(parseMilestoneStoryCacheVersion("v2:vocab-drill")).toBe(2);
    expect(parseMilestoneStoryCacheVersion("v2:llm")).toBe(2);
  });

  it("formats provider with version prefix", () => {
    expect(formatMilestoneStoryProvider(2, "vocab-drill")).toBe("v2:vocab-drill");
  });

  it("uses vocab-only flag constant", () => {
    expect(MILESTONE_STORY_VOCAB_ONLY).toBe(true);
    expect(MILESTONE_STORY_CACHE_VERSION).toBe(6);
  });

  it("treats pre-v6 cached stories as stale", () => {
    expect(storyCacheIsStale("v5:vocab-drill", ["konnichiwa - hello"], true)).toBe(true);
    expect(storyCacheIsStale("v6:vocab-drill", ["konnichiwa - hello"], true)).toBe(false);
  });
});