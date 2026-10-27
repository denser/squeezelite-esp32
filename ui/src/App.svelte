<script>
  import { onMount } from 'svelte';
  import Status from './views/Status.svelte';
  import Player from './views/Player.svelte';
  import Nvs from './views/Nvs.svelte';
  import Audio from './views/Audio.svelte';
  import System from './views/System.svelte';
  import Firmware from './views/Firmware.svelte';
  import Placeholder from './views/Placeholder.svelte';
  import { device, startDevicePolling, describeLink } from './lib/device.js';
  import { reboot } from './api.js';
  import { authRequired, setToken } from './lib/auth.js';
  import { theme, setTheme, initTheme } from './lib/theme.js';

  const tabs = [
    { id: 'status', label: 'Статус' },
    { id: 'player', label: 'Плеер' },
    { id: 'audio', label: 'Звук' },
    { id: 'screen', label: 'Экран' },
    { id: 'system', label: 'Система' },
    { id: 'firmware', label: 'Прошивка' },
    { id: 'nvs', label: 'NVS' },
  ];

  const fromHash = () => {
    const id = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
    return tabs.some((t) => t.id === id) ? id : 'status';
  };

  let tab = fromHash();
  let rebooting = false;
  let keyInput = '';
  let confirmReboot = false;
  let confirmTimer = null;

  function armReboot() {
    if (confirmReboot) {
      clearTimeout(confirmTimer);
      confirmReboot = false;
      doReboot();
      return;
    }
    confirmReboot = true;
    confirmTimer = setTimeout(() => (confirmReboot = false), 4000);
  }

  function unlock() {
    setToken(keyInput.trim());
    authRequired.set(false);
    if (typeof location !== 'undefined') location.reload();
  }

  function select(id) {
    tab = id;
    if (typeof history !== 'undefined') history.replaceState(null, '', `#${id}`);
  }

  async function doReboot() {
    rebooting = true;
    try {
      await reboot();
    } catch {
      /* the device drops the connection while rebooting */
    } finally {
      setTimeout(() => (rebooting = false), 5000);
    }
  }

  onMount(() => {
    initTheme();
    const stop = startDevicePolling(5000);
    const onHash = () => (tab = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      stop();
      window.removeEventListener('hashchange', onHash);
    };
  });

  $: recovery = $device.status?.recovery === 1;
  $: dot = describeLink($device);
</script>

<header class="topbar">
  <div class="brand">
    <span class="dot {dot.tone}" class:pulse={dot.pulsing} title={dot.text}></span>
    <strong>Squeezelite-ESP32</strong>
    <span class="muted" id="host">{typeof location !== 'undefined' ? location.host : ''}</span>
  </div>
  <nav>
    {#each tabs as t}
      <button class:active={tab === t.id} onclick={() => select(t.id)}>{t.label}</button>
    {/each}
  </nav>
  <div class="sysbar">
    {#if recovery}
      <span class="badge warn">восстановление</span>
    {/if}
    <div class="theme-switch" role="group" aria-label="тема">
      <button class:active={$theme === 'light'} title="светлая" onclick={() => setTheme('light')}>☀</button>
      <button class:active={$theme === 'dark'} title="тёмная" onclick={() => setTheme('dark')}>☾</button>
      <button class:active={$theme === 'system'} title="как в системе" onclick={() => setTheme('system')}>◐</button>
    </div>
    <button class:primary={recovery || confirmReboot} onclick={armReboot} disabled={rebooting}>
      {rebooting ? 'Перезагружаю…' : confirmReboot ? 'Точно перезагрузить?' : recovery ? 'Выйти из восстановления' : 'Перезагрузить'}
    </button>
  </div>
</header>


{#if $authRequired}
  <div class="modal">
    <div class="modal-card">
      <h2>Нужен ключ доступа</h2>
      <p class="muted small">
        Устройство защищено ключом. Вставьте его, чтобы продолжить. Ключ хранится в этом
        браузере и передаётся только плате.
      </p>
      <input bind:value={keyInput} placeholder="ключ доступа" onkeydown={(e) => e.key === 'Enter' && unlock()} />
      <div class="actions">
        <button class="primary" onclick={unlock} disabled={!keyInput.trim()}>Войти</button>
      </div>
    </div>
  </div>
{/if}
<main>
  {#if tab === 'status'}
    <Status />
  {:else if tab === 'player'}
    <Player />
  {:else if tab === 'audio'}
    <Audio />
  {:else if tab === 'system'}
    <System />
  {:else if tab === 'firmware'}
    <Firmware />
  {:else if tab === 'nvs'}
    <Nvs />
  {:else}
    <Placeholder name={tabs.find((t) => t.id === tab)?.label ?? ''} />
  {/if}
</main>

<footer>
  <span class="muted">Squeezelite-ESP32 web UI · ранняя версия · <a href="/">встроенный интерфейс</a></span>
</footer>
