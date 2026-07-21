const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];

export default function RecommendationCard({ rec, index, isStreaming }) {
  const isGemini = GEMINI_MODELS.some(m => rec.model_used?.includes(m));

  if (isStreaming && rec.raw_text) {
    return (
      <div className="recommendation-card card-streaming">
        <div className="card-accent-bar" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div className="streaming-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            AI is generating recommendations…
          </span>
        </div>
        <div className="streaming-text">
          {rec.raw_text}
          <span className="cursor-blink" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const currentField = rec.currentField;

  return (
    <div 
      className={`recommendation-card ${isStreaming ? 'card-streaming-structured' : ''}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="card-accent-bar" />

      {isStreaming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div className="streaming-dots">
            <span /><span /><span />
          </div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            AI is writing this recommendation…
          </span>
        </div>
      )}

      <div className="card-number">{index + 1}</div>

      <h3 className="card-title">
        {rec.title || (isStreaming ? 'Thinking...' : 'Anime Recommendation')}
        {isStreaming && currentField === 'title' && <span className="cursor-blink" aria-hidden="true" />}
      </h3>

      {rec.age_rating_note && (
        <div className="card-age-badge">
          🛡️ {rec.age_rating_note}
          {isStreaming && currentField === 'age_rating_note' && <span className="cursor-blink" aria-hidden="true" />}
        </div>
      )}

      {rec.synopsis && (
        <p className="card-synopsis">
          {rec.synopsis}
          {isStreaming && currentField === 'synopsis' && <span className="cursor-blink" aria-hidden="true" />}
        </p>
      )}

      {rec.why && (
        <div className="card-why">
          <div className="card-why-label">Why it fits you</div>
          <p className="card-why-text">
            {rec.why}
            {isStreaming && currentField === 'why' && <span className="cursor-blink" aria-hidden="true" />}
          </p>
        </div>
      )}

      {rec.genre_tags && rec.genre_tags.length > 0 && (
        <div className="card-tags">
          {rec.genre_tags.map((tag, tIdx) => (
            <span key={tag} className="card-tag">
              # {tag}
              {isStreaming && currentField === 'genre_tags' && tIdx === rec.genre_tags.length - 1 && (
                <span className="cursor-blink" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
      )}

      {rec.model_used && (
        <div className="card-model">
          Served by{' '}
          <span className={`model-indicator ${isGemini ? '' : 'fallback'}`}>
            {isGemini ? '✦ ' : '⚡ '}
            {rec.model_used}
          </span>
          {!isGemini && (
            <span style={{ color: 'var(--color-gold)', fontSize: '0.72rem', marginLeft: 4 }}>
              (fallback)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
