// SPDX-License-Identifier: GPL-2.0-or-later
//
// Zeus — OpenHPSDR Protocol-1 / Protocol-2 client.
// Copyright (C) 2025-2026 Brian Keating (EI6LF),
//                         Douglas J. Cerrato (KB2UKA),
//                         Christian Suarez (N9WAR), and contributors.

import { create } from 'zustand';
import { ApiError } from '../api/client';
import {
  createAdminUser,
  fetchAdminUsers,
  fetchUserSession,
  updateAdminUser,
  type ZeusUserRecord,
  type ZeusUserSession,
  type ZeusUserUpdateRequest,
  type ZeusUserUpsertRequest,
} from '../api/users';
import { useQrzStore } from './qrz-store';

type UserAccessState = {
  checked: boolean;
  loading: boolean;
  adminLoading: boolean;
  saving: boolean;
  error: string | null;
  adminError: string | null;
  session: ZeusUserSession | null;
  users: ZeusUserRecord[];

  refreshSession: () => Promise<ZeusUserSession | null>;
  loginWithQrz: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadAdminUsers: () => Promise<void>;
  createUser: (request: ZeusUserUpsertRequest) => Promise<ZeusUserRecord | null>;
  updateUser: (callsign: string, request: ZeusUserUpdateRequest) => Promise<ZeusUserRecord | null>;
};

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

function replaceUser(users: ZeusUserRecord[], next: ZeusUserRecord): ZeusUserRecord[] {
  const found = users.some((u) => u.callsign === next.callsign);
  const merged = found ? users.map((u) => (u.callsign === next.callsign ? next : u)) : [next, ...users];
  return [...merged].sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.callsign.localeCompare(b.callsign);
  });
}

export const useUserAccessStore = create<UserAccessState>((set, get) => ({
  checked: false,
  loading: false,
  adminLoading: false,
  saving: false,
  error: null,
  adminError: null,
  session: null,
  users: [],

  refreshSession: async () => {
    set({ loading: true, error: null });
    try {
      const session = await fetchUserSession();
      set({ checked: true, loading: false, session });
      return session;
    } catch (err) {
      set({ checked: true, loading: false, error: errorMessage(err) });
      return null;
    }
  },

  loginWithQrz: async (username, password) => {
    const qrzOk = await useQrzStore.getState().login(username, password);
    const session = await get().refreshSession();
    return Boolean(qrzOk && session?.accessAllowed);
  },

  logout: async () => {
    await useQrzStore.getState().logout();
    set({
      checked: true,
      session: null,
      users: [],
      error: null,
      adminError: null,
    });
    await get().refreshSession();
  },

  loadAdminUsers: async () => {
    set({ adminLoading: true, adminError: null });
    try {
      const response = await fetchAdminUsers();
      set({
        adminLoading: false,
        session: response.session,
        users: response.users,
      });
    } catch (err) {
      set({ adminLoading: false, adminError: errorMessage(err) });
    }
  },

  createUser: async (request) => {
    set({ saving: true, adminError: null });
    try {
      const user = await createAdminUser(request);
      set((state) => ({ saving: false, users: replaceUser(state.users, user) }));
      return user;
    } catch (err) {
      set({ saving: false, adminError: errorMessage(err) });
      return null;
    }
  },

  updateUser: async (callsign, request) => {
    set({ saving: true, adminError: null });
    try {
      const user = await updateAdminUser(callsign, request);
      set((state) => ({ saving: false, users: replaceUser(state.users, user) }));
      await get().refreshSession();
      return user;
    } catch (err) {
      set({ saving: false, adminError: errorMessage(err) });
      return null;
    }
  },
}));
