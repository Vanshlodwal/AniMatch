import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

import Particles from './components/Particles';
import AgeSelector from './components/AgeSelector';
import GenreSelector from './components/GenreSelector';
import MoodSelector from './components/MoodSelector';
import RecommendationCard from './components/RecommendationCard';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Local storage helpers — session memory (PRD §5.5)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'animatch_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function savePrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
  catch {}
}

// ---------------------------------------------------------------------------
// SSE streaming helper — reads chunked text/event-stream
// ---------------------------------------------------------------------------
async function* streamSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try { yield JSON.parse(payload); } catch {}
    }
  }
}

function normalizeRecommendation(obj, modelUsed) {
  if (!obj) return null;
  const title = obj.title || obj.anime || obj.name || '';
  const synopsis = obj.synopsis || obj.description || obj.summary || '';
  const why = obj.why || obj.reason || obj.explanation || '';
  const age_rating_note = obj.age_rating_note || obj.rating || obj.age_rating || '';
  
  let genre_tags = [];
  if (Array.isArray(obj.genre_tags)) {
    genre_tags = obj.genre_tags;
  } else if (Array.isArray(obj.genres)) {
    genre_tags = obj.genres;
  } else if (typeof obj.genre_tags === 'string') {
    genre_tags = obj.genre_tags.split(',').map(s => s.trim());
  } else if (typeof obj.genres === 'string') {
    genre_tags = obj.genres.split(',').map(s => s.trim());
  }

  return {
    title,
    synopsis,
    why,
    age_rating_note,
    genre_tags,
    model_used: obj.model_used || modelUsed
  };
}

