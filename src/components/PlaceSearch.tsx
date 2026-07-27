import { useEffect, useRef, useState } from 'react';
import { mergeResults, searchLocal, searchRemote, type Found } from '../lib/search';

interface Props {
  onPick: (found: Found) => void;
}

const ICONS: Record<string, string> = {
  city: 'M4 20V9l6-4 6 4v11M9 20v-5h2v5',
  town: 'M4 20V9l6-4 6 4v11M9 20v-5h2v5',
  site: 'm12 4 2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7L12 4Z',
  river: 'M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M3 18c3-2 5 2 8 0s5-2 8 0',
  place: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z',
};

export default function PlaceSearch({ onPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  /* Curated matches appear instantly; the geocoder follows once typing pauses. */
  useEffect(() => {
    const local = searchLocal(query);
    setResults(local);
    setActive(0);
    setFailed(false);

    if (query.trim().length < 3) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const remote = await searchRemote(query, controller.signal);
        setResults(mergeResults(local, remote));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          setFailed(true);
        }
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  /* Clicking anywhere else puts the list away. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (found: Found) => {
    onPick(found);
    setOpen(false);
    setQuery(found.name);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active] ?? results[0]);
    }
  };

  const showList = open && (results.length > 0 || loading || failed || query.trim().length >= 3);

  return (
    <div className="psearch" ref={boxRef}>
      <div className="psearch__field">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4"
          />
        </svg>
        <input
          type="search"
          value={query}
          placeholder="Search a village, city or place…"
          aria-label="Search for a place in Lebanon"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="psearch__spinner" aria-hidden="true" />}
        {query && !loading && (
          <button
            type="button"
            className="psearch__clear"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {showList && (
        <ul className="psearch__list" role="listbox">
          {results.map((found, i) => (
            <li key={found.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`psearch__hit${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(found)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={ICONS[found.kind] ?? ICONS.place}
                  />
                </svg>
                <span>
                  <strong>{found.name}</strong>
                  <em>{found.detail}</em>
                </span>
              </button>
            </li>
          ))}

          {!results.length && !loading && (
            <li className="psearch__empty">
              {failed ? 'Search is unavailable right now.' : 'Nothing found in Lebanon.'}
            </li>
          )}

          {results.length > 0 && (
            <li className="psearch__credit">Places from OpenStreetMap</li>
          )}
        </ul>
      )}
    </div>
  );
}
