import type {
  Difficulty,
  LantiteQuestion,
  Pitfall,
  Skill,
} from "@/lib/lantite/types";

export function question(input: {
  id: string;
  passageId: string;
  skill: Skill;
  category: "reading" | "conventions";
  difficulty: Difficulty;
  tags: string[];
  pitfall?: Pitfall | null;
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  optionWhy: [string, string, string, string];
}): LantiteQuestion {
  return {
    pitfall: null,
    ...input,
  };
}
