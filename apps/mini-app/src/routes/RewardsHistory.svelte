<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  type Tab = 'xp' | 'rakeback' | 'purchases';
  let tab: Tab = 'xp';
  let loading = true;

  let xpTx: any[] = [];
  let rakeback: any[] = [];
  let purchases: any[] = [];

  async function load() {
    loading = true;
    try {
      const [x, p] = await Promise.all([
        api.request<{ transactions: any[] }>('/api/xp/history'),
        api.request<{ purchases: any[] }>('/api/shop/purchases'),
      ]);
      if (x.ok && x.data) xpTx = (x.data as any).transactions ?? [];
      if (p.ok && p.data) purchases = (p.data as any).purchases ?? [];
      // rakeback is not exposed separately — leave empty for now
    } catch {
      /* silent — API errors are non-fatal here */
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function fmt(n: any): string {
    return `$${Number(n || 0).toFixed(2)}`;
  }
  function fmtDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
  function fmtAmount(n: number, unit = ''): string {
    const sign = n > 0 ? '+' : '';
    return `${sign}${Number(n).toLocaleString()}${unit}`;
  }
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
      <Icon name="receipt" size={22} />
      <span>Rewards History</span>
    </h1>
  </div>

  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each [{ k: 'xp', l: 'XP' }, { k: 'rakeback', l: 'Rakeback' }, { k: 'purchases', l: 'Purchases' }] as t}
      <button
        on:click={() => (tab = t.k as Tab)}
        class="shrink-0 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95"
        style="background: {tab === t.k
          ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
          : 'rgba(15,31,58,0.7)'}; color: {tab === t.k
          ? '#0a0800'
          : 'rgba(255,255,255,0.65)'}; border: 1px solid {tab === t.k
          ? 'transparent'
          : 'rgba(212,175,55,0.2)'};">{t.l}</button
      >
    {/each}
  </div>

  {#if loading}
    <p class="text-center py-8 text-white/40 text-sm">Loading…</p>
  {:else if tab === 'xp'}
    {#if xpTx.length === 0}
      <div
        class="mx-4 rounded-2xl p-8 text-center"
        style="background: rgba(15,31,58,0.6); border: 1px solid rgba(212,175,55,0.15);"
      >
        <div class="flex justify-center mb-2">
          <Icon name="star" size={32} />
        </div>
        <p class="text-white/50 text-sm">No XP transactions yet</p>
      </div>
    {:else}
      <div class="space-y-2 px-4">
        {#each xpTx as tx}
          {@const isEarn = tx.amount > 0}
          <div
            class="rounded-2xl p-3 flex items-center justify-between"
            style="background: rgba(15,31,58,0.7); border: 1px solid {isEarn
              ? 'rgba(139,92,246,0.3)'
              : 'rgba(245,158,11,0.3)'};"
          >
            <div>
              <p class="text-[11px] font-extrabold text-white/90 capitalize">{tx.source}</p>
              <p class="text-[9px] text-white/40 mt-0.5">{fmtDate(tx.created_at)}</p>
            </div>
            <p
              class="text-[13px] font-extrabold tabular-nums"
              style="color: {isEarn ? '#a78bfa' : '#fcd34d'};"
            >
              {fmtAmount(tx.amount)} XP
            </p>
          </div>
        {/each}
      </div>
    {/if}
  {:else if tab === 'rakeback'}
    <div
      class="mx-4 rounded-2xl p-8 text-center"
      style="background: rgba(15,31,58,0.6); border: 1px solid rgba(212,175,55,0.15);"
    >
      <div class="flex justify-center mb-2">
        <Icon name="gift" size={32} />
      </div>
      <p class="text-white/50 text-sm">Rakeback history</p>
      <p class="text-white/30 text-[11px] mt-1">coming soon (per-hand log)</p>
    </div>
  {:else if purchases.length === 0}
    <div
      class="mx-4 rounded-2xl p-8 text-center"
      style="background: rgba(15,31,58,0.6); border: 1px solid rgba(212,175,55,0.15);"
    >
      <div class="flex justify-center mb-2">
        <Icon name="cart" size={32} />
      </div>
      <p class="text-white/50 text-sm">No purchases yet</p>
    </div>
  {:else}
    <div class="space-y-2 px-4">
      {#each purchases as p}
        <div
          class="rounded-2xl p-3"
          style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.3);"
        >
          <div class="flex justify-between items-start mb-2">
            <div>
              <p class="text-[12px] font-extrabold text-white capitalize">{p.pack_id}</p>
              <p class="text-[9px] text-white/40 mt-0.5">{fmtDate(p.created_at)}</p>
            </div>
            <p class="text-[13px] font-extrabold text-gold tabular-nums">
              ${Number(p.usd_amount).toFixed(2)}
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5 text-[9px] font-bold">
            <span
              class="px-1.5 py-0.5 rounded-full"
              style="background: rgba(16,185,129,0.2); color: #6ee7b7;"
              >+{Number(p.chips_awarded).toLocaleString()} chips</span
            >
            {#if p.xp_awarded > 0}<span
                class="px-1.5 py-0.5 rounded-full"
                style="background: rgba(139,92,246,0.2); color: #c4b5fd;"
                >+{Number(p.xp_awarded).toLocaleString()} XP</span
              >{/if}
            {#if Number(p.voucher_amount) > 0}<span
                class="px-1.5 py-0.5 rounded-full"
                style="background: rgba(244,201,93,0.2); color: #f4c95d;"
                >Voucher ${Number(p.voucher_amount).toFixed(2)}</span
              >{/if}
            <span
              class="px-1.5 py-0.5 rounded-full"
              style="background: rgba(16,185,129,0.15); color: #6ee7b7;">{p.status}</span
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
