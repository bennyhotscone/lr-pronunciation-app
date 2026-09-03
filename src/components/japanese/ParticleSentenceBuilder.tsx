"use client";

type ParticleSentenceBuilderProps = {
  instruction: string;
  tiles: string[];
  selected: string[];
  locked: boolean;
  singleSelect?: boolean;
  onSelectedChange: (next: string[]) => void;
  onClear: () => void;
  onCheck: () => void;
};

export function ParticleSentenceBuilder({
  instruction,
  tiles,
  selected,
  locked,
  singleSelect = false,
  onSelectedChange,
  onClear,
  onCheck,
}: ParticleSentenceBuilderProps) {
  const addTile = (token: string) => {
    if (locked) return;
    if (singleSelect) onSelectedChange([token]);
    else onSelectedChange([...selected, token]);
  };

  const removeAt = (index: number) => {
    if (locked) return;
    onSelectedChange(selected.filter((_, i) => i !== index));
  };

  return (
    <div>
      <p className="jp-learn-sub">{instruction}</p>
      <div className="jp-particle-answer-line" aria-live="polite">
        {selected.length === 0 ? (
          <span className="jp-particle-answer-placeholder">Tap words below</span>
        ) : (
          selected.map((token, index) => (
            <button
              key={`${token}-${index}`}
              type="button"
              className="jp-particle-chosen"
              disabled={locked}
              onClick={() => removeAt(index)}
            >
              {token}
            </button>
          ))
        )}
      </div>
      <div className="jp-particle-tile-pool">
        {tiles.map((token) => (
          <button
            key={token}
            type="button"
            className="jp-particle-tile"
            disabled={locked}
            onClick={() => addTile(token)}
          >
            {token}
          </button>
        ))}
      </div>
      <div className="jp-learn-row" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="jp-learn-btn" disabled={locked} onClick={onClear}>
          Clear
        </button>
        <button type="button" className="jp-learn-btn jp-learn-btn-primary" disabled={locked} onClick={onCheck}>
          Check
        </button>
      </div>
    </div>
  );
}