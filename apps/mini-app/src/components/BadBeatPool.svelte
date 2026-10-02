<script lang="ts">
  import { fmtAmount } from '../lib/table-geometry';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';

  let pool = 0;
  let totalPaid = 0;
  let lastPayout: any = null;
  let loading = true;

  function fmt(n: any): string {
    return fmtAmount(Number(n || 0));
  }

  function shortName(name: string): string {
    const s = String(name || 'Player');
    return s.length > 14 ? `${s.slice(0, 13)}…` : s;
  }

  async function load() {
    try {
      const res = await api.request<any>('/api/bad-beat/pool');
      if (res.ok && res.data) {
        pool = Number(res.data.pool || 0);
        totalPaid = Number(res.data.totalPaid || 0);
        lastPayout = res.data.lastPayout ?? null;
      }
    } catch {
      // silent - the card simply stays hidden while the API is unavailable
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  });
</script>

{#if !loading}
  <div class="px-4 mb-4">
    <div
      class="w-full rounded-2xl p-4 text-left relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(239,68,68,0.18) 0%, transparent 55%),
          radial-gradient(ellipse at 0% 100%, rgba(244,201,93,0.12) 0%, transparent 60%),
          linear-gradient(135deg, #142d52 0%, #1a1240 60%, #05080f 100%);
        border: 1.5px solid rgba(244,201,93,0.4);
        box-shadow: 0 8px 28px rgba(0,0,0,0.55), 0 0 24px rgba(244,201,93,0.12);
      "
    >
      <div
        class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 pointer-events-none"
        style="background: radial-gradient(circle, #ef4444, transparent 70%);"
      ></div>

      <div class="relative flex items-center gap-3 mb-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: linear-gradient(180deg, rgba(239,68,68,0.35), rgba(239,68,68,0.08));
            border: 1px solid rgba(239,68,68,0.5);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
          "
        >
          <Icon name="fire" size={20} color="#fca5a5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[9px] uppercase tracking-[0.3em] font-extrabold" style="color: #f4c95d;">
            BAD BEAT JACKPOT
          </p>
          <p class="text-[10px] text-white/50 font-bold mt-0.5">
            Lose with quads or better and get paid
          </p>
        </div>
      </div>

      <div class="relative flex items-baseline gap-2">
        <span
          class="text-4xl font-extrabold tabular-nums leading-none"
          style="
            background: linear-gradient(180deg, #f4e5a8, #f4c95d 45%, #a87a15);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.03em;
          "
        >
          {fmt(pool)}
        </span>
        <span class="text-[10px] uppercase tracking-wider text-white/40 font-bold">
          in the pool
        </span>
      </div>

      <div
        class="relative mt-3 pt-3 flex items-center justify-between gap-3"
        style="border-top: 1px solid rgba(244,201,93,0.2);"
      >
        <div class="min-w-0">
          <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold">Last payout</p>
          {#if lastPayout}
            <p class="text-[11px] font-extrabold text-white truncate">
              {fmt(lastPayout.amountUsd)}
              <span class="text-white/40 font-bold">
                · {shortName(lastPayout.displayName)}
              </span>
            </p>
          {:else}
            <p class="text-[11px] font-bold text-white/50">No payouts yet</p>
          {/if}
        </div>

        <div class="text-right shrink-0">
          <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold">Paid all time</p>
          <p class="text-[11px] font-extrabold tabular-nums" style="color: #6ee7b7;">
            {fmt(totalPaid)}
          </p>
        </div>
      </div>
    </div>
  </div>
{/if}
