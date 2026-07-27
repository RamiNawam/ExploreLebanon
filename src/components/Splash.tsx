import { useState } from 'react';
import Cedar from './Cedar';

interface Props {
  onExplore: () => void;
}

export default function Splash({ onExplore }: Props) {
  const [leaving, setLeaving] = useState(false);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onExplore, 720);
  };

  return (
    <div className={`splash${leaving ? ' is-leaving' : ''}`}>
      <div className="splash__frame">
        <img className="splash__photo" src="/hero.jpg" alt="" aria-hidden="true" />
        <div className="splash__scrim" />
      </div>
      <div className="splash__grain" />

      <div className="splash__content">
        <Cedar className="splash__cedar" />
        <p className="splash__eyebrow">لبنان &middot; Est. adventures</p>
        <h1 className="splash__title">
          <span>Lebanon</span>
          <span>Adventure</span>
        </h1>
        <button type="button" className="splash__cta" onClick={enter}>
          <span>Explore</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 12h15m-6-6 6 6-6 6"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
