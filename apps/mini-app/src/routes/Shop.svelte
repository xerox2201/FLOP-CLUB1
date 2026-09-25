<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import TopBar from '../components/TopBar.svelte';
  import { FALLBACK_PACKS, type ShopPack } from '../lib/shop-packs';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  let packs: ShopPack[] = FALLBACK_PACKS;
  let level = 1;
  let discountPct = 0;
  let loading = true;
  let selected: ShopPack | null = null;
  let busy = false;
  let error = '';
  let success = '';

  async function load() {
    loading = true;
    try {
      const res = await api.request<{ level: number; discountPct: number; packs: ShopPack[] }>(
        '/api/shop/packs',
      );
      if (res.ok && res.data) {
        packs = res.data.packs;
        level = res.data.level;
        discountPct = res.data.discountPct;
      }
    } catch {
      // silent — fall back to FALLBACK_PACKS
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function openPack(p: ShopPack) {
    selected = p;
    error = '';
    success = '';
  }

  function closeModal() {
    selected = null;
    busy = false;
    error = '';
    success = '';
  }

  async function buy() {
    if (!selected || busy) return;
    busy = true;
    error = '';
    try {
      const res = await api.request<{ ok: boolean }>('/api/shop/purchase', {
        method: 'POST',
        body: JSON.stringify({ packId: selected.id }),
      });
      if (res.ok) {
        success = '✅ Purchased! Chips, XP, and Voucher added.';
        await auth.refresh();
        setTimeout(() => closeModal(), 2000);
      } else {
        error = res.error || 'purchase_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      busy = false;
    }
  }

  function fmtChips(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toLocaleString();
  }

  $: currentDiscountedPrice = selected ? (selected.priceUsdDiscounted ?? selected.priceUsd) : 0;
  $: currentTonPrice = selected ? (selected.priceTonDiscounted ?? selected.priceTon) : 0;
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
      <Icon name="cart" size={22} />
      <span>Shop</span>
    </h1>
    {#if discountPct > 0}
      <span
        class="text-[10px] font-extrabold px-2.5 py-1 rounded-full"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37); color: #0a0800;"
      >
        -{Math.round(discountPct * 100)}% OFF
      </span>
    {/if}
  </div>

  <!-- Info bar -->
  <div
    class="mx-4 rounded-2xl p-3 mb-4 flex items-center gap-2"
    style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);"
  >
    <Icon name="info" size={16} />
    <p class="text-[10px] text-white/70 flex-1">Level {level} · Discount از L10 شروع می‌شه</p>
  </div>

  {#if loading}
    <div class="space-y-3 px-4">
      {#each Array(3) as _}
        <div
          class="rounded-2xl h-[140px]"
          style="background: rgba(15,31,58,0.6); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else}
    <div class="space-y-3 px-4">
      {#each packs as p}
        {@const disc = p.priceUsdDiscounted ?? p.priceUsd}
        <button
          on:click={() => openPack(p)}
          class="w-full rounded-3xl p-4 text-left active:scale-[0.98] transition relative overflow-hidden"
          style="background: linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.98)); border: 1.5px solid rgba(212,175,55,0.35); box-shadow: 0 8px 24px rgba(0,0,0,0.5);"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style="background: radial-gradient(circle, rgba(212,175,55,0.3), transparent 70%); border: 1.5px solid rgba(212,175,55,0.5);"
            >
              <Icon
                name={p.id === 'starter'
                  ? 'gift'
                  : p.id === 'value'
                    ? 'dollar'
                    : p.id === 'premium'
                      ? 'gem'
                      : p.id === 'mega'
                        ? 'crown'
                        : p.id === 'ultra'
                          ? 'zap'
                          : 'star'}
                size={28}
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-extrabold text-white leading-tight mb-0.5">{p.name}</p>
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-[13px] font-extrabold text-gold tabular-nums"
                  >${disc.toFixed(2)}</span
                >
                {#if p.priceUsdDiscounted && p.priceUsdDiscounted < p.priceUsd}
                  <span class="text-[10px] text-white/40 line-through tabular-nums"
                    >${p.priceUsd.toFixed(2)}</span
                  >
                {/if}
                <span class="text-[10px] text-cyan-300 font-mono tabular-nums"
                  >{p.priceTonDiscounted ?? p.priceTon} TON</span
                >
              </div>
              <div class="flex flex-wrap gap-1.5 text-[9px] font-bold">
                <span
                  class="px-1.5 py-0.5 rounded-full"
                  style="background: rgba(16,185,129,0.2); color: #6ee7b7;"
                  >{fmtChips(p.chips)} chips</span
                >
                <span
                  class="px-1.5 py-0.5 rounded-full"
                  style="background: rgba(139,92,246,0.2); color: #c4b5fd;"
                  >+{p.xp.toLocaleString()} XP</span
                >
                {#if p.voucher > 0}
                  <span
                    class="px-1.5 py-0.5 rounded-full"
                    style="background: rgba(244,201,93,0.2); color: #f4c95d;"
                    >Voucher ${p.voucher}</span
                  >
                {/if}
              </div>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d4af37"
              stroke-width="3"
              stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg
            >
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- Purchase Modal -->
{#if selected}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);"
    on:click={closeModal}
  ></button>
  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] rounded-3xl p-5 w-[90%] max-w-[380px]"
    style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1.5px solid rgba(212,175,55,0.5); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <div class="text-center mb-4">
      <div class="flex justify-center mb-2">
        <Icon name="gem" size={48} />
      </div>
      <h2 class="text-lg font-extrabold text-white">{selected.name}</h2>
      <p class="text-3xl font-extrabold text-gold tabular-nums mt-2">
        ${currentDiscountedPrice.toFixed(2)}
      </p>
      <p class="text-[10px] text-cyan-300 font-mono mt-1">{currentTonPrice} TON</p>
    </div>

    <div
      class="rounded-2xl p-3 mb-4 space-y-1.5"
      style="background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.3);"
    >
      <div class="flex justify-between text-[11px]">
        <span class="text-white/50">Chips</span><span
          class="text-emerald-400 font-extrabold tabular-nums"
          >+{selected.chips.toLocaleString()}</span
        >
      </div>
      <div class="flex justify-between text-[11px]">
        <span class="text-white/50">XP</span><span
          class="text-violet-300 font-extrabold tabular-nums">+{selected.xp.toLocaleString()}</span
        >
      </div>
      {#if selected.voucher > 0}
        <div class="flex justify-between text-[11px]">
          <span class="text-white/50">Voucher</span><span
            class="text-gold font-extrabold tabular-nums">${selected.voucher}</span
          >
        </div>
        <div class="flex justify-between text-[11px]">
          <span class="text-white/50">Need rake</span><span
            class="text-amber-300 font-extrabold tabular-nums"
            >${(selected.voucher * 2.5).toFixed(2)}</span
          >
        </div>
      {/if}
    </div>

    {#if success}
      <div
        class="rounded-xl p-3 text-center"
        style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.5);"
      >
        <p class="text-[12px] font-extrabold text-emerald-300">{success}</p>
      </div>
    {:else}
      <div class="flex gap-2">
        <button
          on:click={closeModal}
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/60"
          style="background: rgba(255,255,255,0.06);"><Icon name="close" size={14} /></button
        >
        <button
          on:click={buy}
          disabled={busy}
          class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95 disabled:opacity-40"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a;"
          >{busy ? 'Processing…' : 'Confirm Purchase'}</button
        >
      </div>
      {#if error}<p class="text-[11px] text-red-300 text-center mt-3">{error}</p>{/if}
      <p class="text-[9px] text-white/40 text-center mt-3 leading-relaxed">
        در حالت dev، خرید مستقیم تأیید می‌شه.<br />در production، TON Connect و تأیید tx_hash اضافه
        می‌شه.
      </p>
    {/if}
  </div>
{/if}
