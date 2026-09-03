import type { ParticleLesson } from "./types";

export const PARTICLES: ParticleLesson[] = [
  {
    id: "o",
    title: "Particle O",
    subtitle: "The thing an action happens to",
    rule: "THING + o + ACTION",
    explain: "Use o after the thing you eat, drink, read, watch, buy, etc.",
    examples: [
      { romaji: "mizu o nomu", jp: "\u6c34\u3092\u98f2\u3080", en: "drink water" },
      { romaji: "niku o taberu", jp: "\u8089\u3092\u98df\u3079\u308b", en: "eat meat" },
      { romaji: "hon o yomu", jp: "\u672c\u3092\u8aad\u3080", en: "read a book" },
    ],
    questions: [
      {
        en: "drink water",
        romaji: "mizu o nomu",
        jp: "\u6c34\u3092\u98f2\u3080",
        tiles: ["mizu", "niku", "hon", "o", "ni", "de", "nomu", "taberu", "yomu", "iku"],
      },
      {
        en: "eat meat",
        romaji: "niku o taberu",
        jp: "\u8089\u3092\u98df\u3079\u308b",
        tiles: ["niku", "mizu", "hon", "o", "ni", "de", "taberu", "nomu", "kau", "iku"],
      },
      {
        en: "read a book",
        romaji: "hon o yomu",
        jp: "\u672c\u3092\u8aad\u3080",
        tiles: ["hon", "mizu", "niku", "o", "ni", "de", "yomu", "kaku", "miru", "iku"],
      },
    ],
  },
  {
    id: "ni",
    title: "Particle NI",
    subtitle: "TO a destination",
    rule: "PLACE + ni + MOVEMENT",
    explain: "For now, learn one use only: ni = TO a destination.",
    examples: [
      { romaji: "gakkou ni iku", jp: "\u5b66\u6821\u306b\u884c\u304f", en: "go to school" },
      { romaji: "mise ni iku", jp: "\u5e97\u306b\u884c\u304f", en: "go to the shop" },
      { romaji: "ie ni kaeru", jp: "\u5bb6\u306b\u5e30\u308b", en: "go home / return home" },
    ],
    questions: [
      {
        en: "go to school",
        romaji: "gakkou ni iku",
        jp: "\u5b66\u6821\u306b\u884c\u304f",
        tiles: ["gakkou", "mise", "ie", "ni", "de", "o", "iku", "kuru", "kaeru", "taberu"],
      },
      {
        en: "go to the shop",
        romaji: "mise ni iku",
        jp: "\u5e97\u306b\u884c\u304f",
        tiles: ["mise", "gakkou", "ie", "ni", "de", "o", "iku", "kau", "taberu", "kuru"],
      },
      {
        en: "go home / return home",
        romaji: "ie ni kaeru",
        jp: "\u5bb6\u306b\u5e30\u308b",
        tiles: ["ie", "mise", "gakkou", "ni", "de", "o", "kaeru", "iku", "kuru", "neru"],
      },
    ],
  },
  {
    id: "de",
    title: "Particle DE",
    subtitle: "Where an action happens",
    rule: "PLACE + de + ACTION",
    explain:
      "Use de for the place where you DO something. gakkou ni iku = go TO school; gakkou de taberu = eat AT school.",
    examples: [
      { romaji: "ie de taberu", jp: "\u5bb6\u3067\u98df\u3079\u308b", en: "eat at home" },
      { romaji: "gakkou de hataraku", jp: "\u5b66\u6821\u3067\u50cd\u304f", en: "work at school" },
      { romaji: "mise de kau", jp: "\u5e97\u3067\u8cb7\u3046", en: "buy at the shop" },
    ],
    questions: [
      {
        en: "eat at home",
        romaji: "ie de taberu",
        jp: "\u5bb6\u3067\u98df\u3079\u308b",
        tiles: ["ie", "gakkou", "mise", "de", "ni", "o", "taberu", "neru", "iku", "kau"],
      },
      {
        en: "work at school",
        romaji: "gakkou de hataraku",
        jp: "\u5b66\u6821\u3067\u50cd\u304f",
        tiles: ["gakkou", "ie", "mise", "de", "ni", "o", "hataraku", "iku", "neru", "taberu"],
      },
      {
        en: "buy at the shop",
        romaji: "mise de kau",
        jp: "\u5e97\u3067\u8cb7\u3046",
        tiles: ["mise", "ie", "gakkou", "de", "ni", "o", "kau", "iku", "taberu", "hon"],
      },
    ],
  },
  {
    id: "no",
    title: "Particle NO",
    subtitle: "Possession / relationship",
    rule: "X + no + Y",
    explain: "Put no between two nouns. It often works like English 's or 'of'.",
    examples: [
      { romaji: "watashi no hon", jp: "\u79c1\u306e\u672c", en: "my book" },
      { romaji: "tomodachi no ie", jp: "\u53cb\u9054\u306e\u5bb6", en: "friend's house" },
      { romaji: "watashi no tomodachi", jp: "\u79c1\u306e\u53cb\u9054", en: "my friend" },
    ],
    questions: [
      {
        en: "my book",
        romaji: "watashi no hon",
        jp: "\u79c1\u306e\u672c",
        tiles: ["watashi", "anata", "tomodachi", "no", "o", "ni", "hon", "ie", "gakkou", "mise"],
      },
      {
        en: "friend's house",
        romaji: "tomodachi no ie",
        jp: "\u53cb\u9054\u306e\u5bb6",
        tiles: ["tomodachi", "watashi", "hito", "no", "o", "de", "ie", "hon", "gakkou", "mise"],
      },
      {
        en: "my friend",
        romaji: "watashi no tomodachi",
        jp: "\u79c1\u306e\u53cb\u9054",
        tiles: ["watashi", "anata", "hito", "no", "ni", "de", "tomodachi", "hon", "ie", "gakkou"],
      },
    ],
  },
  {
    id: "to",
    title: "Particle TO",
    subtitle: "WITH a person",
    rule: "PERSON + to + ACTION",
    explain: "For now, learn to as WITH: doing an action together with someone.",
    examples: [
      { romaji: "tomodachi to iku", jp: "\u53cb\u9054\u3068\u884c\u304f", en: "go with a friend" },
      { romaji: "tomodachi to taberu", jp: "\u53cb\u9054\u3068\u98df\u3079\u308b", en: "eat with a friend" },
      { romaji: "tomodachi to hataraku", jp: "\u53cb\u9054\u3068\u50cd\u304f", en: "work with a friend" },
    ],
    questions: [
      {
        en: "go with a friend",
        romaji: "tomodachi to iku",
        jp: "\u53cb\u9054\u3068\u884c\u304f",
        tiles: ["tomodachi", "hito", "watashi", "to", "ni", "de", "iku", "kuru", "taberu", "hataraku"],
      },
      {
        en: "eat with a friend",
        romaji: "tomodachi to taberu",
        jp: "\u53cb\u9054\u3068\u98df\u3079\u308b",
        tiles: ["tomodachi", "hito", "watashi", "to", "ni", "o", "taberu", "nomu", "iku", "mizu"],
      },
      {
        en: "work with a friend",
        romaji: "tomodachi to hataraku",
        jp: "\u53cb\u9054\u3068\u50cd\u304f",
        tiles: ["tomodachi", "hito", "watashi", "to", "de", "ni", "hataraku", "iku", "neru", "gakkou"],
      },
    ],
  },
];