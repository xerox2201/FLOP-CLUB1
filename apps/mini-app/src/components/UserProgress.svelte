<script lang="ts">
  import { fmtAmount } from '../lib/table-geometry';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';

  export let progress: any = null;
  export let onOpen: () => void = () => {};
  export let onOpenMoney: () => void = () => {};

  let money: any = null;

  function fmt(n: any, digits = 2): string {
    const v = Number(n || 0);
    return digits === 2 ? fmtAmount(v) : v.toFixed(digits);
  }
  function fmtPct(x: any): string {
    return `${(Number(x || 0) * 100).toFixed(0)}%`;
  }

  onMount(async () => {
    try {
      const res = await api.request<any>('/api/my/money?period=30d');
      if (res.ok && res.data) money = res.data;
    } catch {
      // silent
    }
  });

  $: level = progress?.level ?? 1;
  $: xpInto = progress?.xpIntoLevel ?? 0;
  $: xpNext = progress?.xpForNextLevel ?? 100;
  $: xpPct = xpNext > 0 ? Math.min(100, (xpInto / xpNext) * 100) : 0;
  $: tierLabel = progress?.tierLabel ?? 'Welcome';
  $: tierIcon = progress?.tierIcon ?? '';
  $: tierColor = progress?.tierColor ?? '#6ee7b7';
  $: rakebackPct = Math.round((progress?.rakebackPct ?? 0) * 100);
  $: progressToNextTier = Math.round((progress?.progressToNextTier ?? 0) * 100);
</script>

{#if progress}
  <div class="px-4 mb-4">
    <button
      on:click={onOpen}
      class="w-full rounded-2xl p-3.5 text-left relative overflow-hidden active:scale-[0.98] transition-all"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, {tierColor}15 0%, transparent 60%),
          linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
        border: 1px solid {tierColor}40;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <!-- Header row -->
      <div class="flex items-center gap-2 mb-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: linear-gradient(180deg, {tierColor}30, {tierColor}10);
            border: 1.5px solid {tierColor}60;
          "
        >
          <span class="text-base leading-none">{tierIcon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-[10px] text-white/45 uppercase tracking-widest font-bold leading-none mb-1"
          >
            Your Progress
          </p>
          <p class="text-[13px] font-extrabold text-white leading-none">
            Level {level}
            <span class="text-white/40 font-bold mx-1">·</span>
            <span style="color: {tierColor};">{tierLabel}</span>
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold leading-none mb-1">
            Rakeback
          </p>
          <p
            class="text-[14px] font-extrabold tabular-nums leading-none"
            style="color: {tierColor};"
          >
            {rakebackPct}%
          </p>
        </div>
      </div>

      <!-- XP bar -->
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[9px] text-white/50 font-bold uppercase tracking-wider">
            XP · Level {level}
          </span>
          <span class="text-[9px] text-white/60 font-bold tabular-nums">
            {xpInto.toLocaleString()} / {xpNext.toLocaleString()}
          </span>
        </div>
        <div
          class="w-full h-1.5 rounded-full overflow-hidden"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {xpPct}%;
              background: linear-gradient(90deg, #93c5fd, #3b82f6 50%, #6d28d9);
              box-shadow: 0 0 8px rgba(37,99,235,0.6);
            "
          ></div>
        </div>
      </div>

      <!-- Tier bar -->
      <div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-[9px] text-white/50 font-bold uppercase tracking-wider">
            Tier Progress
          </span>
          <span class="text-[9px] font-bold tabular-nums" style="color: {tierColor};">
            {progressToNextTier}%
          </span>
        </div>
        <div
          class="w-full h-1.5 rounded-full overflow-hidden"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {progressToNextTier}%;
              background: linear-gradient(90deg, {tierColor}, {tierColor}aa);
              box-shadow: 0 0 8px {tierColor}80;
            "
          ></div>
        </div>
      </div>

      <!-- Footer hint -->
      <div class="flex items-center justify-end gap-1 mt-2.5">
        <span class="text-[9px] font-extrabold" style="color: {tierColor};"> View details </span>
        <Icon name="arrow-right" size={10} color={tierColor} />
      </div>
    </button>

    <!-- My Money strip -->
    {#if money && money.rakePaid > 0}
      <button
        type="button"
        on:click={onOpenMoney}
        class="w-full mt-2 rounded-2xl p-3 relative overflow-hidden active:scale-[0.98] transition-all text-left"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
            linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
          border: 1px solid rgba(16,185,129,0.3);
        "
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.45);"
          >
            <Icon name="dollar" size={15} color="#6ee7b7" />
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-[9px] uppercase tracking-widest font-extrabold text-emerald-300/80 mb-0.5"
            >
              Your Money · 30d
            </p>
            <p class="text-[11px] font-extrabold text-white/90 tabular-nums leading-tight">
              Rake ${fmt(money.rakePaid, 2)} →
              <span class="text-emerald-400">Back ${fmt(money.totalReturned, 2)}</span>
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[14px] font-extrabold text-emerald-400 tabular-nums leading-none">
              {fmtPct(money.returnPct)}
            </p>
            <p class="text-[8px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
              returned
            </p>
          </div>
        </div>
      </button>
    {/if}
  </div>
{/if}
