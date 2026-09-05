import { describe, expect, it } from "vitest";
import { getJapaneseCatalog } from "./blocks/catalog";
import { buildWordFamilies, findFamiliesForRomaji } from "./word-families";

describe("word-families", () => {
  const families = buildWordFamilies(getJapaneseCatalog());
  const byId = Object.fromEntries(families.map((f) => [f.id, f]));

  it("builds dare / nani / itsu / dore stem families from playable blocks", () => {
    expect(byId.dare).toBeTruthy();
    expect(byId.dare.nodes.map((n) => n.romaji.toLowerCase())).toEqual(
      expect.arrayContaining(["dare", "dareka"]),
    );

    expect(byId.nani).toBeTruthy();
    const naniKeys = [...new Set(byId.nani.nodes.map((n) => n.romaji.toLowerCase()))];
    expect(naniKeys).toEqual(expect.arrayContaining(["nani"]));
    expect(naniKeys.some((k) => k === "naka")).toBe(false);

    expect(byId.itsu).toBeTruthy();
    expect([...new Set(byId.itsu.nodes.map((n) => n.romaji.toLowerCase()))]).toEqual(
      expect.arrayContaining(["itsu"]),
    );

    expect(byId.dore).toBeTruthy();
    expect([...new Set(byId.dore.nodes.map((n) => n.romaji.toLowerCase()))]).toEqual(
      expect.arrayContaining(["dore"]),
    );
  });

  it("keeps mou / mada as a contrast pair and does not merge douzo into dou", () => {
    expect(byId["mou-mada"]).toBeTruthy();
    expect([...new Set(byId["mou-mada"].nodes.map((n) => n.romaji.toLowerCase()))].sort()).toEqual(
      ["mada", "mou"],
    );
    expect(byId["mou-mada"].kind).toBe("contrast");

    expect(byId.dou).toBeTruthy();
    const douKeys = [...new Set(byId.dou.nodes.map((n) => n.romaji.toLowerCase()))];
    expect(douKeys).toEqual(expect.arrayContaining(["dou", "doushite"]));
    expect(douKeys).not.toContain("douzo");
  });

  it("groups -tai desire forms when present and skips takusan", () => {
    expect(byId["tai-want"]).toBeTruthy();
    const keys = [...new Set(byId["tai-want"].nodes.map((n) => n.romaji.toLowerCase()))];
    expect(keys).toEqual(expect.arrayContaining(["aitai", "shitai"]));
    expect(keys).not.toContain("takusan");
  });

  it("attaches block numbers and english glosses on every node", () => {
    for (const family of families) {
      expect(family.nodes.length).toBeGreaterThanOrEqual(2);
      for (const node of family.nodes) {
        expect(node.blockNumber).toBeGreaterThanOrEqual(1);
        expect(node.blockNumber).toBeLessThanOrEqual(20);
        expect(node.romaji.length).toBeGreaterThan(0);
        expect(node.english.length).toBeGreaterThan(0);
      }
    }
  });

  it("finds families for a romaji lookup", () => {
    const hits = findFamiliesForRomaji("dareka", families);
    expect(hits.some((f) => f.id === "dare")).toBe(true);
  });

  it("indents derived stem members under the root", () => {
    const dare = byId.dare;
    const root = dare.nodes.find((n) => n.romaji.toLowerCase() === "dare");
    const child = dare.nodes.find((n) => n.romaji.toLowerCase() === "dareka");
    expect(root?.depth).toBe(0);
    expect(child?.depth).toBe(1);
  });
});
