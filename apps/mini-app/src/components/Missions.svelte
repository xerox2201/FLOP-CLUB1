<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';

  export let showTitle = true;
  export let onSeeAll: () => void = () => {};

  let missions: any[] = [];
  let loading = true;
  let claiming: string | null = null;
  let error = '';
  let toast = '';

  const METRIC_ICON: Record<string, string> = {
    hands_played: 'play',
    hands_won: 'trophy',
    tournaments_played: 'tournaments',
    showdowns_won: 'star',
    omaha_hands_played: 'sparkles',
  };

  function iconFor(metric: string): string {
    return METRIC_ICON[metric] ?? 'target';
  }

  function pct(m: any): number {
    const threshold = Number(m?.threshold || 0);
    if (threshold <= 0) return 0;
    return Math.min(100, Math.round((Number(m.progress || 0) / threshold) * 100));
  }

  async function load() {
    try {
      const res = await api.request<any>('/api/missions/daily');
      if (res.ok && res.data) {
        missions = res.data.missions || [];
      } else if (!res.ok && res.status !== 401) {
        error = res.error || 'load_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function claim(code: string) {
    if (claiming) return;
    claiming = code;
    error = '';
    toast = '';
    try {
      const res = await api.request<any>(`/api/missions/${code}/claim`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok && res.data) {
        toast = `Claimed ${res.data.rewardChips} chips + ${res.data.rewardXp} XP`;
      } else {
        error = res.error || 'claim_failed';
      }
      await load();
    } finally {
      claiming = null;
    }
  }

  onMount(load);
</script>

<div class="px-4 mb-4">
  {#if showTitle}
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <Icon name="target" size={14} color="#f4c95d" />
        <p class="text-tiny font-extrabold text-white/90 uppercase tracking-widest">
          Daily Missions
        </p>
      </div>
      <button
        on:click={onSeeAll}
        class="text-mini font-bold text-gold active:opacity-70 flex items-center gap-1"
      >
        <span>See All</span>
        <Icon name="arrow-right" size={10} />
      </button>
    </div>
  {/if}

  {#if toast}
    <div
      class="rounded-xl px-3 py-2 mb-2 text-mini font-bold"
      style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.4); color: #6ee7b7;"
    >
      {toast}
    </div>
  {/if}

  {#if error}
    <div
      class="rounded-xl px-3 py-2 mb-2 text-mini font-bold"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5;"
    >
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="space-y-1.5">
      {#each Array(3) as _}
        <div
          class="rounded-xl h-[62px]"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
        ></div>
      {/each}
    </div>
  {:else if missions.length === 0}
    <div
      class="rounded-2xl p-5 text-center"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(212,175,55,0.3);"
    >
      <p class="text-[12px] font-extrabold text-white">No missions right now</p>
      <p class="text-mini text-white/50 font-bold mt-1">
        New missions unlock every day at 00:00 UTC
      </p>
    </div>
  {:else}
    <div class="space-y-1.5">
      {#each missions as m (m.code)}
        {@const done = m.claimed === true}
        {@const ready = m.claimable === true}
        <div
          class="rounded-xl px-3 py-2.5 relative overflow-hidden"
          style="
            background:
              {done
            ? 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(7,14,27,0.9))'
            : ready
              ? 'linear-gradient(90deg, rgba(244,201,93,0.12), rgba(244,201,93,0.02))'
              : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
            border: 1px solid {done
            ? 'rgba(16,185,129,0.35)'
            : ready
              ? 'rgba(244,201,93,0.45)'
              : 'rgba(255,255,255,0.06)'};
          "
        >
          <div class="flex items-center gap-2.5">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style="
                background: {done ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.35)'};
                border: 1px solid {done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'};
              "
            >
              <Icon
                name={done ? 'check' : iconFor(m.metric)}
                size={15}
                color={done ? '#6ee7b7' : '#f4c95d'}
              />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-[12px] font-extrabold text-white truncate leading-tight">
                  {m.title}
                </p>
                {#if ready}
                  <span
                    class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider shrink-0"
                    style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
                  >
                    READY
                  </span>
                {/if}
              </div>
              <p class="text-micro text-white/45 font-bold mt-0.5 truncate">
                {m.description}
              </p>
            </div>

            <div class="text-end shrink-0">
              <div class="flex items-center gap-1 justify-end">
                <Icon name="coin" size={9} color="#f4c95d" />
                <span class="text-mini font-extrabold text-gold tabular-nums">
                  {m.rewardChips}
                </span>
              </div>
              <div class="flex items-center gap-1 justify-end mt-0.5">
                <Icon name="star" size={9} color="#a5b4fc" />
                <span class="text-micro font-bold text-indigo-300 tabular-nums">
                  {m.rewardXp} XP
                </span>
              </div>
            </div>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <div
              class="flex-1 h-1.5 rounded-full overflow-hidden"
              style="background: rgba(255,255,255,0.08);"
            >
              <div
                class="h-full rounded-full transition-all"
                style="
                  width: {pct(m)}%;
                  background: {done
                  ? 'linear-gradient(90deg, #10b981, #6ee7b7)'
                  : 'linear-gradient(90deg, #d4af37, #f4e5a8)'};
                "
              ></div>
            </div>

            <span class="text-micro font-extrabold tabular-nums text-white/60 shrink-0">
              {Math.min(Number(m.progress || 0), Number(m.threshold || 0))}/{m.threshold}
            </span>

            {#if done}
              <span
                class="text-micro font-extrabold px-2 py-1 rounded-lg shrink-0"
                style="background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.35);"
              >
                CLAIMED
              </span>
            {:else if ready}
              <button
                on:click={() => claim(m.code)}
                disabled={claiming === m.code}
                class="text-micro font-extrabold px-2.5 py-1 rounded-lg shrink-0 active:scale-95 transition disabled:opacity-60"
                style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
              >
                {claiming === m.code ? '...' : 'CLAIM'}
              </button>
            {:else}
              <span class="text-micro font-bold text-white/30 shrink-0">IN PROGRESS</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
