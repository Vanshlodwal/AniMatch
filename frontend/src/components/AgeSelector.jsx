const AGE_BANDS = [
  { label: '👶 Kids',         value: 'kids',  age: 10,  desc: 'Under 13' },
  { label: '🎒 Teen',         value: 'teen',  age: 15,  desc: '13–15' },
  { label: '🧑 Young Adult',  value: 'ya',    age: 17,  desc: '16–17' },
  { label: '🔞 Adult',        value: 'adult', age: 22,  desc: '18+' },
];

export default function AgeSelector({ age, onAgeChange }) {
  const activeBand = AGE_BANDS.find(b => b.age === age);

  return (
    <div className="age-selector">
      <div className="age-band-chips">
        {AGE_BANDS.map(band => (
          <button
            key={band.value}
            id={`age-band-${band.value}`}
            className={`chip age-band ${activeBand?.value === band.value ? 'selected' : ''}`}
            onClick={() => onAgeChange(band.age)}
            title={band.desc}
            aria-pressed={activeBand?.value === band.value}
          >
            {band.label}
          </button>
        ))}
      </div>
      <div className="age-input-row">
        <input
          id="age-input"
          type="number"
          className="age-input"
          placeholder="or type age…"
          min={1}
          max={120}
          value={age ?? ''}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            onAgeChange(isNaN(v) ? null : Math.max(1, Math.min(120, v)));
          }}
          aria-label="Enter your age"
        />
        {age && (
          <span className="age-hint">
            {age < 13
              ? '🌟 Kids-safe content only'
              : age < 16
              ? '⚡ Teen-appropriate content'
              : age < 18
              ? '🔥 Young adult content'
              : '✨ All content permitted'}
          </span>
        )}
      </div>
    </div>
  );
}
