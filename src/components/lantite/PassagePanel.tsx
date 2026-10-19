import { TEXT_TYPE_LABELS } from "@/lib/lantite/labels";
import type { LantitePassage } from "@/lib/lantite/types";

export function passageParagraphs(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text.trim()];
}

export function PassagePanel({ passage }: { passage: LantitePassage }) {
  const paragraphs = passageParagraphs(passage.text);
  return (
    <section className="lantite-passage lantite-panel" aria-label="Reading text">
      <p className="lantite-passage-kicker">Text to read</p>
      <p className="lantite-passage-type">{TEXT_TYPE_LABELS[passage.textType]}</p>
      <h2 className="lantite-passage-title">{passage.title}</h2>
      <div className="lantite-passage-body">
        {paragraphs.map((paragraph, index) => (
          <p key={`${passage.id}-${index}`}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
