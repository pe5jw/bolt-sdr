// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from './meters/__tests__/harness';
import { useVstEditor } from './useVstEditor';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useVstEditor', () => {
  it('uses the TX editor route by default', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ open: false }));
    vi.stubGlobal('fetch', fetchMock);

    const hook = renderHook(() => useVstEditor('com.openhpsdr.zeus.vst.clear'));
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/audio-suite/plugins/com.openhpsdr.zeus.vst.clear/editor',
    );

    await act(async () => {
      hook.result.current.openEditor();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/audio-suite/plugins/com.openhpsdr.zeus.vst.clear/editor',
      { method: 'POST' },
    );

    hook.unmount();
    vi.unstubAllGlobals();
  });

  it('uses the RX editor route for receive-side VST instances', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ open: false }));
    vi.stubGlobal('fetch', fetchMock);

    const hook = renderHook(() =>
      useVstEditor('com.openhpsdr.zeus.rxvst.clear', true, 'rx'),
    );
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rx-audio-suite/plugins/com.openhpsdr.zeus.rxvst.clear/editor',
    );

    await act(async () => {
      hook.result.current.openEditor();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/rx-audio-suite/plugins/com.openhpsdr.zeus.rxvst.clear/editor',
      { method: 'POST' },
    );

    hook.unmount();
    vi.unstubAllGlobals();
  });
});
