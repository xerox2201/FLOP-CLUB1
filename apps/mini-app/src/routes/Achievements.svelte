<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { auth } from '../stores/auth';

  export let onBack: () => void = () => {};

  // Derive real progress from user data
  $: user = $auth.user;
  $: chips = $auth.freeChips;
  $: handsPlayed = chips?.total_hands || 0;

  // Achievement definitions (derived from stats)
  const achievements = [
    {
      id: 'first_hand',
      icon: '🎯',
      title: 'First Hand',
      desc: 'Play your first hand',
      target: 1,
      current: () => Math.min(handsPlayed, 1),
      reward: '50 chips',
      rarity: 'common',
    },
    {
      id: 'grinder',
      icon: '⚙️',
      title: 'Grinder',
      desc: 'Play 100 hands',
      target: 100,
      current: () => Math.min(handsPlayed, 100),
      reward: '500 chips',
      rarity: 'rare',
    },
    {
      id: 'veteran',
      icon: '🎖️',
      title: 'Veteran',
      desc: 'Play 500 hands',
      target: 500,
      current: () => Math.min(handsPlayed, 500),
      reward: '2,500 chips',
      rarity: 'epic',
    },
    {
      id: 'legend',
      icon: '🏆',
      title: 'Legend',
      desc: 'Play 1000 hands',
      target: 1000,
      current: () => Math.min(handsPlayed, 1000),
      reward: '10,000 chips',
      rarity: 'legendary',
    },
    {
      id: 'chips_1k',
      icon: '💰',
      title: 'Chip Collector',
      desc: 'Hold 1,000 chips',
      target: 1000,
      current: () => Math.min(Number(chips?.chips || 0), 1000),
      reward: 'Badge',
      rarity: 'common',
    },
    {
      id: 'chips_10k',
      icon: '💎',
      title: 'High Roller',
      desc: 'Hold 10,000 chips',
      target: 10000,
      current: () => Math.min(Number(chips?.chips || 0), 10000),
      reward: 'Gold badge',
      rarity: 'legendary',
    },
  ];

  const rarityColors: Record<string, { bg: string; border: string; glow: string }> = {
    common: {
      bg: 'rgba(107,114,128,0.15)',
      border: 'rgba(107,114,128,0.4)',
      glow: 'rgba(107,114,128,0.4)',
    },
    rare: {
      bg: 'rgba(34,211,238,0.15)',
      border: 'rgba(34,211,238,0.5)',
      glow: 'rgba(34,211,238,0.5)',
    },
    epic: {
      bg: 'rgba(139,92,246,0.18)',
      border: 'rgba(139,92,246,0.55)',
      glow: 'rgba(139,92,246,0.5)',
    },
    legendary: {
      bg: 'rgba(244,201,93,0.2)',
      border: 'rgba(244,201,93,0.6)',
      glow: 'rgba(244,201,93,0.6)',
    },
  };

  $: unlockedCount = achievements.filter((a) => a.current() >= a.target).length;
  $: totalCount = achievements.length;
  $: level = Math.floor(handsPlayed / 50) + 1;
  $: xpInLevel = handsPlayed % 50;
  $: xpProgress = (xpInLevel / 50) * 100;
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
    <h1 class="text-xl font-extrabold flex-1">Achievements</h1>
  </div>

  <!-- Level card -->
  <div
    class="rounded-3xl p-4 mb-5 relative overflow-hidden"
    style="background: linear-gradient(135deg, rgba(244,201,93,0.2), rgba(168,121,34,0.08)); border: 1px solid rgba(244,201,93,0.35);"
  >
    <div
      class="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-25"
      style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
    ></div>

    <div class="flex items-center gap-3 mb-3 relative">
      <div
        class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-near-black badge-gold"
      >
        {level}
      </div>
      <div class="flex-1">
        <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold">Level</p>
        <p class="text-xl font-extrabold text-white tabular-nums">{level}</p>
        <p class="text-[10px] text-white/50">{handsPlayed} total hands</p>
      </div>
    </div>

    <div class="relative">
      <div class="flex justify-between text-[10px] text-white/60 mb-1">
        <span>XP Progress</span>
        <span class="tabular-nums">{xpInLevel} / 50</span>
      </div>
      <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.4);">
        <div
          class="h-full rounded-full transition-all"
          style="width: {xpProgress}%; background: linear-gradient(90deg, #ffe9a8, #f4c95d, #a87922);"
        ></div>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 gap-3 mb-5">
    <div class="card text-center">
      <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Unlocked</p>
      <p class="text-2xl font-extrabold text-emerald-400 tabular-nums">
        {unlockedCount}
      </p>
      <p class="text-[10px] text-white/40">of {totalCount}</p>
    </div>
    <div class="card text-center">
      <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1">Progress</p>
      <p class="text-2xl font-extrabold text-gold tabular-nums">
        {Math.round((unlockedCount / totalCount) * 100)}%
      </p>
      <p class="text-[10px] text-white/40">complete</p>
    </div>
  </div>

  <!-- Achievements list -->
  <h2 class="text-base font-extrabold mb-3 px-1 text-white/90">All Achievements</h2>
  <div class="space-y-2.5">
    {#each achievements as a}
      {@const cur = a.current()}
      {@const done = cur >= a.target}
      {@const pct = Math.min(100, (cur / a.target) * 100)}
      {@const rc = rarityColors[a.rarity]}
      <div
        class="rounded-2xl p-3 flex items-center gap-3"
        style="background: {rc.bg}; border: 1px solid {done
          ? rc.border
          : 'rgba(255,255,255,0.08)'}; {done ? `box-shadow: 0 0 16px ${rc.glow}40;` : ''}"
      >
        <!-- Icon -->
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 {!done
            ? 'grayscale opacity-40'
            : ''}"
          style="background: rgba(0,0,0,0.35); border: 1px solid {rc.border};"
        >
          {a.icon}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="text-sm font-extrabold truncate {done ? 'text-white' : 'text-white/60'}">
              {a.title}
            </p>
            {#if done}
              <span
                class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full text-near-black badge-gold"
              >
                ✓ DONE
              </span>
            {/if}
          </div>
          <p class="text-[10px] text-white/50 truncate">{a.desc}</p>

          <!-- Progress -->
          {#if !done}
            <div class="mt-1.5 flex items-center gap-2">
              <div
                class="flex-1 h-1.5 rounded-full overflow-hidden"
                style="background: rgba(0,0,0,0.4);"
              >
                <div
                  class="h-full rounded-full"
                  style="width: {pct}%; background: {rc.border};"
                ></div>
              </div>
              <span class="text-[9px] font-mono text-white/50 tabular-nums shrink-0">
                {cur}/{a.target}
              </span>
            </div>
          {/if}
        </div>

        <!-- Reward -->
        <div class="text-right shrink-0">
          <p class="text-[9px] text-white/40 uppercase font-bold">Reward</p>
          <p class="text-[11px] font-extrabold {done ? 'text-emerald-400' : 'text-gold'}">
            {a.reward}
          </p>
        </div>
      </div>
    {/each}
  </div>
</div>
