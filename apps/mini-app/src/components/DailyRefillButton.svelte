<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';

  let status: any = null;
  let busy = false;
  let toast = '';

  async function load() {
    try {
      const res = await api.request('/api/daily-refill/status');
      if (res.ok) status = res.data;
    } catch {}
  }

  async function claim() {
    if (busy) return;
    busy = true;
    try {
      const res = await api.request<{ ok: boolean; amount: number }>(
        '/api/daily-refill/claim',
        { method: 'POST', body: '{}' },
      );
      if (res.ok && res.data) {
        toast = `+${(res.data as any).amount.toLocaleString()} chips!`;
        await auth.refresh();
        await load();
        setTimeout(() => (toast = ''), 2500);
      }
    } finally { busy = false; }
  }

  onMount(load);
</script>

{#if status}
  <button
    on:click={claim}
    disabled={!status.canClaim || busy}
    class="w-full rounded-2xl p-3 active:scale-[0.98] transition disabled:opacity-60"
    style="background: {status.canClaim ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(5,150,105,0.1))' : 'rgba(15,31,58,0.6)'}; border: 1.5px solid {status.canClaim ? 'rgba(34,197,94,0.5)' : 'rgba(212,175,55,0.15)'};"
  >
    <div class="flex items-center gap-2.5">
      <span class="text-2xl">{status.tierIcon}</span>
      <div class="flex-1 text-left">
        <p class="text-[10px] font-extrabold uppercase tracking-wider" style="color: {status.canClaim ? '#6ee7b7' : 'rgba(255,255,255,0.5)'};">
          {status.canClaim ? 'Daily Refill · Ready!' : 'Daily Refill · Claimed'}
        </p>
        <p class="text-[14px] font-extrabold text-white tabular-nums">
          +{status.refillAmount.toLocaleString()} chips
        </p>
        <p class="text-[9px] text-white/40 mt-0.5">{status.tierLabel} Tier</p>
      </div>
      {#if status.canClaim}
        <span class="text-[11px] font-extrabold px-3 py-2 rounded-xl" style="background: linear-gradient(180deg, #22c55e, #15803d); color: white;">Claim</span>
      {/if}
    </div>
    {#if toast}
      <p class="text-[11px] text-emerald-300 font-bold text-center mt-2">{toast}</p>
    {/if}
  </button>
{/if}