const GENRES = [
  { label: '⚔️ Action',         value: 'Action' },
  { label: '💘 Romance',         value: 'Romance' },
  { label: '😂 Comedy',          value: 'Comedy' },
  { label: '🌀 Isekai',          value: 'Isekai' },
  { label: '👻 Horror',          value: 'Horror' },
  { label: '🍵 Slice of Life',   value: 'Slice of Life' },
  { label: '⚽ Sports',          value: 'Sports' },
  { label: '🚀 Sci-Fi',          value: 'Sci-Fi' },
  { label: '🧙 Fantasy',         value: 'Fantasy' },
  { label: '🧠 Psychological',   value: 'Psychological' },
  { label: '🕶️ Seinen',         value: 'Seinen' },
  { label: '🍷 Josei',          value: 'Josei' },
  { label: '🗡️ Shonen',          value: 'Shonen' },
  { label: '🌸 Shojo',           value: 'Shojo' },
  { label: '🔪 Thriller',        value: 'Thriller' },
  { label: '🎌 Historical',      value: 'Historical' },
  { label: '🎭 Drama',           value: 'Drama' },
  { label: '🌊 Adventure',       value: 'Adventure' },
  { label: '🎵 Music',           value: 'Music' },
];

export default function GenreSelector({ selected, onToggle }) {
  return (
    <div className="genre-grid" role="group" aria-label="Select genres">
      {GENRES.map(g => (
        <button
          key={g.value}
          id={`genre-${g.value.toLowerCase().replace(/[\s/]+/g, '-')}`}
          className={`chip ${selected.includes(g.value) ? 'selected' : ''}`}
          onClick={() => onToggle(g.value)}
          aria-pressed={selected.includes(g.value)}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
