import { writable } from 'svelte/store';
import { getStatus, getConfig } from '../api.js';
import { tokenize, getOpt } from './args.js';

// Shared device state: one poller for the whole app (the header needs the same
// data as the status view, and doubling the request rate is pointless).
const STATUS_TIMEOUT = 8000;
const OFFLINE_AFTER = 2; // consecutive failures before calling the link dead

export const device = writable({
  status: null,
  error: null,
  updated: null,
  link: 'unknown', // ok | stale | offline
  failures: 0,
  output: '', // bt | I2S | SPDIF, from autoexec1
});

let timer = null;
let inFlight = false;
let failures = 0;
let configLoaded = false;

function humanError(e) {
  const message = String(e?.message ?? e);
  if (e?.name === 'AbortError' || /abort/i.test(message)) {
    return `плата не ответила за ${Math.round(STATUS_TIMEOUT / 1000)} с`;
  }
  if (/HTTP 5\d\d/.test(message)) return 'плата вернула ошибку сервера';
  if (/HTTP 4\d\d/.test(message)) return 'плата отклонила запрос';
  return 'нет ответа от платы';
}

async function loadOutput() {
  if (configLoaded) return;
  try {
    const cfg = await getConfig(STATUS_TIMEOUT);
    const line = cfg?.config?.autoexec1?.value ?? '';
    const output = getOpt(tokenize(line), '-o') || 'bt';
    configLoaded = true;
    device.update((v) => ({ ...v, output }));
  } catch {
    /* not fatal: the dot simply falls back to the neutral colour */
  }
}

export async function refreshDevice() {
  if (inFlight) return;
  inFlight = true;
  try {
    const status = await getStatus(STATUS_TIMEOUT);
    failures = 0;
    device.update((v) => ({ ...v, status, error: null, updated: Date.now(), link: 'ok', failures: 0 }));
  } catch (e) {
    failures += 1;
    device.update((v) => ({
      ...v,
      error: humanError(e),
      failures,
      // a single slow answer must not paint the page red: report it as stale
      link: failures >= OFFLINE_AFTER ? 'offline' : v.status ? 'stale' : 'offline',
    }));
  } finally {
    inFlight = false;
  }
}

export function startDevicePolling(interval = 5000) {
  loadOutput();
  refreshDevice();
  if (!timer) timer = setInterval(refreshDevice, interval);
  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Human readable description for the header indicator.
export function describeLink(state) {
  const { status, link, output, error } = state;
  if (link === 'offline') return { tone: 'offline', text: `Нет связи с платой${error ? `: ${error}` : ''}` };
  if (link === 'stale') return { tone: 'stale', text: 'Плата отвечает медленнее обычного, данные могут быть неактуальными' };

  const out = String(output || '').toLowerCase();
  const bt = status?.bt_status;
  if (out === 'bt') {
    if (bt === 5) return { tone: 'bt', pulsing: false, text: 'Bluetooth: колонка подключена' };
    if (bt === 1 || bt === 2 || bt === 4) return { tone: 'bt', pulsing: true, text: 'Bluetooth: идёт поиск или подключение колонки' };
    if (bt === 3 || bt === 0) return { tone: 'bt-idle', pulsing: false, text: 'Bluetooth: колонка не подключена' };
    return { tone: 'bt', text: 'Bluetooth: состояние неизвестно' };
  }
  if (out === 'i2s') return { tone: 'dac', text: 'Выход: I2S / ЦАП' };
  if (out === 'spdif') return { tone: 'spdif', text: 'Выход: SPDIF' };
  return { tone: 'unknown', text: `Выход: ${output || 'не определён'}` };
}
