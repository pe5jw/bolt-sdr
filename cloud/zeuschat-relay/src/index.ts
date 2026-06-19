import type { Env } from './types';
import { DEFAULT_ROOM } from './protocol';

export { ChatRoom } from './chat-room';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('zeuschat-relay ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    if (url.pathname === '/chat') {
      // Optional shared-secret gate (set RELAY_SHARED_SECRET to enable).
      if (env.RELAY_SHARED_SECRET) {
        const header = request.headers.get('Authorization');
        const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
        const token = bearer ?? url.searchParams.get('token') ?? undefined;
        if (token !== env.RELAY_SHARED_SECRET) {
          return new Response('unauthorized', { status: 401 });
        }
      }

      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket upgrade', { status: 426 });
      }

      // P0: one global room. P3 introduces band-derived rooms keyed by name.
      const id = env.CHAT_ROOM.idFromName(DEFAULT_ROOM);
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
