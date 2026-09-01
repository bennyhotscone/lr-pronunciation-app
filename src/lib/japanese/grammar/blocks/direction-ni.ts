import type { GrammarBlock } from "../types";

export const directionNiBlock: GrammarBlock = {
  id: "direction-ni",
  title: "Direction with \u306b",
  order: 1,
  teach: {
    title: "Going to a place \u2014 \u306b after the destination",
    summary:
      "To say you are going somewhere, name the place, add \u306b, then say the movement word (like go or return home).",
    sections: [
      {
        heading: "What it means",
        body: "\u306b marks where you are headed. Think: place + \u306b + go. It answers where to in plain English.",
      },
      {
        heading: "What you can say",
        body: "You can talk about everyday trips: to the shop, to school, to Tokyo, or back home.",
      },
      {
        heading: "How to form it",
        body: "Pick a place word you already know, add \u306b, finish with \u884c\u304f (go) or \u5e30\u308b (return home). No extra words needed.",
      },
    ],
    examples: [
      { jp: "\u5e97\u306b\u884c\u304f", romaji: "mise ni iku", en: "go to the shop", breakdown: "mise | ni | iku" },
      { jp: "\u5b66\u6821\u306b\u884c\u304f", romaji: "gakkou ni iku", en: "go to school", breakdown: "gakkou | ni | iku" },
      { jp: "\u6771\u4eac\u306b\u884c\u304f", romaji: "Tokyo ni iku", en: "go to Tokyo", breakdown: "Tokyo | ni | iku" },
      { jp: "\u5bb6\u306b\u5e30\u308b", romaji: "ie ni kaeru", en: "go home", breakdown: "ie | ni | kaeru" },
      { jp: "\u99c5\u306b\u884c\u304f", romaji: "eki ni iku", en: "go to the station", breakdown: "eki | ni | iku" },
    ],
  },
  guided: [
    { kind: "mc", prompt: "What does mise ni iku mean?", choices: ["go to the shop", "come from the shop", "like the shop"], answerIndex: 0, hint: "ni shows direction." },
    { kind: "mc", prompt: "Which word marks the destination before iku?", choices: ["ni", "wo", "de"], answerIndex: 0 },
    { kind: "fill", prompt: "Complete: go to school", before: "gakkou", after: "iku", answers: ["ni"], hint: "place + ni + iku" },
    { kind: "fill", prompt: "Complete: go home", before: "ie", after: "kaeru", answers: ["ni"] },
    { kind: "reorder", prompt: "Build: go to the shop", words: ["ni", "iku", "mise"], answer: "mise ni iku" },
    { kind: "reorder", prompt: "Build: go to Tokyo", words: ["Tokyo", "ni", "iku"], answer: "Tokyo ni iku" },
    { kind: "build", prompt: "Build: go to the station", bank: ["eki", "ni", "iku", "kaeru", "ie"], answer: "eki ni iku" },
    { kind: "mc", prompt: "ie ni kaeru means", choices: ["go home", "leave home", "buy a house"], answerIndex: 0 },
  ],
  recall: [
    { id: "dn-r1", direction: "j-to-e", promptJp: "\u5e97\u306b\u884c\u304f", promptRomaji: "mise ni iku", audio: "\u307f\u305b\u306b\u3044\u304f", answers: ["go to the shop", "go to shop", "i go to the shop"] },
    { id: "dn-r2", direction: "j-to-e", promptJp: "\u5b66\u6821\u306b\u884c\u304f", promptRomaji: "gakkou ni iku", audio: "\u304c\u3063\u3053\u3046\u306b\u3044\u304f", answers: ["go to school", "i go to school"] },
    { id: "dn-r3", direction: "j-to-e", promptJp: "\u6771\u4eac\u306b\u884c\u304f", promptRomaji: "Tokyo ni iku", audio: "\u3068\u3046\u304d\u3087\u3046\u306b\u3044\u304f", answers: ["go to tokyo", "go to Tokyo", "i go to tokyo"] },
    { id: "dn-r4", direction: "j-to-e", promptJp: "\u5bb6\u306b\u5e30\u308b", promptRomaji: "ie ni kaeru", audio: "\u3044\u3048\u306b\u304b\u3048\u308b", answers: ["go home", "return home", "go back home"] },
    { id: "dn-r5", direction: "e-to-j", promptEn: "go to the shop", romajiAnswers: ["mise ni iku"], answers: ["mise ni iku"] },
    { id: "dn-r6", direction: "e-to-j", promptEn: "go to school", romajiAnswers: ["gakkou ni iku"], answers: ["gakkou ni iku"] },
    { id: "dn-r7", direction: "e-to-j", promptEn: "go to Tokyo", romajiAnswers: ["tokyo ni iku", "toukyou ni iku"], answers: ["tokyo ni iku", "toukyou ni iku"] },
    { id: "dn-r8", direction: "e-to-j", promptEn: "go home", romajiAnswers: ["ie ni kaeru"], answers: ["ie ni kaeru"] },
  ],
};