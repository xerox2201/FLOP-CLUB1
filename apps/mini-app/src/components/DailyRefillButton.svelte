<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import Icon from './Icon.svelte';

  let status: any = null;
  let busy = false;
  let toast = '';
  let now = Date.now();
  let tickTimer: any = null;

  async function load() {
    try {
      const res = await api.request('/api/daily-refill/status');
      if (res.ok) status = res.data;
    } catch {
      /* silent — retry on next interval */
    }
  }

  async function claim() {
    if (busy || !status?.canClaim) return;
    busy = true;
    try {
      const res = await api.request<{ ok: boolean; amount: number }>('/api/daily-refill/claim', {
        method: 'POST',
        body: '{}',
      });
      if (res.ok && res.data) {
        toast = `+${(res.data as any).amount.toLocaleString()} chips!`;
        await auth.refresh();
        await load();
        setTimeout(() => (toast = ''), 2500);
      }
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    load();
    tickTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => {
      if (tickTimer) clearInterval(tickTimer);
    };
  });

  // Countdown to next availability
  $: nextAt = status?.nextAvailableAt ? new Date(status.nextAvailableAt).getTime() : 0;
  $: remainingMs = Math.max(0, nextAt - now);
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

  $: canClaim = status?.canClaim === true && remainingMs <= 0;
</script>

{#if status}
  <div class="mx-4 mb-4">
    <button
      type="button"
      on:click={canClaim ? claim : undefined}
      disabled={!canClaim || busy}
      class="w-full rounded-2xl p-3.5 flex items-center gap-3 text-left transition-all relative overflow-hidden {canClaim
        ? 'active:scale-[0.98]'
        : 'cursor-default'}"
      style="
        background:
          radial-gradient(ellipse at 0% 50%,
            {canClaim ? 'rgba(244,201,93,0.28)' : 'rgba(139,92,246,0.15)'} 0%,
            transparent 60%),
          linear-gradient(135deg, rgba(8,20,40,0.95), rgba(5,12,25,0.98));
        border: 1.5px solid {canClaim ? 'rgba(244,201,93,0.55)' : 'rgba(139,92,246,0.35)'};
        box-shadow:
          0 6px 24px rgba(0,0,0,0.5),
          0 0 24px {canClaim ? 'rgba(244,201,93,0.2)' : 'rgba(0,0,0,0)'},
          inset 0 1px 0 rgba(255,255,255,0.06);
      "
    >
      {#if canClaim}
        <div class="absolute inset-0 pointer-events-none daily-shimmer"></div>
      {/if}

      <!-- Icon -->
      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center relative shrink-0"
        style="
          background: radial-gradient(circle at 30% 30%,
            {canClaim ? 'rgba(255,235,170,0.5)' : 'rgba(139,92,246,0.3)'},
            {canClaim ? 'rgba(244,201,93,0.15)' : 'rgba(139,92,246,0.08)'});
          border: 1.5px solid {canClaim ? 'rgba(244,201,93,0.65)' : 'rgba(139,92,246,0.4)'};
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px {canClaim
          ? 'rgba(244,201,93,0.3)'
          : 'rgba(0,0,0,0.3)'};
          {canClaim ? 'animation: daily-pulse 2s ease-in-out infinite;' : ''}
        "
      >
        <Icon name="gift" size={24} color={canClaim ? '#f4c95d' : '#a78bfa'} />
        {#if canClaim}
          <span
            class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-300 animate-pulse"
            style="box-shadow: 0 0 10px #fbbf24;"
          ></span>
        {/if}
      </div>

      <!-- Text -->
      <div class="flex-1 min-w-0 relative">
        <p
          class="text-[10px] font-extrabold uppercase tracking-widest mb-0.5"
          style="color: {canClaim ? '#f4c95d' : '#a78bfa'};"
        >
          {canClaim ? 'Daily Bonus Ready' : 'Daily Bonus'}
        </p>
        <p
          class="text-xl font-extrabold leading-none tabular-nums"
          style="color: {canClaim ? '#ffffff' : 'rgba(255,255,255,0.7)'};"
        >
          +{status.refillAmount?.toLocaleString?.() ?? 0}
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold truncate">
          {#if canClaim}
            Tap to claim · {status.tierLabel} tier
          {:else if countdown}
            Next in {countdown} · {status.tierLabel}
          {:else}
            {status.tierLabel} tier
          {/if}
        </p>
      </div>

      <!-- Action -->
      <div
        class="relative flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0"
        style="
          background: {canClaim
          ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
          : 'rgba(139,92,246,0.15)'};
          border: 1px solid {canClaim ? 'rgba(255,235,170,0.6)' : 'rgba(139,92,246,0.35)'};
          box-shadow: {canClaim ? '0 3px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.4)' : 'none'};
        "
      >
        {#if canClaim}
          <span class="text-[11px] font-extrabold" style="color: #0a0800;">
            {busy ? '…' : 'Claim'}
          </span>
        {:else}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a78bfa"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        {/if}
      </div>
    </button>

    {#if toast}
      <p class="text-[11px] text-amber-300 font-bold text-center mt-2">{toast}</p>
    {/if}
  </div>
{/if}

<style>
  @keyframes daily-shimmer-kf {
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

  .daily-shimmer {
    background: linear-gradient(
      110deg,
      transparent 30%,
      rgba(244, 201, 93, 0.2) 50%,
      transparent 70%
    );
    animation: daily-shimmer-kf 3s ease-in-out infinite;
  }

  @keyframes daily-pulse {
    0%,
    100% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        0 4px 12px rgba(244, 201, 93, 0.3);
    }
    50% {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        0 4px 20px rgba(244, 201, 93, 0.6);
    }
  }
</style>
