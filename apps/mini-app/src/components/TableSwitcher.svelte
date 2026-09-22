<script lang="ts">
  import { activeTables, myTurnTables } from '../lib/activeTables';
  export let currentTableId: number | null = null;
  export let onSwitch: (id: number) => void = () => {};
  export let onAdd: () => void = () => {};
</script>

{#if $activeTables.size > 0}
  <div class="flex items-center gap-1.5 px-2 py-2 overflow-x-auto no-scrollbar shrink-0"
       style="background: rgba(0,0,0,0.85); border-bottom: 1px solid rgba(212,175,55,0.3);">
    {#each [...$activeTables.entries()] as [id, t]}
      {@const isCurrent = id === currentTableId}
      {@const isTurn = $myTurnTables.includes(id)}
      {@const label = t.meta.name || `#${id}`}
      <button
        on:click={() => onSwitch(id)}
        class="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition"
        style="
          background: {isCurrent ? 'linear-gradient(180deg,#f4e5a8,#d4af37 45%,#a87a15)' : 'rgba(15,31,58,0.9)'};
          color: {isCurrent ? '#0a0800' : '#fff'};
          border: 1.5px solid {isCurrent ? '#f4e5a8' : isTurn ? '#ef4444' : 'rgba(212,175,55,0.35)'};
          {isTurn && !isCurrent ? 'animation: turnPulse 1.2s ease-in-out infinite;' : ''}
        "
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full mr-1"
              style="background:{!t.connected ? '#ef4444' : t.state ? '#10b981' : '#f59e0b'};"></span>
        {label}
      </button>
    {/each}
    <button on:click={onAdd}
            class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style="background: linear-gradient(180deg,#22c55e,#15803d); border: 1.5px solid #6ee7b7;"
            aria-label="Add table">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>
{/if}

<style>
  @keyframes turnPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
    50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  }
</style>