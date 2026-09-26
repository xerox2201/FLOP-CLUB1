<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import Icon from './Icon.svelte';

  export let onPlayFree: () => void = () => {};

  let refillStatus: any = null;
  let now = Date.now();
  let busy = false;
  let toast = '';
  let tickTimer: any = null;

  async function loadRefill() {
    try {
      const res = await api.request('/api/daily-refill/status');
      if (res.ok) refillStatus = res.data;
    } catch {
      /* silent — retry on next interval */
    }
  }

  async function claimRefill() {
    if (busy || !refillStatus?.canClaim) return;
    busy = true;
    try {
      const res = await api.request<{ ok: boolean; amount: number }>('/api/daily-refill/claim', {
        method: 'POST',
        body: '{}',
      });
      if (res.ok && res.data) {
        toast = `+${(res.data as any).amount.toLocaleString()}`;
        await auth.refresh();
        await loadRefill();
        setTimeout(() => (toast = ''), 2000);
      }
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    loadRefill();
    tickTimer = setInterval(() => (now = Date.now()), 1000);
    return () => {
      if (tickTimer) clearInterval(tickTimer);
    };
  });

  $: chips = Number($auth.freeChips?.chips || 0);
  $: nextAt = refillStatus?.nextAvailableAt ? new Date(refillStatus.nextAvailableAt).getTime() : 0;
  $: remainingMs = Math.max(0, nextAt - now);
  $: canClaim = refillStatus?.canClaim === true && remainingMs <= 0;
  $: countdown = (() => {
    if (remainingMs <= 0) return '';
    const s = Math.floor(remainingMs / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
  })();
</script>

<div class="grid grid-cols-2 gap-2 px-4 mb-4">
  <!-- Free Chips -->
  <button
    on:click={onPlayFree}
    class="rounded-2xl p-3 flex flex-col items-start text-left relative overflow-hidden active:scale-[0.97] transition-all"
    style="
      background:
        radial-gradient(ellipse at 0% 0%, rgba(16,185,129,0.22) 0%, transparent 70%),
        linear-gradient(135deg, rgba(8,20,40,0.95), rgba(5,12,25,0.98));
      border: 1.5px solid rgba(16,185,129,0.4);
      box-shadow: 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
    "
  >
    <div class="flex items-center gap-1.5 mb-2">
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(110,231,183,0.4), rgba(16,185,129,0.15));
          border: 1px solid rgba(16,185,129,0.5);
        "
      >
        <Icon name="gift" size={14} color="#6ee7b7" />
      </div>
      <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">
        Free
      </span>
    </div>
    <p class="text-lg font-extrabold text-white leading-none tabular-nums">
      {chips.toLocaleString()}
    </p>
    <p class="text-[9px] text-white/45 mt-0.5 font-bold">chips</p>
  </button>

  <!-- Daily Bonus -->
  <button
    on:click={canClaim ? claimRefill : undefined}
    disabled={!canClaim || busy}
    class="rounded-2xl p-3 flex flex-col items-start text-left relative overflow-hidden transition-all {canClaim
      ? 'active:scale-[0.97]'
      : 'cursor-default'}"
    style="
      background:
        radial-gradient(ellipse at 100% 0%,
          {canClaim ? 'rgba(244,201,93,0.28)' : 'rgba(139,92,246,0.15)'} 0%,
          transparent 70%),
        linear-gradient(135deg, rgba(8,20,40,0.95), rgba(5,12,25,0.98));
      border: 1.5px solid {canClaim ? 'rgba(244,201,93,0.5)' : 'rgba(139,92,246,0.3)'};
      box-shadow: 0 4px 14px rgba(0,0,0,0.4){canClaim
      ? ', 0 0 20px rgba(244,201,93,0.2)'
      : ''}, inset 0 1px 0 rgba(255,255,255,0.05);
    "
  >
    {#if canClaim}
      <div class="absolute inset-0 pointer-events-none reward-shimmer"></div>
    {/if}

    <div class="flex items-center gap-1.5 mb-2 relative">
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style="
          background: radial-gradient(circle at 30% 30%,
            {canClaim ? 'rgba(255,235,170,0.4)' : 'rgba(139,92,246,0.3)'},
            {canClaim ? 'rgba(244,201,93,0.15)' : 'rgba(139,92,246,0.08)'});
          border: 1px solid {canClaim ? 'rgba(244,201,93,0.6)' : 'rgba(139,92,246,0.4)'};
          {canClaim ? 'animation: reward-pulse 2s ease-in-out infinite;' : ''}
        "
      >
        <Icon name="gift" size={14} color={canClaim ? '#f4c95d' : '#a78bfa'} />
        {#if canClaim}
          <span
            class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-300 animate-pulse"
            style="box-shadow: 0 0 8px #fbbf24;"
          ></span>
        {/if}
      </div>
      <span
        class="text-[9px] font-extrabold uppercase tracking-wider"
        style="color: {canClaim ? '#f4c95d' : '#a78bfa'};"
      >
        Daily
      </span>
    </div>
    <p
      class="text-lg font-extrabold leading-none tabular-nums relative"
      style="color: {canClaim ? '#ffffff' : 'rgba(255,255,255,0.65)'};"
    >
      +{refillStatus?.refillAmount?.toLocaleString?.() ?? 0}
    </p>
    <p
      class="text-[9px] mt-0.5 font-bold relative truncate"
      style="color: {canClaim ? '#f4c95d' : 'rgba(255,255,255,0.4)'};"
    >
      {#if toast}
        {toast}
      {:else if canClaim}
        Tap to claim
      {:else if countdown}
        {countdown}
      {:else}
        Locked
      {/if}
    </p>
  </button>
</div>

<style>
  @keyframes reward-shimmer-kf {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .reward-shimmer {
    background: linear-gradient(
      110deg,
      transparent 30%,
      rgba(244, 201, 93, 0.2) 50%,
      transparent 70%
    );
    animation: reward-shimmer-kf 3s ease-in-out infinite;
  }

  @keyframes reward-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 rgba(244, 201, 93, 0.3);
    }
    50% {
      box-shadow: 0 0 12px rgba(244, 201, 93, 0.6);
    }
  }
</style>
