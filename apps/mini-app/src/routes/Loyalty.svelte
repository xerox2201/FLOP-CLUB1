<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import XPConvertModal from '../components/XPConvertModal.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  $: loyalty = $auth.loyalty;
  let showXpConvert = false;

  function fmt(n: any): string {
    return `$${Number(n || 0).toFixed(2)}`;
  }
  function fmtN(n: any): string {
    return Number(n || 0).toLocaleString();
  }

  // Tier badge glyph. The API sends an emoji in `tierIcon`, which is mapped to an
  // equivalent vector icon so this page only ever renders Icon.svelte glyphs.
  const TIER_ICONS: Record<string, string> = {
    welcome: 'seed',
    bronze: 'medal_bronze',
    silver: 'medal_silver',
    gold: 'medal_gold',
    platinum: 'gem',
    diamond: 'sparkles',
  };

  $: level = loyalty?.level ?? 1;
  $: xpInto = loyalty?.xpIntoLevel ?? 0;
  $: xpNext = loyalty?.xpForNextLevel ?? 100;
  $: xpPct = xpNext > 0 ? Math.min(100, (xpInto / xpNext) * 100) : 0;
  $: tierColor = loyalty?.tierColor ?? '#6ee7b7';
  $: tierLabel = loyalty?.tierLabel ?? 'Welcome';
  $: tierIconName = TIER_ICONS[loyalty?.tier ?? 'welcome'] ?? 'star';
  $: rakebackPct = Math.round((loyalty?.rakebackPct ?? 0) * 100);
  $: progressTier = Math.round((loyalty?.progressToNextTier ?? 0) * 100);
</script>

