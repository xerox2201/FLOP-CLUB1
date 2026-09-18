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
    <h1 class="text-xl font-extrabold flex-1">⚙️ Settings</h1>
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
        <!-- Radio circle -->
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

        <!-- Name -->
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

        <!-- Color swatches -->
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
        <span class="text-xl">🔊</span>
        <div>
          <p class="text-sm font-bold text-white">Sound Effects</p>
          <p class="text-[10px] text-white/50">Card & chip sounds</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={sound} class="toggle" />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer">
      <div class="flex items-center gap-3">
        <span class="text-xl">🎵</span>
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
        <span class="text-xl">📳</span>
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
        <span class="text-xl">✨</span>
        <div>
          <p class="text-sm font-bold text-white">Animations</p>
          <p class="text-[10px] text-white/50">Card & chip animations</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={animations} class="toggle" />
    </label>
    <div class="px-4 py-3">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-xl">🎨</span>
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
        <span class="text-xl">🎚️</span>
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
        <span class="text-xl">🙈</span>
        <div>
          <p class="text-sm font-bold text-white">Auto-Muck</p>
          <p class="text-[10px] text-white/50">Auto-fold losing hands</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={autoMuck} class="toggle" />
    </label>
    <label class="flex items-center justify-between px-4 py-3 cursor-pointer">
      <div class="flex items-center gap-3">
        <span class="text-xl">💰</span>
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
      <span class="text-xl">🔐</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Security</p>
        <p class="text-[10px] text-white/50">Password & 2FA</p>
      </div>
      <span class="text-white/30">›</span>
    </button>
    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      style="border-bottom: 1px solid rgba(212,175,55,0.08);"
    >
      <span class="text-xl">🔌</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Connected Wallets</p>
        <p class="text-[10px] text-white/50">Manage TON wallet</p>
      </div>
      <span class="text-white/30">›</span>
    </button>
    <button
      on:click={() => auth.logout()}
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
    >
      <span class="text-xl">🚪</span>
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