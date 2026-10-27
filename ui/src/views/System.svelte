<script>
  import { onMount } from 'svelte';
  import { getConfig, setConfig, reboot } from '../api.js';
  import { tokenize, join, getOpt, setOpt } from '../lib/args.js';
  import { device } from '../lib/device.js';

  const FIELDS = [
    { key: 'host_name', label: 'Имя хоста', hint: 'как устройство видно в сети', reboot: true },
    { key: 'ap_ssid', label: 'Имя точки доступа', hint: 'сеть, которую создаёт плата без Wi-Fi', reboot: true },
    { key: 'ap_pwd', label: 'Пароль точки доступа', hint: 'минимум 8 символов', reboot: true },
    { key: 'dhcp_tmout', label: 'Таймаут DHCP, с', numeric: true, reboot: false },
    { key: 'telnet_buffer', label: 'Буфер логов, байт', numeric: true, reboot: true },
    { key: 'telnet_block', label: 'Блок передачи, байт', numeric: true, reboot: true },
    { key: 'rel_api', label: 'Список обновлений (API)', reboot: false },
    { key: 'release_url', label: 'Страница релизов', reboot: false },
    { key: 'ui_url', label: 'Адрес интерфейса (ui_url)', reboot: false },
  ];

  const LOG_LEVELS = [
    { value: '', label: 'выключено' },
    { value: 'all=info', label: 'всё, info' },
    { value: 'all=debug', label: 'всё, debug (много)' },
    { value: 'slimproto=debug', label: 'только протокол сервера' },
    { value: 'bt=debug', label: 'только Bluetooth' },
    { value: 'display=debug', label: 'только дисплей' },
    { value: 'output=debug', label: 'только вывод звука' },
    { value: 'wifi=debug', label: 'только Wi-Fi' },
  ];

  let form = {};
  let original = {};
  let autoexec1 = '';
  let logLevel = '';
  let msg = '';
  let error = '';
  let saving = false;

  const norm = (v) => String(v ?? '');
  const changedKeys = () =>
    Object.keys(form).filter((k) => norm(form[k]) !== norm(original[k]));

  async function load() {
    error = '';
    msg = '';
    try {
      const cfg = await getConfig();
      const c = cfg?.config ?? {};
      autoexec1 = c.autoexec1?.value ?? '';
      logLevel = getOpt(tokenize(autoexec1), '-d');

      form = { stats: c.stats?.value ?? 'n', telnet_enable: c.telnet_enable?.value ?? 'n' };
      for (const f of FIELDS) form[f.key] = c[f.key]?.value ?? '';
      original = { ...form };
    } catch (e) {
      error = e?.message ?? String(e);
    }
  }

  async function save() {
    saving = true;
    msg = '';
    error = '';
    try {
      const entries = {};
      for (const key of changedKeys()) entries[key] = form[key];

      const nextLevel = logLevel;
      if (nextLevel !== getOpt(tokenize(autoexec1), '-d')) {
        entries.autoexec1 = join(setOpt(tokenize(autoexec1), '-d', nextLevel));
      }

      if (!Object.keys(entries).length) {
        msg = 'Изменений нет.';
        return;
      }

      await setConfig(entries);
      msg = `Сохранено ключей: ${Object.keys(entries).length}.`;
      await load();
    } catch (e) {
      error = e?.message ?? String(e);
    } finally {
      saving = false;
    }
  }

  const toggle = (key) => {
    form[key] = norm(form[key]).toLowerCase().startsWith('y') ? 'N' : 'Y';
  };
  const isOn = (key) => norm(form[key]).toLowerCase().startsWith('y');

  $: changedCount = changedKeys().length + (logLevel !== getOpt(tokenize(autoexec1), '-d') ? 1 : 0);

  onMount(load);
</script>

<section class="card">
  <h2>Система</h2>
  <p class="muted small">
    Настройки самой платы: имя в сети, точка доступа, логирование, каналы обновлений.
    Значения читаются из устройства при открытии вкладки, сохраняются только изменённые.
  </p>

  {#if error}
    <div class="banner error">{error}</div>
  {/if}
  {#if msg}
    <div class="banner ok">{msg}</div>
  {/if}

  <h3>Устройство</h3>
  <dl class="facts">
    <dt>Плата</dt>
    <dd>{$device.status?.project_name ?? '—'}</dd>
    <dt>Платформа</dt>
    <dd>{$device.status?.platform_name ?? '—'}</dd>
    <dt>Прошивка</dt>
    <dd><code>{$device.status?.version ?? '—'}</code></dd>
    <dt>Режим</dt>
    <dd>{$device.status?.recovery ? 'восстановление' : 'основная прошивка'}</dd>
    {#if $device.status?.uptime !== undefined}
      <dt>Время работы</dt>
      <dd>{Math.floor($device.status.uptime / 3600)} ч {Math.floor(($device.status.uptime % 3600) / 60)} мин</dd>
    {/if}
    {#if $device.status?.heap_internal !== undefined}
      <dt>Память</dt>
      <dd>{Math.round($device.status.heap_internal / 1024)} КБ / PSRAM {Math.round(($device.status.heap_external ?? 0) / 1024)} КБ</dd>
    {/if}
  </dl>

  <h3>Идентификация в сети</h3>
  <div class="form">
    {#each FIELDS.slice(0, 4) as f (f.key)}
      <label>
        {f.label}
        <input
          type={f.key === 'ap_pwd' ? 'password' : f.numeric ? 'number' : 'text'}
          bind:value={form[f.key]}
          placeholder={f.numeric ? 'число' : ''}
        />
        {#if f.hint}<span class="muted small hint">{f.hint}</span>{/if}
      </label>
    {/each}
  </div>

  <h3>Логирование</h3>
  <div class="form">
    <label>
      Уровень логов <span class="muted">(-d)</span>
      <select bind:value={logLevel}>
        {#each LOG_LEVELS as l}
          <option value={l.value}>{l.label}</option>
        {/each}
      </select>
      <span class="muted small hint">пишется в строку запуска; для применения нужна перезагрузка</span>
    </label>

    <label>
      Буфер логов, байт
      <input type="number" bind:value={form.telnet_buffer} />
      <span class="muted small hint">сколько строк держать для telnet</span>
    </label>

    <label>
      Блок передачи, байт
      <input type="number" bind:value={form.telnet_block} />
    </label>
  </div>

  <label class="check">
    <input type="checkbox" checked={isOn('telnet_enable')} onchange={() => toggle('telnet_enable')} />
    Telnet-сервер (одно подключение за раз)
  </label>

  <label class="check">
    <input type="checkbox" checked={isOn('stats')} onchange={() => toggle('stats')} />
    Статистика буферов Bluetooth в лог
  </label>

  <h3>Обновления</h3>
  <div class="form">
    {#each FIELDS.slice(6) as f (f.key)}
      <label>
        {f.label}
        <input bind:value={form[f.key]} />
      </label>
    {/each}
  </div>
  <p class="muted small">
    Список релизов и установка — на вкладке <a href="#firmware">Прошивка</a>.
  </p>

  <h3>Обслуживание</h3>
  <div class="actions">
    <a class="button" href="/config.json" download="squeezelite-config.json">Скачать конфиг</a>
    <a class="button" href="#nvs">Открыть NVS</a>
    <button onclick={() => reboot()}>Перезагрузить</button>
    <button onclick={load}>Обновить</button>
  </div>

  <div class="actions">
    <button class="primary" onclick={save} disabled={saving || !changedCount}>
      {saving ? 'Сохраняю…' : changedCount ? `Сохранить (${changedCount})` : 'Сохранить'}
    </button>
  </div>
</section>
