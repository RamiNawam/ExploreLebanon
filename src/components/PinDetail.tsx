import { useEffect, useState } from 'react';
import type { Pin } from '../types';
import { coords, formatDate } from '../lib/format';
import Cedar from './Cedar';

interface Props {
  pin: Pin;
  onClose: () => void;
  onEdit: (pin: Pin) => void;
  onDelete: (pin: Pin) => void;
  onReposition: (pin: Pin) => void;
  onToggleDone: (pin: Pin) => void;
}

export default function PinDetail({
  pin,
  onClose,
  onEdit,
  onDelete,
  onReposition,
  onToggleDone,
}: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const all = [...(pin.cover ? [pin.cover] : []), ...pin.photos];

  useEffect(() => {
    setLightbox(null);
    setConfirming(false);
  }, [pin.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox !== null) setLightbox(null);
        else onClose();
      }
      if (lightbox === null || all.length < 2) return;
      if (e.key === 'ArrowRight') setLightbox((i) => ((i ?? 0) + 1) % all.length);
      if (e.key === 'ArrowLeft') setLightbox((i) => ((i ?? 0) - 1 + all.length) % all.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, all.length, onClose]);

  return (
    <>
      <section className={`detail detail--${pin.kind}`} key={pin.id}>
        <button type="button" className="detail__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              d="M6 6l12 12M18 6 6 18"
            />
          </svg>
        </button>

        <div className="detail__hero">
          {pin.cover ? (
            <button type="button" className="detail__hero-btn" onClick={() => setLightbox(0)}>
              <img src={pin.cover.full} alt={pin.name} />
              <span className="detail__zoom">View</span>
            </button>
          ) : (
            <div className="detail__hero-empty">
              <Cedar />
            </div>
          )}
          <div className="detail__hero-fade" />
          <div className="detail__hero-text">
            <span className={`badge badge--${pin.kind}`}>
              {pin.kind === 'adventure' ? 'Adventure' : pin.done ? 'Visited' : 'On the list'}
            </span>
            <h2>{pin.name}</h2>
          </div>
        </div>

        <div className="detail__body">
          <dl className="facts">
            {pin.kind === 'adventure' && pin.date && (
              <div className="facts__row">
                <dt>Date</dt>
                <dd>{formatDate(pin.date)}</dd>
              </div>
            )}
            <div className="facts__row">
              <dt>Governorate</dt>
              <dd>{pin.governorate || '—'}</dd>
            </div>
            <div className="facts__row">
              <dt>Coordinates</dt>
              <dd className="mono">{coords(pin.lat, pin.lng)}</dd>
            </div>
          </dl>

          {pin.description && <p className="detail__desc">{pin.description}</p>}

          {pin.photos.length > 0 && (
            <div className="gallery">
              <h3>
                Gallery <span>{pin.photos.length}</span>
              </h3>
              <div className="gallery__grid">
                {pin.photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="gallery__item"
                    onClick={() => setLightbox(i + (pin.cover ? 1 : 0))}
                  >
                    <img src={photo.thumb} alt="" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="detail__actions">
            {pin.kind === 'todo' && (
              <button
                type="button"
                className={`solid-btn solid-btn--todo${pin.done ? ' is-off' : ''}`}
                onClick={() => onToggleDone(pin)}
              >
                {pin.done ? 'Put back on the list' : 'Mark as visited'}
              </button>
            )}
            <button type="button" className="ghost-btn" onClick={() => onEdit(pin)}>
              Edit
            </button>
            <button type="button" className="ghost-btn" onClick={() => onReposition(pin)}>
              Reposition
            </button>
            {confirming ? (
              <span className="confirm confirm--wide">
                <button type="button" className="confirm__yes" onClick={() => onDelete(pin)}>
                  Delete for good
                </button>
                <button
                  type="button"
                  className="confirm__no"
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="ghost-btn ghost-btn--danger"
                onClick={() => setConfirming(true)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </section>

      {lightbox !== null && all[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={all[lightbox].full} alt="" onClick={(e) => e.stopPropagation()} />
          {all.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) => ((i ?? 0) - 1 + all.length) % all.length);
                }}
                aria-label="Previous picture"
              >
                ‹
              </button>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--next"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) => ((i ?? 0) + 1) % all.length);
                }}
                aria-label="Next picture"
              >
                ›
              </button>
              <span className="lightbox__count">
                {lightbox + 1} / {all.length}
              </span>
            </>
          )}
          <button type="button" className="lightbox__close" aria-label="Close">
            ×
          </button>
        </div>
      )}
    </>
  );
}
