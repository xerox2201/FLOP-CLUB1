<script lang="ts">
  import { fmtAmount } from '../lib/table-geometry';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  export let winners: any[] = [];
  export let onSeeAll: () => void = () => {};

  function fmt(n: any): string {
    return fmtAmount(Number(n || 0));
  }

  const MEDALS = ['', '', ''];
</script>

{#if winners.length > 0}
  <div class="px-4 mb-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <Icon name="trophy" size={14} color="#f4c95d" />
        <p class="text-tiny font-extrabold text-white/90 uppercase tracking-widest">
          Top Winners · Today
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

    <div class="space-y-1.5">
      {#each winners as w, i}
        <div
          class="rounded-xl px-3 py-2 flex items-center gap-3"
          style="
            background:
              {i === 0
            ? 'linear-gradient(90deg, rgba(244,201,93,0.15), rgba(244,201,93,0.03))'
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
            border: 1px solid {i === 0 ? 'rgba(244,201,93,0.4)' : 'rgba(255,255,255,0.06)'};
            {i === 0
            ? 'box-shadow: 0 0 12px rgba(244,201,93,0.2), inset 0 1px 0 rgba(255,255,255,0.05);'
            : ''}
          "
        >
          <!-- Rank badge -->
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-base"
            style="
              background: {i === 0
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(0,0,0,0.4)'};
              border: 1px solid {i === 0 ? 'rgba(255,235,170,0.6)' : 'rgba(255,255,255,0.08)'};
            "
          >
            {#if i < 3}
              <span>{MEDALS[i]}</span>
            {:else}
              <span class="text-mini font-extrabold text-white/70">#{i + 1}</span>
            {/if}
          </div>

          <!-- Avatar -->
          <div
            class="w-8 h-8 rounded-full overflow-hidden shrink-0"
            style="background: radial-gradient(circle, #1a3a5c, #05080f);"
          >
            <Avatar avatarId={w.avatarId || 'king'} size="sm" />
          </div>

          <!-- Name -->
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-extrabold text-white truncate leading-tight">
              {w.displayName || 'Player'}
            </p>
            <p class="text-micro text-white/40 font-bold leading-tight mt-0.5">
              {w.wins}
              {w.wins === 1 ? 'win' : 'wins'} today
            </p>
          </div>

          <!-- Amount -->
          <div class="text-end shrink-0">
            <p
              class="text-[14px] font-extrabold tabular-nums leading-none"
              style="
                background: linear-gradient(180deg, #6ee7b7, #10b981);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 1px 4px rgba(16,185,129,0.4));
              "
            >
              +{fmt(w.totalWon)}
            </p>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
