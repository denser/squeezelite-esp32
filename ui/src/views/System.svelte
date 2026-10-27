<script>
  import { onMount } from 'svelte';
  import { getConfig, setConfig, reboot } from '../api.js';
  import { tokenize, join, getOpt, setOpt } from '../lib/args.js';
  import { generateToken, linkWithToken, getToken } from '../lib/auth.js';

  const FIELDS = [
    { key: 'host_name', label: 'Имя хоста', hint: 'как устройство видно в сети' },
    { key: 'ap_ssid', label: 'Имя точки доступа', hint: 'сеть, которую плата создаёт без Wi-Fi' },
    { key: 'ap_pwd', label: 'Пароль точки доступа', type: 'password' },
    { key: 'dhcp_tmout', label: 'Таймаут DHCP, с', numeric: true },
    { key: 'telnet_buffer', label: 'Буфер логов, байт', numeric: true },
    { key: 'telnet_block', label: 'Блок передачи, байт', numeric: true },
    { key: 'rel_api', label: 'Список обновлений (API)' },
    { key: 'release_url', label: 'Страница релизов' },
    { key: 'ui_url', label: 'Адрес интерфейса (ui_url)' },
  ];

  const LOG_TARGETS = ['all', 'slimproto', 'stream', 'decode', 'output', 'ir', 'display', 'bt', 'wifi', 'config', 'http'];
  const LOG_LEVELS = ['info', 'debug', 'sdebug'];

  let form = {};
  let original = {};
  let autoexec1 = '';
  let logTarget = '';
  let logLevel = '';
  let showPwd = false;
  let msg = '';
  let error = '';
  let saving = false;

  const norm = (v) => String(v ?? '');
  const changedKeys = () => Object.keys(form).filter((k) => norm(form[k]) !== norm(original[k]));

  $: logValue = logTarget ? `${logTarget}=${logLevel || 'info'}` : '';
  $: changedCount = changedKeys().length + (logValue !== (getOpt(tokenize(autoexec1), '-d') || '') ? 1 : 0);

  async function load() {
    error = '';
    msg = '';
    try {
      const cfg = await getConfig();
      const c = cfg?.config ?? {};
      autoexec1 = c.autoexec1?.value ?? '';

      const level = getOpt(tokenize(autoexec1), '-d') || '';
      const [target = '', lvl = ''] = level.split('=');
      logTarget = target;
      logLevel = lvl || (target ? 'info' : '');

      form = {
        stats: c.stats?.value ?? 'n',
        telnet_enable: c.telnet_enable?.value ?? 'n',
        web_auth: c.web_auth?.value ?? '',
        web_token: c.web_token?.value ?? '',
        web_allow_ip: c.web_allow_ip?.value ?? '',
      };
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

      if (logValue !== (getOpt(tokenize(autoexec1), '-d') || '')) {
        entries.autoexec1 = join(setOpt(tokenize(autoexec1), '-d', logValue));
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

  onMount(load);
</script>

<section class="card">
  <h2>Система</h2>
  <p class="muted small">
    Настройки самой платы: имя в сети, точка доступа, логирование, доступ, каналы обновлений.
  </p>

  {#if error}
    <div class="banner error">{error}</div>
  {/if}
  {#if msg}
    <div class="banner ok">{msg}</div>
  {/if}

  <h3>Идентификация в сети</h3>
  <div class="form">
    {#each FIELDS.slice(0, 4) as f (f.key)}
      <label>
        {f.label}
        {#if f.key === 'ap_pwd'}
          <span class="with-eye">
            <input type={showPwd ? 'text' : 'password'} bind:value={form[f.key]} />
            <button class="eye" type="button" onclick={() => (showPwd = !showPwd)} title={showPwd ? 'скрыть' : 'показать'}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="1.7" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7" />
                {#if !showPwd}<line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" stroke-width="1.7" />{/if}
              </svg>
            </button>
          </span>
        {:else}
          <input type={f.numeric ? 'number' : 'text'} bind:value={form[f.key]} />
        {/if}
        {#if f.hint}<span class="muted small hint">{f.hint}</span>{/if}
      </label>
    {/each}
  </div>

  <h3>Логирование</h3>
  <div class="form">
    <label>
      Категория <span class="muted">(-d до «=»)</span>
      <select bind:value={logTarget}>
        <option value="">— выключено —</option>
        {#each LOG_TARGETS as t}<option value={t}>{t}</option>{/each}
      </select>
    </label>

    <label>
      Уровень <span class="muted">(после «=»)</span>
      <select bind:value={logLevel} disabled={!logTarget}>
        {#each LOG_LEVELS as l}<option value={l}>{l}</option>{/each}
      </select>
    </label>

    <label>
      Буфер логов, байт
      <input type="number" bind:value={form.telnet_buffer} />
    </label>

    <label>
      Блок передачи, байт
      <input type="number" bind:value={form.telnet_block} />
    </label>
  </div>

  <p class="muted small">
    Итог: <code>{logValue || 'логи выключены'}</code> — пишется в строку запуска, применяется после перезагрузки.
  </p>

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
  <p class="muted small">Список релизов и установка — на вкладке <a href="#firmware">Прошивка</a>.</p>

  <h3>Доступ</h3>
  <div class="form">
    <label>
      Ключ доступа <span class="muted">(web_token)</span>
      <span class="with-actions">
        <input bind:value={form.web_token} placeholder="пусто = без защиты" />
        <button class="icon-btn" type="button" title="сгенерировать новый ключ" onclick={() => (form.web_token = generateToken())}>⟳</button>
        <button class="icon-btn" type="button" title="скопировать ссылку с ключом" onclick={() => navigator.clipboard?.writeText(linkWithToken(form.web_token))}>⧉</button>
      </span>
    </label>
    <label>
      Режим <span class="muted">(web_auth)</span>
      <select bind:value={form.web_auth}>
        <option value="">выключено</option>
        <option value="write">только изменения (POST)</option>
        <option value="all">всё, включая чтение</option>
      </select>
    </label>
    <label>
      Без ключа пускать с IP <span class="muted">(web_allow_ip)</span>
      <input bind:value={form.web_allow_ip} placeholder="192.168.1.*, 10.0.0.5" />
      <span class="muted small hint">через запятую; звёздочка в конце — любой адрес подсети</span>
    </label>
  </div>
  {#if getToken()}
    <p class="muted small">Ключ в этом браузере: <code>{getToken().slice(0, 6)}…</code></p>
  {/if}
  <p class="muted small">
    Ключ защищает только веб-интерфейс; консоль (UART/telnet) остаётся доступной — это аварийный вход.
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
