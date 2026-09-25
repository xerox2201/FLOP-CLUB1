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

  $: level = loyalty?.level ?? 1;
  $: xpInto = loyalty?.xpIntoLevel ?? 0;
  $: xpNext = loyalty?.xpForNextLevel ?? 100;
  $: xpPct = xpNext > 0 ? Math.min(100, (xpInto / xpNext) * 100) : 0;
  $: tierColor = loyalty?.tierColor ?? '#6ee7b7';
  $: tierLabel = loyalty?.tierLabel ?? 'Welcome';
  $: tierIcon = loyalty?.tierIcon ?? '🌱';
  $: rakebackPct = Math.round((loyalty?.rakebackPct ?? 0) * 100);
  $: progressTier = Math.round((loyalty?.progressToNextTier ?? 0) * 100);
</script>

<div class="pb-28">
  <TopBar />
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2.5"
        stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg
      >
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1 flex items-center gap-2">
      <Icon name="star" size={22} />
      <span>Loyalty</span>
    </h1>
  </div>

  <div
    class="mx-4 rounded-3xl p-5 mb-3"
    style="background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(7,14,27,0.95)); border: 1.5px solid rgba(139,92,246,0.5);"
  >
    <div class="flex items-center gap-2 mb-3">
      <Icon name="star" size={18} />
      <p
        class="text-[10px] uppercase tracking-widest font-extrabold flex-1"
        style="color: #a78bfa;"
      >
        XP Level
      </p>
      <span class="text-2xl font-extrabold" style="color: #a78bfa;">{level}</span>
    </div>
    <div class="w-full h-3 rounded-full overflow-hidden mb-2" style="background: rgba(0,0,0,0.55);">
      <div
        class="h-full rounded-full transition-all"
        style="width: {xpPct}%; background: linear-gradient(90deg, #c4b5fd, #8b5cf6, #6d28d9); box-shadow: 0 0 12px rgba(139,92,246,0.7);"
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
      class="w-full mt-3 rounded-xl py-3 text-[12px] font-extrabold active:scale-[0.98]"
      style="background: linear-gradient(180deg, #a78bfa, #6d28d9); color: white; box-shadow: 0 3px 0 #4c1d95;"
    >
      <span class="flex items-center justify-center gap-1.5">
        <Icon name="gem" size={14} color="#ffffff" />
        <span>Cash Out XP</span>
      </span>
    </button>
  </div>

  <div
    class="mx-4 rounded-3xl p-5 mb-3"
    style="background: linear-gradient(135deg, {tierColor}20, rgba(7,14,27,0.95)); border: 1.5px solid {tierColor}80;"
  >
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xl">{tierIcon}</span>
      <p
        class="text-[10px] uppercase tracking-widest font-extrabold flex-1"
        style="color: {tierColor};"
      >
        Rakeback Tier
      </p>
      <span class="text-base font-extrabold" style="color: {tierColor};">{tierLabel}</span>
    </div>
    <p class="text-3xl font-extrabold tabular-nums mb-3" style="color: {tierColor};">
      {rakebackPct}%
    </p>
    <div
      class="w-full h-2.5 rounded-full overflow-hidden mb-2"
      style="background: rgba(0,0,0,0.55);"
    >
      <div
        class="h-full rounded-full transition-all"
        style="width: {progressTier}%; background: linear-gradient(90deg, {tierColor}, {tierColor}cc); box-shadow: 0 0 12px {tierColor}80;"
      ></div>
    </div>
    <div class="flex justify-between text-[10px] text-white/60 tabular-nums mb-3">
      <span>${fmt(loyalty?.lifetimeRake ?? 0)} rake</span>
      {#if loyalty?.nextTier}<span
          >${fmt(loyalty.nextTier.minRake)} to {loyalty.nextTier.label}</span
        >{/if}
    </div>
    <div
      class="grid grid-cols-2 gap-2 text-center py-3"
      style="border-top: 1px solid rgba(255,255,255,0.08);"
    >
      <div>
        <p class="text-[9px] text-white/40 uppercase font-bold">Rake Paid</p>
        <p class="text-sm font-extrabold text-red-300 tabular-nums">
          ${fmt(loyalty?.rakePaidLifetime ?? 0)}
        </p>
      </div>
      <div>
        <p class="text-[9px] text-white/40 uppercase font-bold">Rakeback</p>
        <p class="text-sm font-extrabold text-emerald-400 tabular-nums">
          +${fmt(loyalty?.rakebackEarned ?? 0)}
        </p>
      </div>
    </div>
  </div>
</div>

<XPConvertModal
  bind:open={showXpConvert}
  availableXp={loyalty?.availableXp ?? 0}
  {level}
  onClose={() => (showXpConvert = false)}
/>
