// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import { ApiError } from './client';

export type ZeusUserRecord = {
  callsign: string;
  displayName: string;
  accessAllowed: boolean;
  isAdmin: boolean;
  subscriptionStatus: string;
  subscriptionExpiresUtc: string | null;
  hasQrzXmlSubscription: boolean;
  grid: string | null;
  notes: string | null;
  createdUtc: string;
  updatedUtc: string;
  lastLoginUtc: string | null;
};

export type ZeusUserSession = {
  qrzConnected: boolean;
  callsign: string | null;
  displayName: string | null;
  accessAllowed: boolean;
  isAdmin: boolean;
  hasQrzXmlSubscription: boolean;
  subscriptionStatus: string;
  subscriptionExpiresUtc: string | null;
  denialReason: string | null;
  user: ZeusUserRecord | null;
};

export type ZeusUsersAdminResponse = {
  session: ZeusUserSession;
  users: ZeusUserRecord[];
};

export type ZeusUserUpdateRequest = {
  accessAllowed?: boolean;
  isAdmin?: boolean;
  subscriptionStatus?: string;
  subscriptionExpiresUtc?: string | null;
  notes?: string | null;
};

export type ZeusUserUpsertRequest = ZeusUserUpdateRequest & {
  callsign: string;
};

function toStr(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function normalizeUser(raw: unknown): ZeusUserRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    callsign: typeof r.callsign === 'string' ? r.callsign : '',
    displayName: typeof r.displayName === 'string' ? r.displayName : '',
    accessAllowed: r.accessAllowed === true,
    isAdmin: r.isAdmin === true,
    subscriptionStatus: typeof r.subscriptionStatus === 'string' ? r.subscriptionStatus : 'manual',
    subscriptionExpiresUtc: toStr(r.subscriptionExpiresUtc),
    hasQrzXmlSubscription: r.hasQrzXmlSubscription === true,
    grid: toStr(r.grid),
    notes: toStr(r.notes),
    createdUtc: typeof r.createdUtc === 'string' ? r.createdUtc : '',
    updatedUtc: typeof r.updatedUtc === 'string' ? r.updatedUtc : '',
    lastLoginUtc: toStr(r.lastLoginUtc),
  };
}

function normalizeSession(raw: unknown): ZeusUserSession {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    qrzConnected: r.qrzConnected === true,
    callsign: toStr(r.callsign),
    displayName: toStr(r.displayName),
    accessAllowed: r.accessAllowed === true,
    isAdmin: r.isAdmin === true,
    hasQrzXmlSubscription: r.hasQrzXmlSubscription === true,
    subscriptionStatus: typeof r.subscriptionStatus === 'string' ? r.subscriptionStatus : 'none',
    subscriptionExpiresUtc: toStr(r.subscriptionExpiresUtc),
    denialReason: toStr(r.denialReason),
    user: r.user ? normalizeUser(r.user) : null,
  };
}

function normalizeAdminResponse(raw: unknown): ZeusUsersAdminResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    session: normalizeSession(r.session),
    users: Array.isArray(r.users) ? r.users.map(normalizeUser) : [],
  };
}

async function jsonFetch<T>(input: RequestInfo, init: RequestInit | undefined, parse: (raw: unknown) => T): Promise<T> {
  const res = await fetch(input, init);
  const rawText = await res.text();
  let raw: unknown = null;
  if (rawText.length > 0) {
    try {
      raw = JSON.parse(rawText) as unknown;
    } catch {
      raw = rawText;
    }
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    if (raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error: unknown }).error === 'string') {
      message = (raw as { error: string }).error;
    }
    throw new ApiError(res.status, message);
  }

  return parse(raw);
}

export function fetchUserSession(signal?: AbortSignal): Promise<ZeusUserSession> {
  return jsonFetch('/api/users/session', { signal }, normalizeSession);
}

export function fetchAdminUsers(signal?: AbortSignal): Promise<ZeusUsersAdminResponse> {
  return jsonFetch('/api/admin/users', { signal }, normalizeAdminResponse);
}

export function createAdminUser(req: ZeusUserUpsertRequest, signal?: AbortSignal): Promise<ZeusUserRecord> {
  return jsonFetch(
    '/api/admin/users',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    },
    normalizeUser,
  );
}

export function updateAdminUser(
  callsign: string,
  req: ZeusUserUpdateRequest,
  signal?: AbortSignal,
): Promise<ZeusUserRecord> {
  return jsonFetch(
    `/api/admin/users/${encodeURIComponent(callsign)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    },
    normalizeUser,
  );
}
