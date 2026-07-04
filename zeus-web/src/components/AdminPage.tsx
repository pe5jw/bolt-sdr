// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Ban,
  CheckCircle2,
  KeyRound,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useUserAccessStore } from '../state/user-access-store';
import { QrzAccessGate } from './QrzAccessGate';
import type { ZeusUserRecord } from '../api/users';

const SUBSCRIPTION_OPTIONS = [
  'manual',
  'qrz-xml',
  'trial',
  'active',
  'past_due',
  'expired',
  'comped',
  'suspended',
] as const;

function fmtDate(value: string | null | undefined): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function dateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  return value ? new Date(`${value}T23:59:59.000Z`).toISOString() : null;
}

function StatusPill({ user }: { user: ZeusUserRecord }) {
  if (!user.accessAllowed) {
    return (
      <span className="admin-pill admin-pill--blocked">
        <Ban size={12} aria-hidden /> blocked
      </span>
    );
  }
  return (
    <span className="admin-pill admin-pill--allowed">
      <CheckCircle2 size={12} aria-hidden /> allowed
    </span>
  );
}

export function AdminPage() {
  const session = useUserAccessStore((s) => s.session);
  const users = useUserAccessStore((s) => s.users);
  const checked = useUserAccessStore((s) => s.checked);
  const adminLoading = useUserAccessStore((s) => s.adminLoading);
  const saving = useUserAccessStore((s) => s.saving);
  const adminError = useUserAccessStore((s) => s.adminError);
  const refreshSession = useUserAccessStore((s) => s.refreshSession);
  const loadAdminUsers = useUserAccessStore((s) => s.loadAdminUsers);
  const createUser = useUserAccessStore((s) => s.createUser);
  const updateUser = useUserAccessStore((s) => s.updateUser);
  const logout = useUserAccessStore((s) => s.logout);

  const [selectedCall, setSelectedCall] = useState<string>('');
  const [newCall, setNewCall] = useState('');
  const selected = useMemo(
    () => users.find((u) => u.callsign === selectedCall) ?? users[0] ?? null,
    [selectedCall, users],
  );
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('manual');
  const [subscriptionExpires, setSubscriptionExpires] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (session?.accessAllowed && session.isAdmin) void loadAdminUsers();
  }, [loadAdminUsers, session?.accessAllowed, session?.isAdmin]);

  useEffect(() => {
    const first = users[0];
    if (!selected && first) setSelectedCall(first.callsign);
  }, [selected, users]);

  useEffect(() => {
    if (!selected) return;
    setAccessAllowed(selected.accessAllowed);
    setIsAdmin(selected.isAdmin);
    setSubscriptionStatus(selected.subscriptionStatus || 'manual');
    setSubscriptionExpires(dateInput(selected.subscriptionExpiresUtc));
    setNotes(selected.notes ?? '');
  }, [selected]);

  if (!checked || !session?.qrzConnected || !session.accessAllowed) {
    return <QrzAccessGate adminMode />;
  }

  if (!session.isAdmin) {
    return (
      <div className="admin-shell">
        <section className="admin-denied">
          <KeyRound size={24} aria-hidden />
          <h1>Admin Access Required</h1>
          <p>{session.callsign} is signed in through QRZ but is not a Zeus admin.</p>
          <button type="button" className="btn sm" onClick={() => void logout()}>
            <LogOut size={14} aria-hidden /> SIGN OUT
          </button>
        </section>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const callsign = newCall.trim().toUpperCase();
    if (!callsign) return;
    const user = await createUser({
      callsign,
      accessAllowed: true,
      isAdmin: false,
      subscriptionStatus: 'manual',
    });
    if (user) {
      setNewCall('');
      setSelectedCall(user.callsign);
    }
  }

  async function onSave() {
    if (!selected) return;
    await updateUser(selected.callsign, {
      accessAllowed,
      isAdmin,
      subscriptionStatus,
      subscriptionExpiresUtc: fromDateInput(subscriptionExpires),
      notes,
    });
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <ShieldCheck size={24} strokeWidth={2.2} aria-hidden />
          <div>
            <h1>Zeus User Management</h1>
            <p>Signed in as {session.callsign}</p>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <a className="btn sm" href="/">
            OPEN APP
          </a>
          <button type="button" className="btn sm" onClick={() => void loadAdminUsers()} disabled={adminLoading}>
            <RefreshCw size={14} aria-hidden />
            {adminLoading ? 'REFRESHING' : 'REFRESH'}
          </button>
          <button type="button" className="btn sm" onClick={() => void logout()}>
            <LogOut size={14} aria-hidden />
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-summary">
          <div>
            <span>Total users</span>
            <strong>{users.length}</strong>
          </div>
          <div>
            <span>Allowed</span>
            <strong>{users.filter((u) => u.accessAllowed).length}</strong>
          </div>
          <div>
            <span>Admins</span>
            <strong>{users.filter((u) => u.isAdmin).length}</strong>
          </div>
          <div>
            <span>QRZ XML seen</span>
            <strong>{users.filter((u) => u.hasQrzXmlSubscription).length}</strong>
          </div>
        </section>

        {adminError && <div className="admin-error">{adminError}</div>}

        <section className="admin-grid">
          <div className="admin-users-panel">
            <div className="admin-panel-head">
              <Users size={16} aria-hidden />
              <h2>Users</h2>
            </div>
            <form className="admin-add-user" onSubmit={onCreate}>
              <input
                value={newCall}
                onChange={(e) => setNewCall(e.target.value.toUpperCase())}
                placeholder="CALLSIGN"
                spellCheck={false}
              />
              <button type="submit" className="btn sm active" disabled={!newCall.trim() || saving}>
                <UserPlus size={14} aria-hidden /> ADD
              </button>
            </form>
            <div className="admin-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Callsign</th>
                    <th>Access</th>
                    <th>Role</th>
                    <th>Subscription</th>
                    <th>Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.callsign}
                      className={user.callsign === selected?.callsign ? 'is-selected' : ''}
                      onClick={() => setSelectedCall(user.callsign)}
                    >
                      <td>
                        <button type="button" className="admin-call-btn">
                          <strong>{user.callsign}</strong>
                          <span>{user.displayName || user.callsign}</span>
                        </button>
                      </td>
                      <td><StatusPill user={user} /></td>
                      <td>{user.isAdmin ? 'admin' : 'operator'}</td>
                      <td>{user.subscriptionStatus}</td>
                      <td>{fmtDate(user.lastLoginUtc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-detail-panel">
            <div className="admin-panel-head">
              <ShieldCheck size={16} aria-hidden />
              <h2>{selected ? selected.callsign : 'Select User'}</h2>
            </div>
            {selected ? (
              <>
                <div className="admin-detail-ledger">
                  <div><span>Display name</span><strong>{selected.displayName || selected.callsign}</strong></div>
                  <div><span>Grid</span><strong>{selected.grid ?? 'none'}</strong></div>
                  <div><span>QRZ XML</span><strong>{selected.hasQrzXmlSubscription ? 'active' : 'basic'}</strong></div>
                  <div><span>Created</span><strong>{fmtDate(selected.createdUtc)}</strong></div>
                  <div><span>Updated</span><strong>{fmtDate(selected.updatedUtc)}</strong></div>
                  <div><span>Expires</span><strong>{fmtDate(selected.subscriptionExpiresUtc)}</strong></div>
                </div>

                <label className="admin-toggle-row">
                  <input
                    type="checkbox"
                    checked={accessAllowed}
                    onChange={(e) => setAccessAllowed(e.target.checked)}
                  />
                  <span>
                    <strong>Allow app access</strong>
                    <small>{accessAllowed ? 'User can enter Zeus after QRZ login' : 'User is stopped at login'}</small>
                  </span>
                </label>

                <label className="admin-toggle-row">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                  />
                  <span>
                    <strong>Admin privileges</strong>
                    <small>Can open /admin and manage users</small>
                  </span>
                </label>

                <div className="admin-field-grid">
                  <label>
                    <span>Subscription status</span>
                    <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)}>
                      {SUBSCRIPTION_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Subscription expires</span>
                    <input
                      type="date"
                      value={subscriptionExpires}
                      onChange={(e) => setSubscriptionExpires(e.target.value)}
                    />
                  </label>
                </div>

                <label className="admin-notes">
                  <span>Admin notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
                </label>

                <button type="button" className="btn sm active admin-save" onClick={() => void onSave()} disabled={saving}>
                  <Save size={14} aria-hidden />
                  {saving ? 'SAVING' : 'SAVE USER'}
                </button>
              </>
            ) : (
              <div className="admin-empty">No user records yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
