<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { auth } from '../stores/auth';
  import { cardTheme, CARD_THEMES } from '../stores/cardTheme';

  export let onBack: () => void = () => {};

  let sound = true;
  let music = false;
  let haptics = true;
  let animations = true;
  let graphics: 'ultra' | 'high' | 'medium' | 'performance' = 'high';
  let autoMuck = true;
  let fourColor = false;
  let betSlider = true;
  let autoPostBlinds = true;

  onMount(() => {
    try {
      const saved = localStorage.getItem('settings');
      if (saved) {
        const s = JSON.parse(saved);
        sound = s.sound ?? true;
        music = s.music ?? false;
        haptics = s.haptics ?? true;
        animations = s.animations ?? true;
        graphics = s.graphics ?? 'high';
        autoMuck = s.autoMuck ?? true;
        fourColor = s.fourColor ?? false;
        betSlider = s.betSlider ?? true;
        autoPostBlinds = s.autoPostBlinds ?? true;
      }
    } catch {
      /* ignore */
    }
  });

  function save() {
    try {
      localStorage.setItem(
        'settings',
        JSON.stringify({
          sound, music, haptics, animations, graphics,
          autoMuck, fourColor, betSlider, autoPostBlinds,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  $: if (typeof window !== 'undefined') save();
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="
        background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7));
        border: 1.5px solid rgba(96,165,250,0.3);
      "
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold flex-1 flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      <span>Settings</span>
    </h1>
  </div>

  <!-- ============ CARD THEME ============ -->
  <h2 class="t-label text-gold/60 mb-2 px-1">Card Theme</h2>
  <div
    class="rounded-2xl p-1.5 mb-4"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    {#each CARD_THEMES as t}
      <button
        on:click={() => cardTheme.set(t.id)}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:scale-[0.98] transition-all text-left"
        style="
          background: {$cardTheme === t.id
            ? 'linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.08))'
            : 'transparent'};
          border: 1.5px solid {$cardTheme === t.id
            ? 'rgba(212,175,55,0.5)'
            : 'transparent'};
          { $cardTheme === t.id
            ? 'box-shadow: 0 0 12px rgba(212,175,55,0.25);'
            : ''}
        "
      >
        <div
          class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
          style="
            border-color: {$cardTheme === t.id ? '#d4af37' : 'rgba(255,255,255,0.25)'};
            background: {$cardTheme === t.id ? 'rgba(212,175,55,0.15)' : 'transparent'};
          "
        >
          {#if $cardTheme === t.id}
            <div class="w-2.5 h-2.5 rounded-full" style="background: #d4af37;"></div>
          {/if}
        </div>

        <div class="flex-1 min-w-0">
          <p
            class="text-[13px] font-extrabold leading-tight"
            style="color: {$cardTheme === t.id ? '#f4e5a8' : 'rgba(255,255,255,0.9)'};"
          >
            {t.name}
          </p>
          <p class="text-[10px] text-white/40 leading-tight mt-0.5">
            {t.nameFa} · {t.desc}
          </p>
        </div>

        <div class="flex gap-1 shrink-0">
          {#each t.previewColors as c}
            <div
              class="w-3 h-3 rounded-full"
              style="
                background: {c};
                box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.3);
              "
            ></div>
          {/each}
        </div>
      </button>
    {/each}
  </div>

  <!-- ============ AUDIO ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">Audio</h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Sound Effects</p>
          <p class="text-[10px] text-white/50">Card & chip sounds</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={sound} class="toggle" />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer">
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Background Music</p>
          <p class="text-[10px] text-white/50">Ambient music</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={music} class="toggle" />
    </label>
  </div>

  <!-- ============ EXPERIENCE ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">Experience</h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
          <path d="M2 9h1" />
          <path d="M2 13h1" />
          <path d="M21 9h1" />
          <path d="M21 13h1" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Haptics</p>
          <p class="text-[10px] text-white/50">Vibration feedback</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={haptics} class="toggle" />
    </label>
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
          <path d="M19 17l.5 1.5L21 19l-1.5.5L19 21l-.5-1.5L17 19l1.5-.5z" />
          <path d="M5 3l.4 1.2L7 4.6 5.4 5 5 6.2 4.6 5 3 4.6l1.6-.4z" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Animations</p>
          <p class="text-[10px] text-white/50">Card & chip animations</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={animations} class="toggle" />
    </label>
    <div class="px-4 py-3">
      <div class="flex items-center gap-3 mb-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" />
          <circle cx="17.5" cy="10.5" r=".5" />
          <circle cx="8.5" cy="7.5" r=".5" />
          <circle cx="6.5" cy="12.5" r=".5" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Graphics Quality</p>
          <p class="text-[10px] text-white/50">Visual fidelity</p>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-1.5">
        {#each ['ultra', 'high', 'medium', 'performance'] as g}
          <button
            on:click={() => (graphics = g as any)}
            class="py-1.5 rounded-lg text-[10px] font-extrabold uppercase transition"
            style="
              background: {graphics === g
                ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                : 'rgba(255,255,255,0.05)'};
              color: {graphics === g ? '#0a0800' : 'rgba(255,255,255,0.6)'};
            "
          >
            {g}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ============ TABLE ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">Table Preferences</h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Bet Slider</p>
          <p class="text-[10px] text-white/50">Show slider on raise</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={betSlider} class="toggle" />
    </label>
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Auto-Muck</p>
          <p class="text-[10px] text-white/50">Auto-fold losing hands</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={autoMuck} class="toggle" />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer">
      <div class="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="M16.71 13.88l.7.71-2.82 2.82" />
        </svg>
        <div>
          <p class="text-sm font-bold text-white">Auto-Post Blinds</p>
          <p class="text-[10px] text-white/50">Post blinds automatically</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={autoPostBlinds} class="toggle" />
    </label>
  </div>

  <!-- ============ ACCOUNT ============ -->
  <h2 class="t-label text-white/40 mb-2 px-1">Account</h2>
  <div class="card !p-0 overflow-hidden">
    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Security</p>
        <p class="text-[10px] text-white/50">Password & 2FA</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22v-5" />
        <path d="M9 8V2" />
        <path d="M15 8V2" />
        <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" />
      </svg>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Connected Wallets</p>
        <p class="text-[10px] text-white/50">Manage TON wallet</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
    <button
      on:click={() => auth.logout()}
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <div class="flex-1">
        <p class="text-sm font-bold text-red-400">Log Out</p>
        <p class="text-[10px] text-white/50">Sign out of account</p>
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
    left: 2px;
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
</style>