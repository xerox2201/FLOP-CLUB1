<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { auth } from '../stores/auth';
  import { cardTheme, CARD_THEMES } from '../stores/cardTheme';
  import { preferences } from '../lib/preferences';
  import { initMusic } from '../lib/music';
  import { lang, setLang, LANGUAGES, t, type Lang, type MessageKey } from '../i18n';

  export let onBack: () => void = () => {};

  $: prefs = $preferences;

  function toggle<K extends keyof typeof prefs>(key: K) {
    preferences.setKey(key, !prefs[key] as any);
  }

  function setGraphics(g: 'ultra' | 'high' | 'medium' | 'performance') {
    preferences.setKey('graphics', g);
  }

  function openTelegramSecurity() {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink('https://t.me/settings');
    } else {
      window.open('https://t.me/settings', '_blank');
    }
  }

  function openWallet() {
    window.location.hash = '#wallet';
    onBack();
  }
  function changeLang(code: Lang) {
    setLang(code);
  }
  onMount(() => {
    initMusic();
  });

  // ── Summary tiles ──
  const AUDIO_KEYS = ['sound', 'music'] as const;
  const GRAPHICS_LEVELS = ['ultra', 'high', 'medium', 'performance'] as const;
  const GRAPHICS_KEYS: Record<(typeof GRAPHICS_LEVELS)[number], MessageKey> = {
    ultra: 'settings.graphicsUltra',
    high: 'settings.graphicsHigh',
    medium: 'settings.graphicsMedium',
    performance: 'settings.graphicsPerformance',
  };

  $: activeLang = LANGUAGES.find((l) => l.code === $lang) ?? LANGUAGES[0];
  $: activeTheme = CARD_THEMES.find((theme) => theme.id === $cardTheme) ?? CARD_THEMES[0];
  $: audioOn = AUDIO_KEYS.filter((k) => prefs[k]).length;
  $: summary = [
    {
      key: 'lang',
      icon: 'chat',
      color: '#22d3ee',
      label: 'settings.language' as MessageKey,
      value: activeLang.nativeLabel,
    },
    {
      key: 'theme',
      icon: 'gem',
      color: '#3b82f6',
      label: 'settings.cardTheme' as MessageKey,
      value: activeTheme.name,
    },
    {
      key: 'audio',
      icon: 'bell',
      color: '#f4c95d',
      label: 'settings.audio' as MessageKey,
      value: $t('settings.audioOn', { on: audioOn, total: AUDIO_KEYS.length }),
    },
    {
      key: 'graphics',
      icon: 'zap',
      color: '#10b981',
      label: 'settings.graphics' as MessageKey,
      value: $t(GRAPHICS_KEYS[prefs.graphics]),
    },
  ];
</script>

