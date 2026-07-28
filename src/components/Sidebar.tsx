import { useState } from 'react';
import type { Pin, PinKind } from '../types';
import { formatDate } from '../lib/format';
import Cedar from './Cedar';
import type { Account } from '../lib/auth';

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tab: PinKind;
  onTab: (tab: PinKind) => void;
  pins: Pin[];
  counts: { adventure: number; todo: number };
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: (kind: PinKind) => void;
  onEdit: (pin: Pin) => void;
  onDelete: (pin: Pin) => void;
  onToggleDone: (pin: Pin) => void;
  /** False when the app is running on device-only storage. */
  shared: boolean;
  /** Null in device-only mode, where there is nothing to sign in to. */
  account: Account | null;
  onDevices: () => void;
  onSignOut: () => Promise<void>;
}

export default function Sidebar(props: Props) {
  const {
    collapsed,
    onToggleCollapsed,
    tab,
    onTab,
    pins,
    counts,
    selectedId,
    onSelect,
    onNew,
    onEdit,
    onDelete,
    onToggleDone,
    shared,
    account,
    onDevices,
    onSignOut,
  } = props;

  const [confirmId, setConfirmId] = useState<string | null>(null);

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
          <p className="tip">or press &amp; hold anywhere on the map</p>

          <div className="pin-list">
            {pins.map((pin) => (
              <article
                key={pin.id}
                className={`card card--${pin.kind}${pin.id === selectedId ? ' is-active' : ''}${
                  pin.done ? ' is-done' : ''
                }`}
              >
                <button type="button" className="card__main" onClick={() => onSelect(pin.id)}>
                  <span className="card__thumb">
                    {pin.cover ? (
                      <img src={pin.cover.thumb} alt="" loading="lazy" />
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
                    {pin.description && <span className="card__desc">{pin.description}</span>}
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
            ))}
          </div>

          {account && (
            <div className="account">
              <button type="button" className="account__who" onClick={onDevices}>
                <span className="account__avatar">{account.username.slice(0, 1).toUpperCase()}</span>
                <span className="account__text">
                  <strong>{account.username}</strong>
                  <em>Devices</em>
                </span>
              </button>
              <button type="button" className="account__out" onClick={() => void onSignOut()}>
                Sign out
              </button>
            </div>
          )}

          <footer className="sidebar__foot">
            <span>{pins.length} shown</span>
            <span
              className={`sync${shared ? ' is-live' : ''}`}
              title={
                shared
                  ? 'Pins are saved to the shared map and update live for everyone.'
                  : 'No shared database configured — these pins stay in this browser.'
              }
            >
              <i />
              {shared ? 'Shared live' : 'This device only'}
            </span>
          </footer>
        </div>
      )}
    </aside>
  );
}
