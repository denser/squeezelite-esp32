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
    <button class:primary={recovery} onclick={doReboot} disabled={rebooting}>
      {rebooting ? 'Перезагружаю…' : recovery ? 'Выйти из восстановления' : 'Перезагрузить'}
    </button>
  </div>
</header>

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
