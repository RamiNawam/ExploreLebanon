import { useState } from 'react';
import type { Pin, PinKind } from '../types';
import { GOVERNORATE_NAMES } from '../lib/geo';
import { formatDate } from '../lib/format';
import Cedar from './Cedar';

export interface Filters {
  query: string;
  governorate: string;
  from: string;
  to: string;
  sort: 'newest' | 'oldest' | 'name';
}

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tab: PinKind;
  onTab: (tab: PinKind) => void;
  filters: Filters;
  onFilters: (next: Filters) => void;
  pins: Pin[];
  counts: { adventure: number; todo: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: (kind: PinKind) => void;
  onEdit: (pin: Pin) => void;
  onDelete: (pin: Pin) => void;
  onToggleDone: (pin: Pin) => void;
}

export default function Sidebar(props: Props) {
  const {
    collapsed,
    onToggleCollapsed,
    tab,
    onTab,
    filters,
    onFilters,
    pins,
    counts,
    selectedId,
    onSelect,
    onNew,
    onEdit,
    onDelete,
    onToggleDone,
  } = props;

  const [showFilters, setShowFilters] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onFilters({ ...filters, [key]: value });

  const filtersActive =
    !!filters.query || !!filters.governorate || !!filters.from || !!filters.to;

  return (
    <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="sidebar__handle"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Open the adventure log' : 'Collapse the adventure log'}
        title={collapsed ? 'Open the adventure log' : 'Collapse the adventure log'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}
          />
        </svg>
      </button>

      {collapsed ? (
        <div className="rail">
          <Cedar className="rail__cedar" />
          <button
            type="button"
            className="rail__chip rail__chip--adventure"
            onClick={onToggleCollapsed}
            title="Adventures"
          >
            {counts.adventure}
          </button>
          <button
            type="button"
            className="rail__chip rail__chip--todo"
            onClick={onToggleCollapsed}
            title="To-do"
          >
            {counts.todo}
          </button>
          <span className="rail__label">Adventure log</span>
        </div>
      ) : (
        <div className="sidebar__inner">
          <header className="sidebar__head">
            <Cedar className="sidebar__cedar" />
            <div>
              <h2>Adventure Log</h2>
              <p>Lebanon, pin by pin</p>
            </div>
          </header>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'adventure'}
              className={`tabs__btn tabs__btn--adventure${tab === 'adventure' ? ' is-on' : ''}`}
              onClick={() => onTab('adventure')}
            >
              Adventures<span>{counts.adventure}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'todo'}
              className={`tabs__btn tabs__btn--todo${tab === 'todo' ? ' is-on' : ''}`}
              onClick={() => onTab('todo')}
            >
              To-do<span>{counts.todo}</span>
            </button>
          </div>

          <button type="button" className={`add-btn add-btn--${tab}`} onClick={() => onNew(tab)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M12 5v14M5 12h14"
              />
            </svg>
            {tab === 'adventure' ? 'Drop a new adventure pin' : 'Add a place to visit'}
          </button>

          <div className="filters">
            <div className="filters__row">
              <label className="search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4"
                  />
                </svg>
                <input
                  type="search"
                  value={filters.query}
                  placeholder="Search pins…"
                  onChange={(e) => set('query', e.target.value)}
                />
              </label>
              <button
                type="button"
                className={`filters__toggle${showFilters ? ' is-on' : ''}${filtersActive ? ' has-dot' : ''}`}
                onClick={() => setShowFilters((v) => !v)}
                aria-label="Filters"
                title="Filters"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    d="M4 7h16M7 12h10M10 17h4"
                  />
                </svg>
              </button>
            </div>

            {showFilters && (
              <div className="filters__panel">
                <label className="field">
                  <span>Governorate</span>
                  <select
                    value={filters.governorate}
                    onChange={(e) => set('governorate', e.target.value)}
                  >
                    <option value="">All of Lebanon</option>
                    {GOVERNORATE_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                {tab === 'adventure' && (
                  <div className="field-pair">
                    <label className="field">
                      <span>From</span>
                      <input
                        type="date"
                        value={filters.from}
                        onChange={(e) => set('from', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>To</span>
                      <input
                        type="date"
                        value={filters.to}
                        onChange={(e) => set('to', e.target.value)}
                      />
                    </label>
                  </div>
                )}

                <label className="field">
                  <span>Sort</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => set('sort', e.target.value as Filters['sort'])}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">By name</option>
                  </select>
                </label>

                {filtersActive && (
                  <button
                    type="button"
                    className="filters__clear"
                    onClick={() =>
                      onFilters({ ...filters, query: '', governorate: '', from: '', to: '' })
                    }
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="pin-list">
            {pins.length === 0 && filtersActive ? (
              <p className="empty">Nothing matches these filters.</p>
            ) : (
              pins.map((pin) => (
                <article
                  key={pin.id}
                  className={`card card--${pin.kind}${pin.id === selectedId ? ' is-active' : ''}${
                    pin.done ? ' is-done' : ''
                  }`}
                >
                  <button type="button" className="card__main" onClick={() => onSelect(pin.id)}>
                    <span className="card__thumb">
                      {pin.cover ? (
                        <img src={pin.cover.thumb} alt="" />
                      ) : (
                        <Cedar className="card__thumb-fallback" />
                      )}
                    </span>
                    <span className="card__text">
                      <span className="card__name">{pin.name}</span>
                      <span className="card__meta">
                        {pin.kind === 'adventure' && pin.date && (
                          <span className="card__date">{formatDate(pin.date)}</span>
                        )}
                        {pin.governorate && <span className="card__gov">{pin.governorate}</span>}
                      </span>
                      {pin.description && (
                        <span className="card__desc">{pin.description}</span>
                      )}
                      {pin.photos.length > 0 && (
                        <span className="card__count">
                          +{pin.photos.length} photo{pin.photos.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="card__actions">
                    {pin.kind === 'todo' && (
                      <button
                        type="button"
                        className={`icon-btn${pin.done ? ' is-on' : ''}`}
                        onClick={() => onToggleDone(pin)}
                        title={pin.done ? 'Mark as still to do' : 'Mark as visited'}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m5 12.5 4.5 4.5L19 7.5"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onEdit(pin)}
                      title="Edit"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                        />
                      </svg>
                    </button>
                    {confirmId === pin.id ? (
                      <span className="confirm">
                        <button
                          type="button"
                          className="confirm__yes"
                          onClick={() => {
                            setConfirmId(null);
                            onDelete(pin);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="confirm__no"
                          onClick={() => setConfirmId(null)}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => setConfirmId(pin.id)}
                        title="Delete"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 7h12M9 7V5h6v2m-8 0 1 13h8l1-13"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <footer className="sidebar__foot">
            <span>{pins.length} shown</span>
          </footer>
        </div>
      )}
    </aside>
  );
}