<div class="pb-28">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="px-4 mt-2 mb-3">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        aria-label="Back"
        class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition shrink-0"
        style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
      >
        <Icon name="arrow-left" size={18} color="#ffffff" />
      </button>

      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
          border: 1.5px solid rgba(244,201,93,0.55);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
        "
      >
        <Icon name="star" size={24} color="#f4c95d" />
      </div>

      <div class="flex-1 min-w-0">
        <h1
          class="text-[26px] font-extrabold leading-none tracking-tight"
          style="
            background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
          "
        >
          Loyalty
        </h1>
        <p class="text-[10px] text-white/45 mt-1 font-bold truncate">
          XP levels, rakeback tiers and rewards
        </p>
      </div>
    </div>
  </div>

  {#if !loyalty && $auth.loading}
    <!-- ============ LOADING SKELETON ============ -->
    <div class="px-4 space-y-2">
      <div class="grid grid-cols-2 gap-2">
        {#each Array(2) as _}
          <div
            class="rounded-2xl h-[78px] shimmer"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
          ></div>
        {/each}
      </div>
      {#each Array(2) as _}
        <div
          class="rounded-2xl h-[150px] shimmer"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if !loyalty}
    <!-- ============ EMPTY STATE ============ -->
    <div class="px-4">
      <div
        class="rounded-2xl p-6 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <Icon name="star" size={40} color="#d4af37" />
        </div>
        <p class="text-sm font-extrabold text-white">No loyalty data yet</p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">
          Play a hand to start earning XP and rakeback
        </p>
      </div>
    </div>
  {:else}
    <!-- ============ SUMMARY GRID ============ -->
    <div class="grid grid-cols-2 gap-2 px-4 mb-3">
      <!-- Level -->
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(37,99,235,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(37,99,235,0.2); border: 1px solid rgba(37,99,235,0.4);"
          >
            <Icon name="zap" size={12} color="#93c5fd" />
          </div>
          <span class="text-[9px] font-extrabold uppercase tracking-wider" style="color: #93c5fd;">
            Level
          </span>
        </div>
        <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">{level}</p>
        <p class="text-[9px] text-white/45 mt-1 font-bold tabular-nums">
          {fmtN(xpInto)} / {fmtN(xpNext)} XP
        </p>
      </div>

      <!-- Rakeback rate -->
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, {tierColor}18 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid {tierColor}45;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: {tierColor}22; border: 1px solid {tierColor}50;"
          >
            <Icon name={tierIconName} size={12} color={tierColor} />
          </div>
          <span
            class="text-[9px] font-extrabold uppercase tracking-wider"
            style="color: {tierColor};"
          >
            Rakeback
          </span>
        </div>
        <p class="text-[17px] font-extrabold tabular-nums leading-none" style="color: {tierColor};">
          {rakebackPct}%
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold truncate">{tierLabel} tier</p>
      </div>

      <!-- Rake paid -->
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(239,68,68,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(239,68,68,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4);"
          >
            <Icon name="receipt" size={12} color="#fca5a5" />
          </div>
          <span class="text-[9px] font-extrabold uppercase tracking-wider text-red-300">
            Rake Paid
          </span>
        </div>
        <p class="text-[17px] font-extrabold text-red-300 tabular-nums leading-none">
          {fmt(loyalty?.rakePaidLifetime ?? 0)}
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold">Lifetime</p>
      </div>

      <!-- Rakeback earned -->
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(16,185,129,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
          >
            <Icon name="gift" size={12} color="#6ee7b7" />
          </div>
          <span class="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
            Rakeback
          </span>
        </div>
        <p class="text-[17px] font-extrabold text-emerald-400 tabular-nums leading-none">
          +{fmt(loyalty?.rakebackEarned ?? 0)}
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold">Returned to you</p>
      </div>
    </div>

    <!-- ============ XP LEVEL CARD ============ -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.2) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(37,99,235,0.4);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 24px rgba(37,99,235,0.12);
        "
      >
        <div class="flex items-center gap-2 mb-3">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style="
              background: linear-gradient(180deg, rgba(37,99,235,0.35), rgba(109,40,217,0.12));
              border: 1px solid rgba(37,99,235,0.55);
            "
          >
            <Icon name="zap" size={16} color="#93c5fd" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] uppercase tracking-widest font-extrabold" style="color: #60a5fa;">
              XP Level
            </p>
            <p class="text-[9px] text-white/45 font-bold truncate">
              {fmtN(Math.max(0, xpNext - xpInto))} XP to level {level + 1}
            </p>
          </div>
          <div class="flex items-baseline gap-1 shrink-0">
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-blue-300">
              LVL
            </span>
            <span class="text-2xl font-extrabold leading-none" style="color: #60a5fa;">{level}</span
            >
          </div>
        </div>

        <div
          class="w-full h-3 rounded-full overflow-hidden mb-2"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {xpPct}%;
              background: linear-gradient(90deg, #93c5fd, #3b82f6, #6d28d9);
              box-shadow: 0 0 12px rgba(37,99,235,0.7);
            "
          ></div>
        </div>
        <div class="flex justify-between text-[10px] text-white/60 tabular-nums mb-3">
          <span>{fmtN(xpInto)} / {fmtN(xpNext)} XP</span>
          <span>{fmtN(Math.max(0, xpNext - xpInto))} to L{level + 1}</span>
        </div>

        <div
          class="grid grid-cols-3 gap-2 text-center py-3"
          style="border-top: 1px solid rgba(255,255,255,0.08);"
        >
          <div>
            <p class="text-[9px] text-white/40 uppercase font-bold">Lifetime</p>
            <p class="text-sm font-extrabold text-white tabular-nums">
              {fmtN(loyalty?.lifetimeXp ?? 0)}
            </p>
          </div>
          <div>
            <p class="text-[9px] text-white/40 uppercase font-bold">Claimed</p>
            <p class="text-sm font-extrabold text-amber-300 tabular-nums">
              {fmtN(loyalty?.claimedXp ?? 0)}
            </p>
          </div>
          <div>
            <p class="text-[9px] text-white/40 uppercase font-bold">Available</p>
            <p class="text-sm font-extrabold text-emerald-400 tabular-nums">
              {fmtN(loyalty?.availableXp ?? 0)}
            </p>
          </div>
        </div>

        <button
          on:click={() => (showXpConvert = true)}
          class="w-full mt-3 rounded-xl py-3 text-[12px] font-extrabold active:scale-[0.98] transition-all"
          style="
            background: linear-gradient(180deg, #60a5fa, #6d28d9);
            color: white;
            box-shadow: 0 3px 0 #4c1d95, 0 8px 20px rgba(37,99,235,0.35);
          "
        >
          <span class="flex items-center justify-center gap-1.5">
            <Icon name="gem" size={14} color="#ffffff" />
            <span>Cash Out XP</span>
            <span class="text-[10px] font-mono opacity-80">
              ({fmtN(loyalty?.availableXp ?? 0)} avail)
            </span>
          </span>
        </button>
      </div>
    </div>

    <!-- ============ RAKEBACK TIER CARD ============ -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, {tierColor}18 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid {tierColor}45;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 24px {tierColor}18;
        "
      >
        <div class="flex items-center gap-2 mb-3">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style="
              background: linear-gradient(180deg, {tierColor}30, {tierColor}10);
              border: 1px solid {tierColor}60;
            "
          >
            <Icon name={tierIconName} size={16} color={tierColor} />
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-[10px] uppercase tracking-widest font-extrabold"
              style="color: {tierColor};"
            >
              Rakeback Tier
            </p>
            <p class="text-[9px] text-white/45 font-bold truncate">
              Lifetime rake unlocks better rates
            </p>
          </div>
          <div
            class="rounded-full px-2.5 py-1 shrink-0"
            style="background: {tierColor}22; border: 1px solid {tierColor}70;"
          >
            <span class="text-[10px] font-extrabold leading-none" style="color: {tierColor};">
              {tierLabel}
            </span>
          </div>
        </div>

        <div class="flex items-end justify-between mb-3">
          <p
            class="text-[32px] font-extrabold tabular-nums leading-none"
            style="color: {tierColor}; filter: drop-shadow(0 2px 10px {tierColor}55);"
          >
            {rakebackPct}%
          </p>
          <p class="text-[9px] text-white/45 font-bold uppercase tracking-wider pb-1">
            Rakeback rate
          </p>
        </div>

        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[9px] font-bold text-white/60 uppercase tracking-wider">
            Tier Progress
          </span>
          <span class="text-[9px] font-bold tabular-nums" style="color: {tierColor};">
            {progressTier}%
          </span>
        </div>
        <div
          class="w-full h-2.5 rounded-full overflow-hidden mb-2"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {progressTier}%;
              background: linear-gradient(90deg, {tierColor}, {tierColor}cc);
              box-shadow: 0 0 12px {tierColor}80;
            "
          ></div>
        </div>
        <div class="flex justify-between text-[10px] text-white/60 tabular-nums">
          <span>{fmt(loyalty?.lifetimeRake ?? 0)} rake</span>
          {#if loyalty?.nextTier}
            <span>{fmt(loyalty.nextTier.minRake)} to {loyalty.nextTier.label}</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<XPConvertModal
  bind:open={showXpConvert}
  availableXp={loyalty?.availableXp ?? 0}
  {level}
  onClose={() => (showXpConvert = false)}
/>
