<script lang="ts">
  import { fmtAmount } from '../lib/table-geometry';
  import { formatAmount } from '../lib/format';
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
        success = 'Purchased — chips, XP and voucher added to your account.';
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

  // ─── Summary (derived from the loaded pack list only) ───
  $: totalChips = packs.reduce((sum: number, p: ShopPack) => sum + Number(p.chips || 0), 0);
  $: bestPack = packs.reduce(
    (best: ShopPack | null, p: ShopPack) => (!best || p.chips > best.chips ? p : best),
    null,
  );
  $: startingPrice = packs.length
    ? Math.min(...packs.map((p: ShopPack) => p.priceUsdDiscounted ?? p.priceUsd))
    : 0;
  $: discPct = Math.round(discountPct * 100);
  $: totalXp = packs.reduce((sum: number, p: ShopPack) => sum + Number(p.xp || 0), 0);
  $: voucherPacks = packs.filter((p: ShopPack) => Number(p.voucher) > 0).length;
  $: packIcon = (id: string): string => {
    if (id === 'starter') return 'gift';
    if (id === 'value') return 'dollar';
    if (id === 'premium') return 'gem';
    if (id === 'mega') return 'crown';
    if (id === 'ultra') return 'zap';
    return 'star';
  };
</script>

<div class="pb-28">
  <TopBar />

  <!-- HERO -->
  <div class="px-4 mt-2 mb-4">
    <div
      class="rounded-3xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.22) 0%, transparent 60%),
          radial-gradient(ellipse at 0% 100%, rgba(34,211,238,0.12) 0%, transparent 60%),
          linear-gradient(135deg, rgba(20,45,82,0.9) 0%, rgba(15,31,58,0.9) 55%, rgba(7,14,27,0.98) 100%);
        border: 1.5px solid rgba(244,201,93,0.4);
        box-shadow: 0 10px 32px rgba(0,0,0,0.6), 0 0 28px rgba(244,201,93,0.12);
      "
    >
      <div
        class="absolute -top-14 -right-14 w-44 h-44 rounded-full opacity-20 pointer-events-none"
        style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
      ></div>

      <div class="relative flex items-center gap-3">
        <button
          on:click={onBack}
          aria-label="Back"
          class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(11,19,36,0.95));
            border: 1px solid rgba(96,165,250,0.35);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          "
        >
          <Icon name="arrow-left" size={18} color="#93c5fd" />
        </button>

        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
            border: 1.5px solid rgba(244,201,93,0.55);
            box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
          "
        >
          <Icon name="cart" size={24} color="#f4c95d" />
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
            Shop
          </h1>
          <p class="text-[11px] text-white/50 mt-1 font-bold truncate">
            Level {level} · Chips, XP and vouchers in one tap
          </p>
        </div>

        {#if discPct > 0}
          <span
            class="text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
            style="background: linear-gradient(180deg, #f4e5a8, #d4af37); color: #0a0800;"
          >
            -{discPct}% OFF
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- SUMMARY GRID -->
  <div class="grid grid-cols-2 gap-2 px-4 mb-4">
    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="coin" size={12} color="#6ee7b7" />
        </div>
        <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">
          Chips on offer
        </span>
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        {fmtChips(totalChips)}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {packs.length}
        {packs.length === 1 ? 'pack' : 'packs'} available
      </p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(37,99,235,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(37,99,235,0.2); border: 1px solid rgba(37,99,235,0.4);"
        >
          <Icon name="star" size={12} color="#93c5fd" />
        </div>
        <span class="text-[9px] font-extrabold text-blue-300 uppercase tracking-wider"
          >Bonus XP</span
        >
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        {totalXp.toLocaleString()}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {voucherPacks} pack{voucherPacks === 1 ? '' : 's'} with vouchers
      </p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(34,211,238,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.4);"
        >
          <Icon name="zap" size={12} color="#22d3ee" />
        </div>
        <span class="text-[9px] font-extrabold text-cyan-300 uppercase tracking-wider">
          Best value
        </span>
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none truncate">
        {bestPack ? `${fmtChips(bestPack.chips)}` : '—'}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold truncate">
        {bestPack
          ? `${bestPack.name} · $${fmtAmount(bestPack.priceUsdDiscounted ?? bestPack.priceUsd)}`
          : 'no packs'}
      </p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(244,201,93,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.4);"
        >
          <Icon name="dollar" size={12} color="#f4c95d" />
        </div>
        <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider">From</span>
      </div>
      <p class="text-[17px] font-extrabold text-gold tabular-nums leading-none">
        ${formatAmount(startingPrice)}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {discPct > 0 ? `${discPct}% level discount active` : 'Discount unlocks from L10'}
      </p>
    </div>
  </div>

  <!-- Info bar -->
  <div
    class="mx-4 rounded-2xl p-3 mb-4 flex items-center gap-2"
    style="background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3);"
  >
    <Icon name="info" size={16} color="#93c5fd" />
    <p class="text-[10px] text-white/70 flex-1">
      Every pack delivers chips instantly, plus XP and a rake-based voucher.
    </p>
  </div>

  <!-- PACKS HEADER -->
  {#if !loading}
    <div class="flex items-center gap-2 mb-2 px-4">
      <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
      <p class="text-[10px] font-extrabold text-white/60 uppercase tracking-widest">Chip packs</p>
      <span class="ml-auto text-[10px] font-mono text-white/40 tabular-nums">
        {packs.length} option{packs.length === 1 ? '' : 's'}
      </span>
    </div>
  {/if}

  {#if loading}
    <div class="space-y-3 px-4">
      {#each Array(3) as _}
        <div
          class="rounded-3xl h-[124px] shimmer"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if packs.length === 0}
    <div class="px-4">
      <div
        class="rounded-3xl p-8 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center"
            style="
              background: linear-gradient(180deg, rgba(244,201,93,0.18), rgba(168,121,34,0.06));
              border: 1px solid rgba(244,201,93,0.35);
            "
          >
            <Icon name="cart" size={30} color="rgba(244,201,93,0.65)" />
          </div>
        </div>
        <p class="text-sm font-extrabold text-white">No packs available</p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">
          The store restocks soon — check back later
        </p>
      </div>
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
          <div
            class="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-20 pointer-events-none"
            style="background: radial-gradient(circle, #d4af37, transparent 70%);"
          ></div>

          <div class="relative flex items-center gap-3">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style="background: radial-gradient(circle, rgba(212,175,55,0.3), transparent 70%); border: 1.5px solid rgba(212,175,55,0.5);"
            >
              <Icon name={packIcon(p.id)} size={28} color="#f4c95d" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-extrabold text-white leading-tight mb-0.5">{p.name}</p>
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-[13px] font-extrabold text-gold tabular-nums"
                  >${formatAmount(disc)}</span
                >
                {#if p.priceUsdDiscounted && p.priceUsdDiscounted < p.priceUsd}
                  <span class="text-[10px] text-white/40 line-through tabular-nums"
                    >${fmtAmount(p.priceUsd)}</span
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
                  style="background: rgba(37,99,235,0.2); color: #93c5fd;"
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
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style="background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.3);"
            >
              <Icon name="arrow-right" size={14} color="#f4c95d" />
            </div>
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
        ${fmtAmount(currentDiscountedPrice)}
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
        <span class="text-white/50">XP</span><span class="text-blue-300 font-extrabold tabular-nums"
          >+{selected.xp.toLocaleString()}</span
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
            >${formatAmount(selected.voucher * 2.5)}</span
          >
        </div>
      {/if}
    </div>

    {#if success}
      <div
        class="rounded-xl p-3 flex items-center justify-center gap-2"
        style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.5);"
      >
        <Icon name="success" size={16} color="#6ee7b7" />
        <p class="text-[12px] font-extrabold text-emerald-300">{success}</p>
      </div>
    {:else}
      <div class="flex gap-2">
        <button
          on:click={closeModal}
          aria-label="Close"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/60"
          style="background: rgba(255,255,255,0.06);"
          ><Icon name="close" size={14} color="#ffffff" /></button
        >
        <button
          on:click={buy}
          disabled={busy}
          class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95 disabled:opacity-40"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a;"
          >{busy ? 'Processing…' : 'Confirm Purchase'}</button
        >
      </div>
      {#if error}
        <div class="flex items-center justify-center gap-1.5 mt-3">
          <Icon name="warning" size={13} color="#fca5a5" />
          <p class="text-[11px] text-red-300 text-center">{error}</p>
        </div>
      {/if}
      <p class="text-[9px] text-white/40 text-center mt-3 leading-relaxed">
        In dev mode purchases confirm instantly.<br />In production TON Connect and tx_hash
        verification are enabled.
      </p>
    {/if}
  </div>
{/if}
