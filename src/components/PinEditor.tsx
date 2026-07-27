import { useEffect, useRef, useState } from 'react';
import type { Photo, PinDraft, PinKind } from '../types';
import { imageFilesFrom } from '../lib/images';
import { describeError } from '../lib/errors';
import { repo } from '../lib/repo';
import { governorateAt } from '../lib/geo';
import { coords } from '../lib/format';

interface Props {
  draft: PinDraft;
  onSave: (draft: PinDraft) => void;
  onCancel: () => void;
}

/** Drag-and-drop for laptops; the file inputs cover phones. */
function useDropZone(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        onFiles(imageFilesFrom(e.dataTransfer.files));
      },
    },
  };
}

export default function PinEditor({ draft, onSave, onCancel }: Props) {
  const [form, setForm] = useState<PinDraft>(draft);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(draft);
    setError('');
  }, [draft]);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const patch = <K extends keyof PinDraft>(key: K, value: PinDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isNew = !form.id;
  const governorate = governorateAt(form.lat, form.lng);

  /** Upload one file at a time so slow phone connections stay predictable. */
  const upload = async (files: File[], onEach: (photo: Photo) => void) => {
    if (!files.length) return;
    setBusy(files.length);
    setError('');
    try {
      for (const file of files) {
        onEach(await repo.uploadPhoto(file));
        setBusy((n) => n - 1);
      }
    } catch (err) {
      console.error(err);
      setError(describeError(err, 'That picture could not be added.'));
    } finally {
      setBusy(0);
    }
  };

  const takeCover = (files: File[]) =>
    upload(files.slice(0, 1), (photo) => patch('cover', photo));

  const addPhotos = (files: File[]) =>
    upload(files, (photo) => setForm((prev) => ({ ...prev, photos: [...prev.photos, photo] })));

  const coverZone = useDropZone(takeCover);
  const galleryZone = useDropZone(addPhotos);

  const removePhoto = (photo: Photo) =>
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.id !== photo.id) }));

  const promoteToCover = (photo: Photo) =>
    setForm((prev) => ({
      ...prev,
      cover: photo,
      photos: [
        ...prev.photos.filter((p) => p.id !== photo.id),
        ...(prev.cover ? [prev.cover] : []),
      ],
    }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim()) {
      setError('Give this pin a name.');
      nameRef.current?.focus();
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className={`sheet sheet--${form.kind}`} onSubmit={submit}>
        <header className="sheet__head">
          <div>
            <p className="sheet__eyebrow">{isNew ? 'New pin' : 'Editing'}</p>
            <h2>{form.kind === 'adventure' ? 'Adventure' : 'Place to visit'}</h2>
          </div>
          <button type="button" className="sheet__close" onClick={onCancel} aria-label="Close">
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
        </header>

        <div className="sheet__body">
          <div className="seg" role="group" aria-label="Pin type">
            {(['adventure', 'todo'] as PinKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`seg__btn seg__btn--${kind}${form.kind === kind ? ' is-on' : ''}`}
                onClick={() => patch('kind', kind)}
              >
                <span className={`dot dot--${kind}`} />
                {kind === 'adventure' ? 'Adventure' : 'To-do'}
              </button>
            ))}
          </div>

          <label className="field">
            <span>Name</span>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              placeholder={form.kind === 'adventure' ? 'Sunrise at the Cedars' : 'Baatara Gorge'}
              onChange={(e) => patch('name', e.target.value)}
            />
          </label>

          {form.kind === 'adventure' && (
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => patch('date', e.target.value)}
              />
            </label>
          )}

          <label className="field">
            <span>Description</span>
            <textarea
              rows={4}
              value={form.description}
              placeholder={
                form.kind === 'adventure'
                  ? 'How we got there, what we ate, who we met…'
                  : 'Why we want to go, best season, who to ask…'
              }
              onChange={(e) => patch('description', e.target.value)}
            />
          </label>

          <div className="field">
            <span>Main picture</span>
            {form.cover ? (
              <div className="cover">
                <img src={form.cover.full} alt="" />
                <div className="cover__actions">
                  <label className="ghost-btn">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => takeCover(imageFilesFrom(e.target.files))}
                    />
                  </label>
                  <button type="button" className="ghost-btn" onClick={() => patch('cover', null)}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={`drop${coverZone.over ? ' is-over' : ''}`}
                {...coverZone.handlers}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 17V6h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm2 0 4.5-5 3 3.2 2.5-2.7L20 17"
                  />
                  <circle cx="9" cy="9.5" r="1.4" fill="currentColor" />
                </svg>
                <strong>Add the main picture</strong>
                <em>Tap to open your photos, or drop a file here</em>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => takeCover(imageFilesFrom(e.target.files))}
                />
              </label>
            )}
          </div>

          {form.kind === 'adventure' && (
            <div className="field">
              <span>More pictures {form.photos.length > 0 && `(${form.photos.length})`}</span>
              <div
                className={`gallery-edit${galleryZone.over ? ' is-over' : ''}`}
                {...galleryZone.handlers}
              >
                {form.photos.map((photo) => (
                  <div key={photo.id} className="gallery-edit__item">
                    <img src={photo.thumb} alt="" />
                    <button
                      type="button"
                      className="gallery-edit__star"
                      title="Use as main picture"
                      onClick={() => promoteToCover(photo)}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      className="gallery-edit__del"
                      title="Remove"
                      onClick={() => removePhoto(photo)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="gallery-edit__add" title="Add pictures">
                  <span>+</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => addPhotos(imageFilesFrom(e.target.files))}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="locbox">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
              />
            </svg>
            <div>
              <strong>{governorate || 'Outside Lebanon'}</strong>
              <em>{coords(form.lat, form.lng)}</em>
            </div>
          </div>

          {error && <p className="sheet__error">{error}</p>}
        </div>

        <footer className="sheet__foot">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={`solid-btn solid-btn--${form.kind}`} disabled={busy > 0}>
            {busy > 0
              ? `Uploading ${busy} picture${busy === 1 ? '' : 's'}…`
              : isNew
                ? 'Drop the pin'
                : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}
