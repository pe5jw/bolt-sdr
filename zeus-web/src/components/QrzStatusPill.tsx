import { useEffect, useRef, useState } from 'react';
import { useQrzStore } from '../state/qrz-store';

export function QrzStatusPill() {
  const connected = useQrzStore((s) => s.connected);
  const hasXml = useQrzStore((s) => s.hasXmlSubscription);
  const home = useQrzStore((s) => s.home);
  const rememberedUsername = useQrzStore((s) => s.rememberedUsername);
  const loginInFlight = useQrzStore((s) => s.loginInFlight);
  const loginError = useQrzStore((s) => s.loginError);
  const login = useQrzStore((s) => s.login);
  const logout = useQrzStore((s) => s.logout);

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(rememberedUsername);
  const [password, setPassword] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Keep the form's username in sync when the store hydrates from localStorage
  // after first render (initial value of rememberedUsername may have been '').
  useEffect(() => {
    if (!username && rememberedUsername) setUsername(rememberedUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberedUsername]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = connected
    ? `QRZ: ${home?.callsign ?? 'ON'}${hasXml ? '' : ' (no XML)'}`
    : 'QRZ: off';
  const pillClass = connected
    ? 'bg-emerald-700/40 text-emerald-300'
    : 'bg-neutral-800 text-neutral-400';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await login(username.trim(), password);
    if (ok) {
      setPassword('');
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${pillClass} rounded px-2 py-0.5 text-xs hover:brightness-125`}
        title="QRZ.com session"
      >
        {connected ? '●' : '○'} {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded border border-neutral-700 bg-neutral-900 p-3 text-xs shadow-lg">
          {connected ? (
            <div className="flex flex-col gap-2">
              <div className="text-neutral-300">
                Signed in as <span className="font-semibold text-emerald-300">{home?.callsign}</span>
              </div>
              {home?.grid && (
                <div className="text-neutral-400">
                  Home grid <span className="font-mono">{home.grid}</span>
                  {home.lat != null && home.lon != null && (
                    <>
                      {' · '}
                      {home.lat.toFixed(2)}, {home.lon.toFixed(2)}
                    </>
                  )}
                </div>
              )}
              <div className={hasXml ? 'text-emerald-400' : 'text-amber-400'}>
                {hasXml ? 'XML subscription active' : 'No XML subscription — lookups disabled'}
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="mt-1 self-end rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-neutral-400">
                QRZ username
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-neutral-100 focus:border-emerald-600 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-neutral-400">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-neutral-100 focus:border-emerald-600 focus:outline-none"
                />
              </label>
              {loginError && <div className="text-rose-400">{loginError}</div>}
              <button
                type="submit"
                disabled={loginInFlight || !username || !password}
                className="mt-1 rounded bg-emerald-700 px-3 py-1 text-neutral-50 hover:bg-emerald-600 disabled:opacity-50"
              >
                {loginInFlight ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="text-[10px] leading-tight text-neutral-500">
                Credentials are sent to the Zeus backend and used to fetch a QRZ session key.
                Username is remembered locally; the password is not stored.
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
