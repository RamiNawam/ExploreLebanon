import { useEffect, useState } from 'react';
import { forgetDevice, listDevices, type Device } from '../lib/auth';
import { describeError } from '../lib/errors';

interface Props {
  onClose: () => void;
}

function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function Devices({ onClose }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listDevices()
      .then(setDevices)
      .catch((err) => setError(describeError(err, 'Could not list your devices.')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const revoke = async (device: Device) => {
    try {
      await forgetDevice(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
    } catch (err) {
      setError(describeError(err, 'Could not remove that device.'));
    }
  };

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet sheet--devices">
        <header className="sheet__head">
          <div>
            <p className="sheet__eyebrow">Your account</p>
            <h2>Signed-in devices</h2>
          </div>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
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
          {loading && <p className="devices__empty">Loading…</p>}
          {error && <p className="sheet__error">{error}</p>}

          {!loading &&
            devices.map((device) => (
              <div key={device.id} className={`devrow${device.current ? ' is-current' : ''}`}>
                <div>
                  <strong>
                    {device.label}
                    {device.current && <span className="devrow__here">this device</span>}
                  </strong>
                  <em>Last seen {ago(device.lastSeen)}</em>
                </div>
                {!device.current && (
                  <button type="button" className="ghost-btn" onClick={() => revoke(device)}>
                    Remove
                  </button>
                )}
              </div>
            ))}

          {!loading && !devices.length && !error && (
            <p className="devices__empty">No devices recorded yet.</p>
          )}

          <p className="devices__note">
            Removing a device clears it from this list. It signs out the next time that browser
            reloads the map.
          </p>
        </div>
      </div>
    </div>
  );
}
