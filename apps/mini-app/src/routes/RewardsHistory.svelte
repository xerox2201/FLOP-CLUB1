<script lang="ts">
  import { formatAmount, formatUSD } from '../lib/format';
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
    return formatUSD(n);
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

  // ─── Summary (derived from loaded data only) ───
  let xpEarned = 0;
  let xpSpent = 0;
  let spentTotal = 0;
  $: {
    xpEarned = xpTx.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    xpSpent = xpTx
      .filter((t) => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    spentTotal = purchases.reduce((s, p) => s + Number(p.usd_amount || 0), 0);
  }

  const TABS: { k: Tab; l: string }[] = [
    { k: 'xp', l: 'XP' },
    { k: 'rakeback', l: 'Rakeback' },
    { k: 'purchases', l: 'Purchases' },
  ];
</script>

<div class="pb-28">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="px-4 mt-3 mb-4">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        aria-label="Back"
        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition"
        style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
      >
        <Icon name="arrow-left" size={18} color="#93c5fd" />
      </button>

      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
          border: 1.5px solid rgba(244,201,93,0.55);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
        "
      >
        <Icon name="receipt" size={24} color="#f4c95d" />
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
          Rewards History
        </h1>
        <p class="text-[11px] text-white/45 mt-1 font-bold">XP, rakeback and shop purchases</p>
      </div>
    </div>
  </div>

  <!-- ============ SUMMARY ============ -->
  <div class="grid grid-cols-3 gap-2 px-4 mb-4">
    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(37,99,235,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(37,99,235,0.2); border: 1px solid rgba(37,99,235,0.4);"
        >
          <Icon name="star" size={12} color="#93c5fd" />
        </div>
        <span class="text-[8px] font-extrabold text-blue-300 uppercase tracking-wider">
          XP In
        </span>
      </div>
      {#if loading}
        <div class="h-4 w-12 rounded-md" style="background: rgba(255,255,255,0.08);"></div>
      {:else}
        <p class="text-[16px] font-extrabold text-blue-300 tabular-nums leading-none">
          {fmtAmount(xpEarned)}
        </p>
      {/if}
    </div>

    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(245,158,11,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(245,158,11,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4);"
        >
          <Icon name="zap" size={12} color="#fcd34d" />
        </div>
        <span class="text-[8px] font-extrabold text-amber-300 uppercase tracking-wider">
          XP Out
        </span>
      </div>
      {#if loading}
        <div class="h-4 w-12 rounded-md" style="background: rgba(255,255,255,0.08);"></div>
      {:else}
        <p class="text-[16px] font-extrabold text-amber-300 tabular-nums leading-none">
          {fmtAmount(-xpSpent)}
        </p>
      {/if}
    </div>

    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="cart" size={12} color="#6ee7b7" />
        </div>
        <span class="text-[8px] font-extrabold text-emerald-300 uppercase tracking-wider">
          Spent
        </span>
      </div>
      {#if loading}
        <div class="h-4 w-12 rounded-md" style="background: rgba(255,255,255,0.08);"></div>
      {:else}
        <p class="text-[16px] font-extrabold text-emerald-400 tabular-nums leading-none">
          {fmt(spentTotal)}
        </p>
      {/if}
    </div>
  </div>

  <!-- ============ TABS ============ -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each TABS as t}
      <button
        on:click={() => (tab = t.k)}
        class="shrink-0 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95"
        style="background: {tab === t.k
          ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
          : 'rgba(15,31,58,0.7)'}; color: {tab === t.k
          ? '#0a0800'
          : 'rgba(255,255,255,0.65)'}; border: 1px solid {tab === t.k
          ? 'transparent'
          : 'rgba(212,175,55,0.2)'}; box-shadow: {tab === t.k
          ? '0 2px 0 #7a560a, 0 6px 18px rgba(212,175,55,0.35)'
          : 'none'};">{t.l}</button
      >
    {/each}
  </div>

  {#if loading}
    <!-- ============ LOADING SKELETON ============ -->
    <div class="space-y-2 px-4">
      {#each Array(4) as _}
        <div
          class="rounded-2xl h-[62px]"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
        ></div>
      {/each}
    </div>
  {:else if tab === 'xp'}
    {#if xpTx.length === 0}
      <div class="px-4">
        <div
          class="rounded-2xl p-6 text-center relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.12) 0%, transparent 60%),
              linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px dashed rgba(37,99,235,0.35);
          "
        >
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style="
              background: linear-gradient(180deg, rgba(37,99,235,0.25), rgba(109,40,217,0.1));
              border: 1px solid rgba(37,99,235,0.45);
            "
          >
            <Icon name="star" size={22} color="#93c5fd" />
          </div>
          <p class="text-sm font-extrabold text-white">No XP transactions yet</p>
          <p class="text-[11px] text-white/55 mt-1 font-bold">
            Play hands and claim bonuses to start earning XP
          </p>
        </div>
      </div>
    {:else}
      <div class="space-y-2 px-4">
        {#each xpTx as tx}
          {@const isEarn = tx.amount > 0}
          <div
            class="rounded-2xl p-3 flex items-center gap-3 relative overflow-hidden"
            style="
              background:
                radial-gradient(ellipse at 0% 50%, {isEarn
              ? 'rgba(37,99,235,0.12)'
              : 'rgba(245,158,11,0.12)'} 0%, transparent 60%),
                linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
              border: 1px solid {isEarn ? 'rgba(37,99,235,0.3)' : 'rgba(245,158,11,0.3)'};
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            "
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style="
                background: {isEarn ? 'rgba(37,99,235,0.2)' : 'rgba(245,158,11,0.2)'};
                border: 1px solid {isEarn ? 'rgba(37,99,235,0.45)' : 'rgba(245,158,11,0.45)'};
              "
            >
              <Icon
                name={isEarn ? 'trending-up' : 'trending-down'}
                size={16}
                color={isEarn ? '#93c5fd' : '#fcd34d'}
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-extrabold text-white/90 capitalize truncate leading-tight">
                {tx.source}
              </p>
              <p class="text-[9px] text-white/40 mt-0.5 font-bold truncate">
                {fmtDate(tx.created_at)}
              </p>
            </div>
            <p
              class="text-[13px] font-extrabold tabular-nums shrink-0 leading-none"
              style="color: {isEarn ? '#60a5fa' : '#fcd34d'};"
            >
              {fmtAmount(tx.amount)} XP
            </p>
          </div>
        {/each}
      </div>
    {/if}
  {:else if tab === 'rakeback'}
    <div class="px-4">
      <div
        class="rounded-2xl p-6 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(244,201,93,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(244,201,93,0.35);
        "
      >
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style="
            background: linear-gradient(180deg, rgba(244,201,93,0.22), rgba(168,121,34,0.1));
            border: 1px solid rgba(244,201,93,0.4);
          "
        >
          <Icon name="gift" size={22} color="#f4c95d" />
        </div>
        <p class="text-sm font-extrabold text-white">Rakeback history</p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">coming soon (per-hand log)</p>
      </div>
    </div>
  {:else if purchases.length === 0}
    <div class="px-4">
      <div
        class="rounded-2xl p-6 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(34,211,238,0.35);
        "
      >
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style="
            background: linear-gradient(180deg, rgba(34,211,238,0.22), rgba(14,116,144,0.1));
            border: 1px solid rgba(34,211,238,0.4);
          "
        >
          <Icon name="cart" size={22} color="#22d3ee" />
        </div>
        <p class="text-sm font-extrabold text-white">No purchases yet</p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">
          Chip packs and cosmetics you buy will appear here
        </p>
      </div>
    </div>
  {:else}
    <div class="space-y-2 px-4">
      {#each purchases as p}
        <div
          class="rounded-2xl p-3.5 relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 0% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
              linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1px solid rgba(212,175,55,0.3);
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          "
        >
          <div class="flex items-center gap-3 mb-2.5">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style="
                background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.3), rgba(168,121,34,0.1));
                border: 1px solid rgba(244,201,93,0.5);
              "
            >
              <Icon name="cart" size={16} color="#f4c95d" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-extrabold text-white capitalize truncate leading-tight">
                {p.pack_id}
              </p>
              <p class="text-[9px] text-white/40 mt-0.5 font-bold truncate">
                {fmtDate(p.created_at)}
              </p>
            </div>
            <p class="text-[14px] font-extrabold text-gold tabular-nums shrink-0 leading-none">
              ${formatAmount(p.usd_amount)}
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
                style="background: rgba(37,99,235,0.2); color: #93c5fd;"
                >+{Number(p.xp_awarded).toLocaleString()} XP</span
              >{/if}
            {#if Number(p.voucher_amount) > 0}<span
                class="px-1.5 py-0.5 rounded-full"
                style="background: rgba(244,201,93,0.2); color: #f4c95d;"
                >Voucher ${formatAmount(p.voucher_amount)}</span
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
