import type { PairCategory } from "@/data/pairs";
import type { LearnerLanguage } from "@/types/progress";

export const ARTICULATION_GUIDANCE = {
  l: "For English /l/, touch the tip of your tongue just behind your upper front teeth, then release into the vowel. Keep the sides of the tongue free.",
  r: "For English /r/, do not tap. Curl or bunch the tongue without touching the ridge behind your teeth, and round the lips slightly.",
} as const;

const LANGUAGE_TIPS: Record<
  LearnerLanguage,
  Record<PairCategory | "default", string>
> = {
  ja: {
    initial:
      "Japanese often uses a tap that sounds between L and R. Slow down and hold /l/ or /r/ instead of tapping once.",
    "consonant-cluster":
      "Avoid inserting a vowel inside clusters (for example, “bu-rush” for brush). Keep /l/ or /r/ tight after the first consonant.",
    "longer-word":
      "Keep the L/R contrast on the stressed syllable, even when the word gets longer.",
    review:
      "Review tip: compare the two words side by side and exaggerate the tongue shape before saying them at normal speed.",
    default:
      "Focus on a clear contrast: tongue tip contact for /l/, no contact for /r/.",
  },
  th: {
    initial:
      "Thai learners may merge L and R in some positions. Hold the English tongue shape a little longer than feels natural.",
    "consonant-cluster":
      "Watch for dropped consonants in clusters. Keep both the first consonant and the L or R.",
    "longer-word":
      "Longer words still need a clear L/R start or mid-word contrast—do not soften it away.",
    review:
      "Review tip: listen once, then say both words, then listen again to check the contrast.",
    default:
      "Aim for intelligibility: make /l/ and /r/ clearly different from each other.",
  },
  other: {
    initial:
      "Listen to both words, then copy the tongue shape for the sound you are practising.",
    "consonant-cluster":
      "Say the cluster slowly first, then speed up without adding an extra vowel.",
    "longer-word":
      "Keep the L/R contrast clear even when the rest of the word feels busy.",
    review: "Use review pairs to check that the contrast still holds at normal speed.",
    default: "Compare the two words and exaggerate the difference, then relax into a natural pace.",
  },
};

export function getLanguageTip(
  language: LearnerLanguage,
  category: PairCategory,
): string {
  return LANGUAGE_TIPS[language][category] ?? LANGUAGE_TIPS[language].default;
}
