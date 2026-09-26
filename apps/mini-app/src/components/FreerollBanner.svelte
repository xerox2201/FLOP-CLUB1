<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { serverOffset } from '../lib/serverTime';
  import Icon from './Icon.svelte';

  export let onOpen: (id: number) => void = () => {};

  let freeroll: any = null;
  let eligibility: any = null;
  let loading = true;
  let nowMs = Date.now();
  let timer: any = null;

  async function load() {
    loading = true;
    try {
      const [fr, el] = await Promise.all([
        api.request<{ freeroll: any }>('/api/freeroll/next'),
        api.request<{ eligible: boolean; lifetimeDepositUsd: number; minRequired: number }>(
          '/api/freeroll/eligibility',
        ),
      ]);
      freeroll = fr.ok ? (fr.data as any)?.freeroll : null;
      eligibility = el.ok ? el.data : null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    timer = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    const reload = setInterval(load, 30_000);
    return () => {
      if (timer) clearInterval(timer);
      clearInterval(reload);
    };
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  $: now = nowMs + $serverOffset;
  $: startAt = freeroll ? new Date(freeroll.scheduled_start).getTime() : 0;
  $: remainingMs = Math.max(0, startAt - now);
  $: isLive = freeroll?.status === 'running';
  $: isPast = freeroll && remainingMs === 0 && !isLive;

  $: countdown = (() => {
    if (remainingMs <= 0) return 'Starting now';
    const s = Math.floor(remainingMs / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  })();

  function fmt(n: any): string {
    return `$${Number(n || 0).toFixed(2)}`;
  }
</script>

{#if !loading && freeroll && !isPast}
  <button
    on:click={() => onOpen(freeroll.id)}
    class="mx-4 mb-3 w-[calc(100%-2rem)] rounded-2xl p-3 text-left active:scale-[0.98] transition relative overflow-hidden"
    style="
      background:
        radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.35) 0%, transparent 55%),
        linear-gradient(135deg, rgba(30,20,4,0.98) 0%, rgba(60,40,8,0.95) 50%, rgba(15,10,4,1) 100%);
      border: 1.5px solid rgba(244,201,93,0.6);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(244,201,93,0.25);
    "
  >
    <div
      class="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 pointer-events-none"
      style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
    ></div>

    <div class="relative flex items-center gap-3">
      <div
        class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style="
          background: radial-gradient(circle, rgba(244,201,93,0.4), rgba(168,121,34,0.1));
          border: 1px solid rgba(244,201,93,0.6);
          box-shadow: inset 0 1px 0 rgba(255,235,170,0.4);
        "
      >
        <Icon name="gift" size={22} color="#f4c95d" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-0.5">
          {#if isLive}
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
          {/if}
          <p class="text-[9px] uppercase tracking-[0.3em] font-extrabold" style="color: #f4c95d;">
            {isLive ? 'LIVE NOW' : 'TODAY · FREEROLL'}
          </p>
        </div>
        <p class="text-[13px] font-extrabold text-white leading-tight truncate">
          {freeroll.name}
        </p>
        <div class="flex items-center gap-2 mt-1.5">
          <span
            class="text-[12px] font-extrabold tabular-nums"
            style="color: #6ee7b7; text-shadow: 0 0 10px rgba(110,231,183,0.4);"
          >
            {fmt(freeroll.prize_usd)}
          </span>
          <span class="text-[9px] uppercase tracking-wider text-emerald-300/70 font-bold"
            >prize</span
          >
          <span class="text-white/30 text-[10px]">·</span>
          <span class="text-[10px] text-white/70 tabular-nums font-bold">
            {freeroll.registered}
          </span>
          <span class="text-[9px] uppercase tracking-wider text-white/40 font-bold">joined</span>
        </div>
      </div>
    </div>

    <div
      class="mt-3 pt-3 flex items-center justify-between"
      style="border-top: 1px solid rgba(244,201,93,0.25);"
    >
      <div>
        <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold">
          {isLive ? 'Status' : 'Starts in'}
        </p>
        <p class="text-[13px] font-extrabold tabular-nums" style="color: #f4c95d;">
          {isLive ? 'Running' : countdown}
        </p>
      </div>

      {#if eligibility && !eligibility.eligible}
        <div class="text-right">
          <div class="flex items-center gap-1 justify-end">
            <Icon name="lock" size={10} color="#fcd34d" />
            <p class="text-[9px] uppercase tracking-wider text-amber-300 font-bold">
              Deposit {fmt(eligibility.minRequired)}+ to join
            </p>
          </div>
          <p class="text-[9px] text-white/50">
            You: {fmt(eligibility.lifetimeDepositUsd)}
          </p>
        </div>
      {:else}
        <div
          class="rounded-full px-3 py-1.5 text-[10px] font-extrabold"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
        >
          {isLive ? 'PLAY →' : 'REGISTER →'}
        </div>
      {/if}
    </div>
  </button>
{/if}
