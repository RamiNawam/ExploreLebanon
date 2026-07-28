import { useRef, useState } from 'react';
import Cedar from './Cedar';
import { deviceLabel, signIn } from '../lib/auth';
import { describeError } from '../lib/errors';

/**
 * No props: a successful sign-in fires Supabase's auth listener, which is what
 * swaps this screen for the map.
 */
export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(username, password);
    } catch (err) {
      console.error(err);
      setError(describeError(err, 'Could not sign in.'));
      setPassword('');
      userRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <img className="gate__photo" src="/hero.jpg" alt="" aria-hidden="true" />
      <div className="gate__scrim" />

      <form className="gate__card" onSubmit={submit}>
        <Cedar className="gate__cedar" />
        <h1>Lebanon Adventure</h1>
        <p className="gate__lede">Sign in once — this device stays signed in afterwards.</p>

        <label className="field">
          <span>Username</span>
          <input
            ref={userRef}
            type="text"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="RamiNawam"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="gate__error">{error}</p>}

        <button type="submit" className="gate__cta" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="gate__device">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="5"
              y="3"
              width="14"
              height="18"
              rx="2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M10.6 18h2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          This device will be remembered as <strong>{deviceLabel()}</strong>
        </p>
      </form>
    </div>
  );
}