function extractField(str, fieldName) {
  // Try completed match first
  const completedRegex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
  const completedMatch = str.match(completedRegex);
  if (completedMatch) {
    return completedMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }

  // Try incomplete match
  const incompleteRegex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)$`);
  const incompleteMatch = str.match(incompleteRegex);
  if (incompleteMatch) {
    return incompleteMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }

  return '';
}

function extractArrayField(str, fieldName) {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)\\]`);
  const match = str.match(regex);
  if (match) {
    return match[1]
      .split(',')
      .map(s => {
        const m = s.match(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/);
        return m ? m[1].replace(/\\"/g, '"') : '';
      })
      .map(s => s.trim())
      .filter(Boolean);
  }

  const incompleteRegex = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)$`);
  const incompleteMatch = str.match(incompleteRegex);
  if (incompleteMatch) {
    return incompleteMatch[1]
      .split(',')
      .map(s => {
        const m = s.match(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/);
        if (m) return m[1].replace(/\\"/g, '"');
        const mInc = s.match(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)$/);
        if (mInc) return mInc[1].replace(/\\"/g, '"');
        return '';
      })
      .map(s => s.trim())
      .filter(Boolean);
  }

  return [];
}

function bestEffortParse(str) {
  const title = extractField(str, 'title') || extractField(str, 'anime') || extractField(str, 'name');
  const synopsis = extractField(str, 'synopsis') || extractField(str, 'description') || extractField(str, 'summary');
  const why = extractField(str, 'why') || extractField(str, 'reason') || extractField(str, 'explanation');
  const age_rating_note = extractField(str, 'age_rating_note') || extractField(str, 'rating') || extractField(str, 'age_rating');
  let genre_tags = extractArrayField(str, 'genre_tags');
  if (genre_tags.length === 0) {
    genre_tags = extractArrayField(str, 'genres');
  }
  return { title, synopsis, why, age_rating_note, genre_tags };
}

function processParsedJson(parsed, modelUsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed
      .map(r => normalizeRecommendation(r, modelUsed))
      .filter(r => r && (r.title || r.synopsis));
  }
  if (typeof parsed === 'object') {
    const listKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (listKey) {
      return parsed[listKey]
        .map(r => normalizeRecommendation(r, modelUsed))
        .filter(r => r && (r.title || r.synopsis));
    }
    const normalized = normalizeRecommendation(parsed, modelUsed);
    if (normalized && (normalized.title || normalized.synopsis)) {
      return [normalized];
    }
  }
  return [];
}

function parseStreamingState(text, modelUsed) {
  if (!text) return { objects: [], remainingText: '', incompleteObj: null };

  const objects = [];
  let braceDepth = 0;
  let inString = false;
  let escape = false;
  let startIndex = -1;
  let lastCompletedEndIndex = 0;

  const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        if (braceDepth === 0) {
          startIndex = i;
        }
        braceDepth++;
      } else if (char === '}' || char === ']') {
        braceDepth--;
        if (braceDepth === 0 && startIndex !== -1) {
          const objStr = cleanText.substring(startIndex, i + 1);
          try {
            const parsed = JSON.parse(objStr);
            const items = processParsedJson(parsed, modelUsed);
            if (items.length > 0) {
              objects.push(...items);
              lastCompletedEndIndex = i + 1;
            }
          } catch (e) {
            try {
              const cleaned = objStr.replace(/,(\s*[\]}])/g, '$1');
              const parsed = JSON.parse(cleaned);
              const items = processParsedJson(parsed, modelUsed);
              if (items.length > 0) {
                objects.push(...items);
                lastCompletedEndIndex = i + 1;
              }
            } catch (err) {
              // Wait until complete
            }
          }
          startIndex = -1;
        }
      }
    }
  }

  let remainingText = '';
  let incompleteObj = null;

  if (lastCompletedEndIndex < cleanText.length) {
    remainingText = cleanText.substring(lastCompletedEndIndex).trim();
    const startOfObj = remainingText.indexOf('{');
    if (startOfObj !== -1) {
      const partialObjStr = remainingText.substring(startOfObj);
      const partialParsed = bestEffortParse(partialObjStr);
      incompleteObj = normalizeRecommendation(partialParsed, modelUsed);
      
      if (incompleteObj && (incompleteObj.title || incompleteObj.synopsis || incompleteObj.why)) {
        if (partialObjStr.includes('"genre_tags"')) {
          incompleteObj.currentField = 'genre_tags';
        } else if (partialObjStr.includes('"why"')) {
          incompleteObj.currentField = 'why';
        } else if (partialObjStr.includes('"age_rating_note"')) {
          incompleteObj.currentField = 'age_rating_note';
        } else if (partialObjStr.includes('"synopsis"')) {
          incompleteObj.currentField = 'synopsis';
        } else if (partialObjStr.includes('"title"')) {
          incompleteObj.currentField = 'title';
        }
      } else {
        incompleteObj = null;
      }
    }
  }

  return { objects, remainingText, incompleteObj };
}

function parseRecommendations(text, modelUsed) {
  const { objects, incompleteObj } = parseStreamingState(text, modelUsed);
  const result = [...objects];
  if (incompleteObj && (incompleteObj.title || incompleteObj.synopsis || incompleteObj.why)) {
    result.push(incompleteObj);
  }
  return result.length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const prefs = loadPrefs();

  const [age,    setAge]    = useState(prefs.age    ?? null);
  const [genres, setGenres] = useState(prefs.genres ?? []);
  const [mood,   setMood]   = useState(prefs.mood   ?? null);

  const [status,          setStatus]          = useState('idle');
  const [streamingText,   setStreamingText]   = useState('');
  const [streamingCard,   setStreamingCard]   = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [lastModel,       setLastModel]       = useState(null);
  const [errorMsg,        setErrorMsg]        = useState('');

  const abortRef   = useRef(null);
  const resultsRef = useRef(null);

  // Persist prefs on change
  useEffect(() => { savePrefs({ age, genres, mood }); }, [age, genres, mood]);

  const toggleGenre = useCallback(genre => {
    setGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  }, []);

  // Core streaming function shared by both endpoints
  const doStream = useCallback(async (url, options) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setStreamingText('');
    setStreamingCard(null);
    setRecommendations([]);
    setErrorMsg('');
    setLastModel(null);

    setTimeout(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100
    );

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Request failed');
      }

      setStatus('streaming');
      let accumulated = '';
      let currentModel = null;

      for await (const event of streamSSE(res)) {
        if (controller.signal.aborted) break;

        if (event.error) {
          setErrorMsg(event.error);
          setStatus('error');
          return;
        }

        if (event.chunk) {
          accumulated += event.chunk;
          currentModel = event.model_used || currentModel;
          setLastModel(currentModel);
          
          const { objects, remainingText, incompleteObj } = parseStreamingState(accumulated, currentModel);
          setRecommendations(objects);
          setStreamingCard(incompleteObj);
          setStreamingText(remainingText);
        }

        if (event.done) {
          currentModel = event.model_used || currentModel;
          setLastModel(currentModel);
        }
      }

      const finalParsed = parseRecommendations(accumulated, currentModel);
      if (finalParsed && finalParsed.length > 0) {
        setRecommendations(finalParsed);
        setStreamingCard(null);
        setStreamingText('');
      } else {
        // Graceful fallback: show raw text if JSON parsing fails
        setRecommendations([{
          title: 'Recommendation',
          synopsis: accumulated,
          why: '', age_rating_note: '', genre_tags: [],
          model_used: currentModel,
        }]);
        setStreamingCard(null);
        setStreamingText('');
      }
      setStatus('done');

    } catch (err) {
      if (err.name === 'AbortError') return;
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }, []);


  // POST /api/recommend
  const handleRecommend = useCallback(() => {
    if (!age)             { setErrorMsg('Please enter your age.');             setStatus('error'); return; }
    if (!genres.length)   { setErrorMsg('Please select at least one genre.');  setStatus('error'); return; }
    if (!mood)            { setErrorMsg('Please select your current mood.');   setStatus('error'); return; }

    doStream(`${API_BASE}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age, genres, mood }),
    });
  }, [age, genres, mood, doStream]);

  // GET /api/random
  const handleRandom = useCallback(() => {
    const params = age ? `?age=${age}` : '';
    doStream(`${API_BASE}/api/random${params}`, { method: 'GET' });
  }, [age, doStream]);

  const isLoading   = status === 'loading' || status === 'streaming';
  const canRecommend = age && genres.length > 0 && mood && !isLoading;

  return (
    <>
      <Particles />

      <main className="app-container">

        {/* ===== Hero ===== */}
        <header className="hero-header">
          <div className="hero-logo">
            <div className="logo-icon" aria-hidden="true">⛩️</div>
          </div>
          <h1 className="hero-title">AniMatch</h1>
          <p className="hero-tagline">
            AI-powered anime recommendations tailored to your age, genre taste &amp; mood
          </p>
          <div className="hero-badge">Powered by Gemini · OpenRouter fallback chain</div>
        </header>

        {/* ===== Form ===== */}
        <section aria-label="Recommendation form" className="glass-card form-section">

          <div>
            <div className="section-label">Your Age</div>
            <AgeSelector age={age} onAgeChange={setAge} />
          </div>

          <div>
            <div className="section-label">
              Preferred Genres
              {genres.length > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--color-primary-light)', fontWeight: 600 }}>
                  ({genres.length} selected)
                </span>
              )}
            </div>
            <GenreSelector selected={genres} onToggle={toggleGenre} />
          </div>

          <div>
            <div className="section-label">Current Mood</div>
            <MoodSelector selected={mood} onSelect={setMood} />
          </div>

          <div className="btn-row">
            <button
              id="btn-recommend"
              className="btn btn-primary"
              onClick={handleRecommend}
              disabled={!canRecommend}
              aria-label="Get anime recommendations"
            >
              {status === 'loading' ? (
                <><span className="streaming-dots"><span /><span /><span /></span> Finding your match…</>
              ) : '✦ Find My Anime'}
            </button>

            <button
              id="btn-random"
              className="btn btn-random"
              onClick={handleRandom}
              disabled={isLoading}
              aria-label="Surprise me with a random anime"
            >
              🎲 Surprise Me
            </button>
          </div>
        </section>

        {/* ===== Results ===== */}
        <section ref={resultsRef} aria-live="polite" aria-label="Recommendations">

          {status === 'error' && errorMsg && (
            <div className="error-banner" role="alert">
              <span className="error-icon">⚠️</span>
              <div><strong>Oops! </strong>{errorMsg}</div>
            </div>
          )}

          {(status === 'loading' || status === 'streaming') && (
            <div className="recommendations-section">
              {recommendations.length === 0 && <div className="loading-bar" aria-hidden="true" />}
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} isStreaming={false} />
              ))}
              {(streamingCard || streamingText) && (
                <RecommendationCard
                  rec={streamingCard || { raw_text: streamingText, model_used: lastModel }}
                  index={recommendations.length}
                  isStreaming
                />
              )}
            </div>
          )}

          {status === 'done' && recommendations.length > 0 && (
            <div className="recommendations-section">
              <div className="section-title">
                ✦ Your Recommendations
                {lastModel && (
                  <span
                    className={`model-indicator ${lastModel.includes('gemini') ? '' : 'fallback'}`}
                    style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
                  >
                    {lastModel.includes('gemini') ? '✦' : '⚡'} {lastModel}
                  </span>
                )}
              </div>
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} isStreaming={false} />
              ))}
            </div>
          )}
        </section>

        {/* ===== Footer ===== */}
        <footer className="app-footer">
          <p>AniMatch v1.0 · FastAPI + Gemini AI · OpenRouter fallback chain</p>
          <p style={{ marginTop: 4 }}>No API keys are ever exposed to the browser 🔒</p>
        </footer>

      </main>
    </>
  );
}
