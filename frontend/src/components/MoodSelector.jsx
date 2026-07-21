const MOODS = [
  { label: '😊 Happy',        value: 'Happy' },
  { label: '😢 Sad',          value: 'Sad' },
  { label: '😤 Stressed',     value: 'Stressed' },
  { label: '😴 Bored',        value: 'Bored' },
  { label: '🌙 Nostalgic',    value: 'Nostalgic' },
  { label: '⚡ Excited',      value: 'Excited' },
  { label: '💔 Heartbroken',  value: 'Heartbroken' },
  { label: '😌 Relaxed',      value: 'Relaxed' },
  { label: '🔍 Curious',      value: 'Curious' },
];

export default function MoodSelector({ selected, onSelect }) {
  return (
    <div className="mood-grid" role="group" aria-label="Select your mood">
      {MOODS.map(m => (
        <button
          key={m.value}
          id={`mood-${m.value.toLowerCase()}`}
          className={`chip mood ${selected === m.value ? 'selected' : ''}`}
          onClick={() => onSelect(selected === m.value ? null : m.value)}
          aria-pressed={selected === m.value}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
