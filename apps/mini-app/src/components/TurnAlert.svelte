<script lang="ts">
  import { activeTables, myTurnTables } from '../lib/activeTables';
  export let currentTableId: number | null = null;
  export let onGo: (id: number) => void = () => {};

  let dismissed = new Set<number>();
  $: relevant = $myTurnTables.filter((id) => id !== currentTableId && !dismissed.has(id));
  $: first = relevant[0] ?? null;

  function go(id: number) {
    dismissed.delete(id);
    onGo(id);
  }
  function dismiss(id: number) {
    dismissed.add(id);
    dismissed = new Set(dismissed);
  }
  function handleKey(e: KeyboardEvent, id: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go(id);
    }
  }
</script>

{#if first !== null}
  {@const t = $activeTables.get(first)}
  {#if t}
    <div
      role="button"
      tabindex="0"
      on:click={() => go(first)}
      on:keydown={(e) => handleKey(e, first)}
      class="fixed left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-3 py-2 rounded-2xl active:scale-[0.98] cursor-pointer"
      style="
        top: max(14px, env(safe-area-inset-top));
        background: linear-gradient(180deg,#ef4444,#991b1b);
        border: 1.5px solid #fca5a5;
        animation: turnPulse 1s ease-in-out infinite;
      "
    >
      <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:rgba(255,255,255,0.2);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <div class="text-left">
        <p class="text-[11px] font-extrabold text-white leading-tight">Your turn!</p>
        <p class="text-[9px] text-white/85 leading-tight">{t.meta.name || `#${first}`}</p>
      </div>
      <button
        type="button"
        on:click|stopPropagation={() => dismiss(first)}
        aria-label="Dismiss"
        class="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-white/70"
        style="background:rgba(0,0,0,0.3);"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  {/if}
{/if}

<style>
  @keyframes turnPulse {
    0%, 100% {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 24px rgba(239, 68, 68, 0.5);
    }
    50% {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 1);
    }
  }
</style>