<div class="px-4 pb-28">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="flex items-center gap-3 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label={$t('common.back')}
      class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition"
      style="
        background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7));
        border: 1.5px solid rgba(96,165,250,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      "
    >
      <Icon name="arrow-left" size={18} color="#ffffff" mirror={true} />
    </button>

    <div
      class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
      style="
        background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
        border: 1.5px solid rgba(244,201,93,0.55);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
      "
    >
      <Icon name="settings" size={24} color="#f4c95d" />
    </div>

    <div class="flex-1 min-w-0">
      <h1
        class="text-[26px] font-extrabold leading-none tracking-[-0.02em]"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
        "
      >
        {$t('settings.title')}
      </h1>
      <p class="text-mini text-white/45 mt-1.5 font-bold">{$t('settings.subtitle')}</p>
    </div>
  </div>

  <!-- ============ SUMMARY GRID ============ -->
  <div class="grid grid-cols-2 gap-2 mb-4">
    {#each summary as s (s.key)}
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, {s.color}15 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid {s.color}35;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style="background: {s.color}22; border: 1px solid {s.color}55;"
          >
            <Icon name={s.icon} size={12} color={s.color} />
          </div>
          <span
            class="text-micro font-extrabold uppercase tracking-wider truncate"
            style="color: {s.color};"
          >
            {$t(s.label)}
          </span>
        </div>
        <p class="text-[13px] font-extrabold text-white truncate leading-tight">{s.value}</p>
      </div>
    {/each}
  </div>

  <!-- ============ LANGUAGE ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">{$t('settings.language')}</h2>
  <div
    class="rounded-2xl p-1.5 mb-4"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15); box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);"
  >
    {#each LANGUAGES as L}
      <button
        on:click={() => changeLang(L.code)}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:scale-[0.98] transition-all text-start"
        style="
          background: {$lang === L.code
          ? 'linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.08))'
          : 'transparent'};
          border: 1.5px solid {$lang === L.code ? 'rgba(212,175,55,0.5)' : 'transparent'};
        "
      >
        <!-- Radio circle -->
        <div
          class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
          style="
            border-color: {$lang === L.code ? '#d4af37' : 'rgba(255,255,255,0.25)'};
            background: {$lang === L.code ? 'rgba(212,175,55,0.15)' : 'transparent'};
          "
        >
          {#if $lang === L.code}
            <div class="w-2.5 h-2.5 rounded-full" style="background: #d4af37;"></div>
          {/if}
        </div>

        <!-- Native name over the English name -->
        <span class="flex-1 min-w-0 flex flex-col text-start leading-tight">
          <span
            class="text-[13px] font-extrabold truncate"
            style="color: {$lang === L.code ? '#f4e5a8' : 'rgba(255,255,255,0.9)'};"
          >
            {L.nativeLabel}
          </span>
          {#if L.label !== L.nativeLabel}
            <span
              class="text-micro font-bold truncate"
              style="color: {$lang === L.code
                ? 'rgba(244,229,168,0.6)'
                : 'rgba(255,255,255,0.45)'};"
            >
              {L.label}
            </span>
          {/if}
        </span>

        <!-- RTL badge -->
        {#if L.rtl}
          <span
            class="text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style="background: rgba(34,211,238,0.15); color: #67e8f9; border: 1px solid rgba(34,211,238,0.4);"
          >
            RTL
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- ============ CARD THEME ============ -->
  <h2 class="t-label text-gold/60 mb-2 px-1">{$t('settings.cardTheme')}</h2>
  <div
    class="rounded-2xl p-1.5 mb-4"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15); box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);"
  >
    {#each CARD_THEMES as theme}
      <button
        on:click={() => cardTheme.set(theme.id)}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:scale-[0.98] transition-all text-start"
        style="background: {$cardTheme === theme.id
          ? 'linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.08))'
          : 'transparent'}; border: 1.5px solid {$cardTheme === theme.id
          ? 'rgba(212,175,55,0.5)'
          : 'transparent'};"
      >
        <div
          class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
          style="border-color: {$cardTheme === theme.id
            ? '#d4af37'
            : 'rgba(255,255,255,0.25)'}; background: {$cardTheme === theme.id
            ? 'rgba(212,175,55,0.15)'
            : 'transparent'};"
        >
          {#if $cardTheme === theme.id}
            <div class="w-2.5 h-2.5 rounded-full" style="background: #d4af37;"></div>
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-[13px] font-extrabold leading-tight"
            style="color: {$cardTheme === theme.id ? '#f4e5a8' : 'rgba(255,255,255,0.9)'};"
          >
            {theme.name}
          </p>
          <p class="text-mini text-white/40 leading-tight mt-0.5 truncate">{theme.desc}</p>
        </div>
        <div class="flex gap-1 shrink-0">
          {#each theme.previewColors as c}
            <div
              class="w-3 h-3 rounded-full"
              style="background: {c}; box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.3);"
            ></div>
          {/each}
        </div>
      </button>
    {/each}
  </div>

  <!-- ============ AUDIO ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">{$t('settings.audio')}</h2>
  <div
    class="rounded-2xl overflow-hidden mb-4"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(244,201,93,0.12); border: 1px solid rgba(244,201,93,0.3);"
        >
          <Icon name="bell" size={16} color="#f4c95d" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.sound')}</p>
          <p class="text-mini text-white/50">{$t('settings.soundSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.sound}
        on:change={() => toggle('sound')}
        class="toggle"
      />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.3);"
        >
          <Icon name="play" size={16} color="#22d3ee" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.music')}</p>
          <p class="text-mini text-white/50">{$t('settings.musicSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.music}
        on:change={() => toggle('music')}
        class="toggle"
      />
    </label>
  </div>

  <!-- ============ EXPERIENCE ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">{$t('settings.experience')}</h2>
  <div
    class="rounded-2xl overflow-hidden mb-4"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="zap" size={16} color="#93c5fd" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.haptics')}</p>
          <p class="text-mini text-white/50">{$t('settings.hapticsSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.haptics}
        on:change={() => toggle('haptics')}
        class="toggle"
      />
    </label>
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3);"
        >
          <Icon name="sparkles" size={16} color="#6ee7b7" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.animations')}</p>
          <p class="text-mini text-white/50">{$t('settings.animationsSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.animations}
        on:change={() => toggle('animations')}
        class="toggle"
      />
    </label>
    <div class="px-4 py-3">
      <div class="flex items-center gap-3 mb-2.5">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.3);"
        >
          <Icon name="chart" size={16} color="#60a5fa" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.graphicsQuality')}</p>
          <p class="text-mini text-white/50">{$t('settings.graphicsQualitySub')}</p>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        {#each GRAPHICS_LEVELS as g}
          <button
            on:click={() => setGraphics(g)}
            class="py-2 rounded-xl text-micro font-extrabold uppercase tracking-wider transition active:scale-[0.96]"
            style="background: {prefs.graphics === g
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(255,255,255,0.05)'}; color: {prefs.graphics === g
              ? '#0a0800'
              : 'rgba(255,255,255,0.6)'}; border: 1px solid {prefs.graphics === g
              ? 'rgba(255,235,170,0.5)'
              : 'rgba(255,255,255,0.08)'}; {prefs.graphics === g
              ? 'box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.35);'
              : ''}"
          >
            {$t(GRAPHICS_KEYS[g])}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ============ TABLE PREFERENCES ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">{$t('settings.tablePreferences')}</h2>
  <div
    class="rounded-2xl overflow-hidden mb-4"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(244,201,93,0.12); border: 1px solid rgba(244,201,93,0.3);"
        >
          <Icon name="chart" size={16} color="#f4c95d" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.betSlider')}</p>
          <p class="text-mini text-white/50">{$t('settings.betSliderSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.betSlider}
        on:change={() => toggle('betSlider')}
        class="toggle"
      />
    </label>
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(148,163,184,0.12); border: 1px solid rgba(148,163,184,0.3);"
        >
          <Icon name="unlock" size={16} color="#cbd5e1" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.autoMuck')}</p>
          <p class="text-mini text-white/50">{$t('settings.autoMuckSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.autoMuck}
        on:change={() => toggle('autoMuck')}
        class="toggle"
      />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-white/5">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="gem" size={16} color="#60a5fa" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">{$t('settings.fourColor')}</p>
          <p class="text-mini text-white/50">{$t('settings.fourColorSub')}</p>
        </div>
      </div>
      <input
        type="checkbox"
        checked={prefs.fourColor}
        on:change={() => toggle('fourColor')}
        class="toggle"
      />
    </label>
  </div>

  <!-- ============ ACCOUNT ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">{$t('settings.account')}</h2>
  <div
    class="rounded-2xl overflow-hidden"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    <button
      on:click={openTelegramSecurity}
      class="w-full flex items-center gap-3 px-4 py-3 text-start active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style="background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.3);"
      >
        <Icon name="lock" size={16} color="#60a5fa" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-white">{$t('settings.security')}</p>
        <p class="text-mini text-white/50">{$t('settings.securitySub')}</p>
      </div>
      <Icon name="arrow-right" size={14} color="rgba(212,175,55,0.6)" mirror={true} />
    </button>
    <button
      on:click={openWallet}
      class="w-full flex items-center gap-3 px-4 py-3 text-start active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.3);"
      >
        <Icon name="wallet" size={16} color="#22d3ee" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-white">{$t('settings.wallets')}</p>
        <p class="text-mini text-white/50">{$t('settings.walletsSub')}</p>
      </div>
      <Icon name="arrow-right" size={14} color="rgba(212,175,55,0.6)" mirror={true} />
    </button>
    <button
      on:click={() => auth.logout()}
      class="w-full flex items-center gap-3 px-4 py-3 text-start active:bg-white/5"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);"
      >
        <Icon name="logout" size={16} color="#fca5a5" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-red-400">{$t('settings.logout')}</p>
        <p class="text-mini text-white/50">{$t('settings.logoutSub')}</p>
      </div>
    </button>
  </div>
</div>

<style>
  .toggle {
    -webkit-appearance: none;
    appearance: none;
    width: 40px;
    height: 22px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.15);
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle:checked {
    background: linear-gradient(180deg, #f4e5a8, #d4af37);
  }
  .toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    inset-inline-start: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  .toggle:checked::after {
    transform: translateX(18px);
  }
  :global(html[dir='rtl']) .toggle:checked::after {
    transform: translateX(-18px);
  }
</style>
