<script lang="ts">
  import { formatUSD } from '../lib/format';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  let loading = true;
  let error = '';
  let milestones: any[] = [];
  let claiming: string | null = null;
  let toast = '';

  function flash(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 2500);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<{ milestones: any[] }>('/api/referral/milestones');
      if (res.ok && res.data) milestones = res.data.milestones;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function claim(code: string) {
    if (claiming) return;
    claiming = code;
    try {
      const res = await api.request<{ ok: boolean; reward: any }>(
        `/api/referral/milestones/${code}/claim`,
        { method: 'POST', body: '{}' },
      );
      if (res.ok && res.data) {
        const r = res.data.reward;
        const parts: string[] = [];
        if (r.chips > 0) parts.push(`${r.chips.toLocaleString()} chips`);
        if (r.usd > 0) parts.push(`$${r.usd}`);
        if (r.xp > 0) parts.push(`${r.xp} XP`);
        flash(`Claimed: ${parts.join(' + ')}`);
        await load();
        await auth.refresh();
      } else {
        flash(`Failed: ${res.error || 'unknown'}`);
      }
    } catch (e: any) {
      flash(`Error: ${e.message}`);
    } finally {
      claiming = null;
    }
  }

  $: claimableCount = milestones.filter((m) => m.claimable).length;
  $: achievedCount = milestones.filter((m) => m.achieved).length;

  onMount(load);
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
      <Icon name="arrow-left" size={18} color="#ffffff" />
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1 flex items-center gap-2">
      <Icon name="target" size={22} color="#60a5fa" />
      <span>Milestones</span>
    </h1>
    {#if claimableCount > 0}
      <span
        class="text-[10px] font-extrabold px-2.5 py-1 rounded-full animate-pulse"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
      >
        {claimableCount} CLAIM
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="px-4 space-y-2">
      {#each Array(4) as _}
        <div class="rounded-2xl h-[100px]" style="background: rgba(15,31,58,0.6);"></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="mx-4 rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={load} class="mt-2 text-[11px] text-gold font-bold">Retry</button>
    </div>
  {:else}
    <!-- Summary -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(7,14,27,0.95)); border: 1px solid rgba(37,99,235,0.35);"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style="background: radial-gradient(circle at 30% 30%, rgba(37,99,235,0.4), rgba(37,99,235,0.1)); border: 1px solid rgba(37,99,235,0.5);"
          >
            <Icon name="target" size={22} color="#60a5fa" />
          </div>
          <div class="flex-1">
            <p class="text-[10px] uppercase tracking-widest font-extrabold text-blue-300">
              Progress
            </p>
            <p class="text-2xl font-extrabold text-white tabular-nums leading-none mt-1">
              {achievedCount}<span class="text-white/40 text-sm">/{milestones.length}</span>
            </p>
          </div>
          <div class="text-right">
            <p class="text-[9px] text-white/45 uppercase font-bold">Claimed</p>
            <p class="text-sm font-extrabold text-blue-300 tabular-nums">
              {milestones.filter((m) => m.claimed).length}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Milestones list -->
    <div class="px-4 space-y-2">
      {#each milestones as m}
        {@const pct = Math.min(100, (m.current / m.threshold) * 100)}
        <div
          class="rounded-2xl p-3.5 relative overflow-hidden"
          style="
            background: {m.claimed
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(7,14,27,0.9))'
            : m.claimable
              ? 'linear-gradient(135deg, rgba(244,201,93,0.15), rgba(7,14,27,0.9))'
              : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
            border: 1.5px solid {m.claimed
            ? 'rgba(16,185,129,0.4)'
            : m.claimable
              ? 'rgba(244,201,93,0.6)'
              : 'rgba(255,255,255,0.06)'};
            {m.claimable ? 'box-shadow: 0 0 20px rgba(244,201,93,0.25);' : ''}
          "
        >
          {#if m.claimable}
            <div
              class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-25 pointer-events-none"
              style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
            ></div>
          {/if}

          <div class="relative">
            <!-- Header -->
            <div class="flex items-start gap-3 mb-3">
              <div
                class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style="
                  background: {m.claimed
                  ? 'rgba(16,185,129,0.2)'
                  : m.claimable
                    ? 'radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15))'
                    : 'rgba(0,0,0,0.35)'};
                  border: 1.5px solid {m.claimed
                  ? 'rgba(16,185,129,0.5)'
                  : m.claimable
                    ? 'rgba(244,201,93,0.6)'
                    : 'rgba(255,255,255,0.1)'};
                "
              >
                {#if m.claimed}
                  <Icon name="check" size={20} color="#6ee7b7" />
                {:else if m.metric === 'active_refs'}
                  <Icon
                    name="users"
                    size={18}
                    color={m.claimable ? '#f4c95d' : 'rgba(255,255,255,0.4)'}
                  />
                {:else if m.metric === 'lifetime_earned'}
                  <Icon
                    name="dollar"
                    size={18}
                    color={m.claimable ? '#f4c95d' : 'rgba(255,255,255,0.4)'}
                  />
                {:else}
                  <Icon
                    name="target"
                    size={18}
                    color={m.claimable ? '#f4c95d' : 'rgba(255,255,255,0.4)'}
                  />
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-[13px] font-extrabold text-white truncate">{m.name}</p>
                  {#if m.claimed}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style="background: rgba(16,185,129,0.2); color: #6ee7b7;">CLAIMED</span
                    >
                  {:else if m.claimable}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse"
                      style="background: rgba(244,201,93,0.3); color: #f4e5a8;">CLAIMABLE</span
                    >
                  {/if}
                </div>
                <p class="text-[10px] text-white/50 mt-0.5 leading-snug">{m.description}</p>
              </div>
            </div>

            <!-- Progress -->
            <div class="mb-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] text-white/40 uppercase font-bold tracking-wider">
                  {m.metric === 'lifetime_earned' ? 'Earned' : 'Progress'}
                </span>
                <span
                  class="text-[9px] font-mono tabular-nums"
                  style="color: {m.achieved ? '#6ee7b7' : 'rgba(255,255,255,0.6)'};"
                >
                  {m.metric === 'lifetime_earned'
                    ? `${formatUSD(m.current)} / ${formatUSD(m.threshold)}`
                    : `${m.current} / ${m.threshold}`}
                </span>
              </div>
              <div
                class="w-full h-1.5 rounded-full overflow-hidden"
                style="background: rgba(0,0,0,0.5);"
              >
                <div
                  class="h-full rounded-full transition-all"
                  style="
                    width: {pct}%;
                    background: linear-gradient(90deg, {m.claimed
                    ? '#6ee7b7, #10b981'
                    : m.claimable
                      ? '#f4e5a8, #f4c95d'
                      : '#3b82f6, #60a5fa'});
                    box-shadow: 0 0 8px {m.claimed
                    ? 'rgba(16,185,129,0.5)'
                    : m.claimable
                      ? 'rgba(244,201,93,0.5)'
                      : 'rgba(59,130,246,0.4)'};
                  "
                ></div>
              </div>
            </div>

            <!-- Rewards + Claim -->
            <div
              class="flex items-center gap-2 pt-2"
              style="border-top: 1px solid rgba(255,255,255,0.06);"
            >
              <div class="flex flex-wrap gap-1.5 flex-1">
                {#if m.rewardChips > 0}
                  <span
                    class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style="background: rgba(16,185,129,0.15); color: #6ee7b7;"
                  >
                    +{m.rewardChips.toLocaleString()} chips
                  </span>
                {/if}
                {#if m.rewardUsd > 0}
                  <span
                    class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style="background: rgba(244,201,93,0.15); color: #f4c95d;"
                  >
                    +${m.rewardUsd}
                  </span>
                {/if}
                {#if m.rewardXp > 0}
                  <span
                    class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style="background: rgba(37,99,235,0.15); color: #93c5fd;"
                  >
                    +{m.rewardXp} XP
                  </span>
                {/if}
              </div>

              {#if m.claimable}
                <button
                  on:click={() => claim(m.code)}
                  disabled={claiming === m.code}
                  class="px-3 py-1.5 rounded-xl text-[10px] font-extrabold active:scale-95 disabled:opacity-40 shrink-0"
                  style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 2px 0 #7a560a;"
                >
                  {claiming === m.code ? '…' : 'Claim'}
                </button>
              {:else if m.claimed}
                <span
                  class="text-[10px] font-bold text-emerald-400 flex items-center gap-1 shrink-0"
                >
                  <Icon name="check" size={11} color="#6ee7b7" />
                  <span>Done</span>
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-4 py-2.5 max-w-[90%]"
      style="background: rgba(6,78,59,0.95); border: 1px solid rgba(34,197,94,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.7);"
    >
      <p class="text-xs font-extrabold text-emerald-100">{toast}</p>
    </div>
  {/if}
</div>
