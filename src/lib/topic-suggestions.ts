/**
 * Free ESL topic breakdowns for the lesson editor.
 * Pure lookup / patterns — no LLM, no API keys, $0 running cost.
 */

export type TopicSuggestionPack = {
  id: string;
  label: string;
  items: string[];
};

type PackDef = {
  id: string;
  label: string;
  /** Lowercase phrases that trigger this pack when found in title/summary. */
  aliases: string[];
  items: string[];
};

const PACKS: PackDef[] = [
  {
    id: "narrative-tenses",
    label: "Narrative tenses",
    aliases: [
      "narrative tense",
      "narrative tenses",
      "story tenses",
      "past narrative",
      "telling a story",
      "storytelling past",
    ],
    items: [
      "Past Simple for main events",
      "Past Continuous for background",
      "Past Perfect for earlier past",
      "Time markers (when / while / after / before)",
      "Sequence words (first / then / finally)",
      "Practice: tell a short story",
    ],
  },
  {
    id: "present-perfect",
    label: "Present Perfect",
    aliases: ["present perfect", "have you ever", "experience tense"],
    items: [
      "Form: have/has + past participle",
      "Experience vs finished past",
      "Just / already / yet",
      "For / since",
      "Ever / never",
      "Practice: interview questions",
    ],
  },
  {
    id: "present-perfect-continuous",
    label: "Present Perfect Continuous",
    aliases: ["present perfect continuous", "have been -ing", "how long have you been"],
    items: [
      "Form: have/has been + -ing",
      "Duration up to now",
      "Temporary / unfinished actions",
      "Compared with Present Perfect Simple",
      "Practice: recent activities",
    ],
  },
  {
    id: "conditionals",
    label: "Conditionals",
    aliases: ["conditionals", "if clauses", "zero conditional", "first conditional", "second conditional", "third conditional"],
    items: [
      "Zero conditional (facts / habits)",
      "First conditional (real future)",
      "Second conditional (unreal present)",
      "Third conditional (unreal past)",
      "Unless / as long as / provided",
      "Practice: advice & hypotheticals",
    ],
  },
  {
    id: "passive",
    label: "Passive voice",
    aliases: ["passive voice", "passive", "be + past participle"],
    items: [
      "Form: be + past participle",
      "When we omit the agent",
      "Present / past / future passive",
      "By + agent",
      "Practice: news headlines",
    ],
  },
  {
    id: "reported-speech",
    label: "Reported speech",
    aliases: ["reported speech", "indirect speech", "reported questions"],
    items: [
      "Say / tell + clause",
      "Backshifting tenses",
      "Pronoun & time changes",
      "Reported questions",
      "Reporting verbs (suggest / advise / warn)",
      "Practice: retell a conversation",
    ],
  },
  {
    id: "modals",
    label: "Modal verbs",
    aliases: ["modals", "modal verbs", "can could may might must should"],
    items: [
      "Ability: can / could / be able to",
      "Obligation: must / have to / should",
      "Possibility: may / might / could",
      "Advice & permission",
      "Past modals (should have / could have)",
      "Practice: problem advice",
    ],
  },
  {
    id: "articles",
    label: "Articles (a / an / the)",
    aliases: ["articles", "a an the", "definite article", "indefinite article"],
    items: [
      "A / an for first mention",
      "The for known / unique things",
      "Zero article (general plurals / uncountables)",
      "Common fixed phrases",
      "Practice: gap-fill sentences",
    ],
  },
  {
    id: "prepositions",
    label: "Prepositions",
    aliases: ["prepositions", "preposition of time", "preposition of place", "in on at"],
    items: [
      "Time: in / on / at",
      "Place: in / on / at",
      "Movement: to / into / onto",
      "Dependent prepositions (interested in…)",
      "Practice: describe a route",
    ],
  },
  {
    id: "phrasal-verbs",
    label: "Phrasal verbs",
    aliases: ["phrasal verbs", "phrasal verb", "multi-word verbs"],
    items: [
      "Separable vs inseparable",
      "Common daily life set",
      "Meaning from context",
      "Formal one-word alternatives",
      "Practice: replace formal verbs",
    ],
  },
  {
    id: "relative-clauses",
    label: "Relative clauses",
    aliases: ["relative clauses", "relative clause", "who which that where"],
    items: [
      "Who / which / that",
      "Where / when / whose",
      "Defining vs non-defining",
      "Omitting the relative pronoun",
      "Practice: combine two sentences",
    ],
  },
  {
    id: "gerunds-infinitives",
    label: "Gerunds & infinitives",
    aliases: ["gerunds", "infinitives", "gerund and infinitive", "verb patterns", "-ing or to"],
    items: [
      "Verb + -ing patterns",
      "Verb + to-infinitive patterns",
      "Verbs that change meaning (stop / remember / try)",
      "After prepositions → -ing",
      "Practice: rewrite with correct form",
    ],
  },
  {
    id: "future-forms",
    label: "Future forms",
    aliases: ["future forms", "will vs going to", "future tenses", "be going to"],
    items: [
      "Will for decisions / offers / predictions",
      "Going to for plans & evidence",
      "Present Continuous for arrangements",
      "Present Simple for schedules",
      "Practice: weekend plans",
    ],
  },
  {
    id: "used-to",
    label: "Used to / would",
    aliases: ["used to", "would for past habits", "past habits"],
    items: [
      "Used to + infinitive (past habits / states)",
      "Would for repeated past actions",
      "Be / get used to + -ing",
      "Compared with Past Simple",
      "Practice: then vs now",
    ],
  },
  {
    id: "countable",
    label: "Countable & uncountable",
    aliases: ["countable", "uncountable", "much many", "some any", "quantifiers"],
    items: [
      "Countable vs uncountable nouns",
      "Some / any / a lot of",
      "Much / many / a few / a little",
      "Containers & units (a piece of…)",
      "Practice: shopping / recipes",
    ],
  },
  {
    id: "connectors",
    label: "Linking words",
    aliases: ["linking words", "connectors", "discourse markers", "cohesion"],
    items: [
      "Addition (and / also / furthermore)",
      "Contrast (but / however / although)",
      "Cause & result (because / so / therefore)",
      "Sequencing (first / next / finally)",
      "Practice: upgrade a short paragraph",
    ],
  },
  {
    id: "comparatives",
    label: "Comparatives & superlatives",
    aliases: ["comparatives", "superlatives", "comparative", "as as"],
    items: [
      "Short vs long adjectives",
      "More / most",
      "As… as / not as… as",
      "Irregular forms (good / better / best)",
      "Practice: compare two cities",
    ],
  },
  {
    id: "pronunciation-lr",
    label: "L / R pronunciation",
    aliases: ["l and r", "l/r", "pronunciation l", "pronunciation r", "minimal pairs l r"],
    items: [
      "Mouth position for /l/",
      "Mouth position for /r/",
      "Minimal pairs (light/right, long/wrong)",
      "Word-initial practice",
      "In sentences / listening check",
    ],
  },
  {
    id: "job-interview",
    label: "Job interview English",
    aliases: ["job interview", "interview english", "cv interview", "tell me about yourself"],
    items: [
      "Tell me about yourself",
      "Strengths & weaknesses",
      "Past experience answers",
      "Questions to ask the interviewer",
      "Practice: mock interview",
    ],
  },
  {
    id: "email-writing",
    label: "Email writing",
    aliases: ["email writing", "formal email", "business email", "writing emails"],
    items: [
      "Subject line",
      "Greeting & sign-off",
      "Formal vs informal tone",
      "Request phrases",
      "Practice: write a short email",
    ],
  },
  {
    id: "ielts-speaking",
    label: "IELTS Speaking",
    aliases: ["ielts speaking", "speaking part 1", "speaking part 2", "speaking part 3"],
    items: [
      "Part 1 short answers",
      "Part 2 long turn structure",
      "Part 3 opinions & reasons",
      "Fluency & fillers (natural)",
      "Practice: timed cue card",
    ],
  },
  {
    id: "listening-skills",
    label: "Listening skills",
    aliases: ["listening skills", "listening practice", "listening for gist"],
    items: [
      "Listening for gist",
      "Listening for detail",
      "Predicting before audio",
      "Note-taking while listening",
      "Practice: short clip + questions",
    ],
  },
  {
    id: "vocabulary-building",
    label: "Vocabulary building",
    aliases: ["vocabulary", "vocab", "word families", "collocations"],
    items: [
      "Target word list",
      "Collocations",
      "Word families / forms",
      "Example sentences",
      "Practice: use 5 new words in speech",
    ],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function alreadyHas(existingTitles: string[], item: string): boolean {
  const want = normalize(item);
  return existingTitles.some((t) => normalize(t) === want);
}

/** Split free text into candidate topic lines when no curated pack matches. */
function fallbackFromText(text: string, existingTitles: string[]): TopicSuggestionPack | null {
  const raw = text.trim();
  if (raw.length < 3) return null;

  const chunks = raw
    .split(/[\n;•·]|,(?=\s)|(?:\s+(?:and|&)\s+)/i)
    .map((s) => s.replace(/^[\-\*\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 80);

  const uniq: string[] = [];
  for (const c of chunks) {
    if (alreadyHas(existingTitles, c) || alreadyHas(uniq, c)) continue;
    // Skip if the chunk is basically the whole blob with no split
    if (chunks.length === 1 && c.length > 48) continue;
    uniq.push(c);
  }

  if (uniq.length < 2) {
    // Still offer a single “cover this topic” item from the phrase
    const phrase = raw.length > 72 ? `${raw.slice(0, 69).trim()}…` : raw;
    if (alreadyHas(existingTitles, phrase)) return null;
    return {
      id: "from-text",
      label: "From what you typed",
      items: [phrase],
    };
  }

  return {
    id: "from-text",
    label: "From what you typed",
    items: uniq.slice(0, 8),
  };
}

/**
 * Suggest topic checklist items from lesson title + “what we covered” text.
 */
export function suggestTopicBreakdown(
  title: string,
  summary: string,
  existingTitles: string[] = [],
): TopicSuggestionPack[] {
  const hay = normalize(`${title} ${summary}`);
  if (!hay) return [];

  const out: TopicSuggestionPack[] = [];

  for (const pack of PACKS) {
    const hit = pack.aliases.some((a) => hay.includes(a));
    if (!hit) continue;
    const items = pack.items.filter((item) => !alreadyHas(existingTitles, item));
    if (!items.length) continue;
    out.push({ id: pack.id, label: pack.label, items });
  }

  if (!out.length) {
    const fallback = fallbackFromText(summary.trim() || title.trim(), existingTitles);
    if (fallback) out.push(fallback);
  }

  return out;
}

/** Match a classroom tag / topic to a curated pack (for free self-help checklists). */
export function matchTopicPack(topic: string): TopicSuggestionPack | null {
  const hay = normalize(topic);
  if (!hay) return null;
  for (const pack of PACKS) {
    if (pack.aliases.some((a) => hay.includes(a) || a.includes(hay))) {
      return { id: pack.id, label: pack.label, items: [...pack.items] };
    }
  }
  return null;
}

/**
 * Turn pack breakdown lines into student competency / can-do checks.
 * Keeps teacher editor packs as short topic labels.
 */
export function competencyChecksFromPack(items: string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (/^practice:\s*/i.test(item)) {
        const rest = item.replace(/^practice:\s*/i, "").trim();
        const body = rest.charAt(0).toLowerCase() + rest.slice(1);
        return `I can ${body}`;
      }
      if (
        /^form:/i.test(item) ||
        /\bvs\b/i.test(item) ||
        /^compared/i.test(item) ||
        /^meaning/i.test(item)
      ) {
        const body = item.charAt(0).toLowerCase() + item.slice(1);
        return `I understand ${body}`;
      }
      const body = item.charAt(0).toLowerCase() + item.slice(1);
      return `I can use ${body}`;
    });
}
