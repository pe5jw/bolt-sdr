import type { ChatRoom } from './chat-room';

/** Worker environment bindings (see wrangler.toml). */
export interface Env {
  /** Durable Object namespace hosting chat rooms. */
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
  /**
   * Optional shared secret gating connections to the relay. When set (via
   * `wrangler secret put RELAY_SHARED_SECRET`), backends must present it as a
   * Bearer token or `?token=` query param on the WS upgrade. Unset = open
   * (local dev only).
   */
  RELAY_SHARED_SECRET?: string;
}
