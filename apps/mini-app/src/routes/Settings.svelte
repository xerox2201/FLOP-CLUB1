<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { auth } from '../stores/auth';

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
      // ignore parse errors
    }
  });

  function save() {
    try {
      localStorage.setItem(
        'settings',
        JSON.stringify({
          sound,
          music,
          haptics,
          animations,
          graphics,
          autoMuck,
          fourColor,
          betSlider,
          autoPostBlinds,
        }),
      );
    } catch {
      // ignore storage errors
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
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      ←
    </button>
    <h1 class="text-xl font-extrabold flex-1">⚙️ Settings</h1>
  </div>

  <!-- AUDIO -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 px-1">Audio</h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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

  <!-- EXPERIENCE -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 px-1">
    Experience
  </h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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
            class="py-1.5 rounded-lg text-[10px] font-bold uppercase transition {graphics === g
              ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
              : 'bg-white/5 text-white/60'}"
          >
            {g}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- TABLE -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 px-1">
    Table Preferences
  </h2>
  <div class="card !p-0 mb-4 overflow-hidden">
    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
    >
      <div class="flex items-center gap-3">
        <span class="text-xl">🃏</span>
        <div>
          <p class="text-sm font-bold text-white">Four-Color Deck</p>
          <p class="text-[10px] text-white/50">Colored suit symbols</p>
        </div>
      </div>
      <input type="checkbox" bind:checked={fourColor} class="toggle" />
    </label>

    <label
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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

  <!-- ACCOUNT -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2 px-1">Account</h2>
  <div class="card !p-0 overflow-hidden">
    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
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
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
    >
      <span class="text-xl">🔌</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Connected Wallets</p>
        <p class="text-[10px] text-white/50">Manage TON wallet</p>
      </div>
      <span class="text-white/30">›</span>
    </button>

    <button
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
      style="border-bottom: 1px solid rgba(139,92,246,0.1);"
    >
      <span class="text-xl">📱</span>
      <div class="flex-1">
        <p class="text-sm font-bold text-white">Devices</p>
        <p class="text-[10px] text-white/50">Active sessions</p>
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
    background: linear-gradient(180deg, #ffe9a8, #f4c95d);
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
