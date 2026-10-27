import { writable } from 'svelte/store';
import { getStatus } from '../api.js';

// Shared device state: one poller for the whole app (the header needs the same
// data as the status view, and doubling the request rate is pointless).
export const device = writable({ status: null, error: null, updated: null });

let timer = null;

export async function refreshDevice() {
  try {
    device.set({ status: await getStatus(), error: null, updated: Date.now() });
  } catch (e) {
    device.update((v) => ({ ...v, error: e?.message ?? String(e) }));
  }
}

export function startDevicePolling(interval = 5000) {
  refreshDevice();
  if (!timer) timer = setInterval(refreshDevice, interval);
  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
