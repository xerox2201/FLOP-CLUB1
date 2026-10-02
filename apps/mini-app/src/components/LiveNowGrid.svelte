<script lang="ts">
  import Icon from './Icon.svelte';

  export let activeTables: number = 0;
  export let activeTournaments: number = 0;
  export let onTables: () => void = () => {};
  export let onTournaments: () => void = () => {};

  $: hasActivity = activeTables > 0 || activeTournaments > 0;
</script>

{#if hasActivity}
  <div class="px-4 mb-4">
    <div class="flex items-center gap-2 mb-2">
      <span
        class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"
        style="box-shadow: 0 0 8px #ef4444;"
      ></span>
      <p class="text-tiny font-extrabold text-white/90 uppercase tracking-widest">Live Now</p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <!-- Cash Tables -->
      <button
        on:click={onTables}
        disabled={activeTables === 0}
        class="rounded-2xl p-3 text-start relative overflow-hidden transition-all active:scale-[0.97] {activeTables ===
        0
          ? 'opacity-40'
          : ''}"
        style="
          background:
            radial-gradient(ellipse at 0% 0%, rgba(16,185,129,0.2) 0%, transparent 70%),
            linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
          border: 1px solid rgba(16,185,129,0.4);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        "
      >
        <div class="flex items-center gap-2 mb-1.5">
          <Icon name="tables" size={16} />
          <span class="text-micro font-extrabold text-emerald-300 uppercase tracking-wider">
            Tables
          </span>
        </div>
        <p class="text-2xl font-extrabold text-white leading-none tabular-nums">
          {activeTables}
        </p>
        <p class="text-micro text-white/50 mt-1 font-bold">running now</p>
        {#if activeTables > 0}
          <div class="flex items-center gap-1 mt-1.5">
            <span class="text-micro font-extrabold text-emerald-300">Play</span>
            <Icon name="arrow-right" size={10} color="#6ee7b7" />
          </div>
        {/if}
      </button>

      <!-- Tournaments -->
      <button
        on:click={onTournaments}
        disabled={activeTournaments === 0}
        class="rounded-2xl p-3 text-start relative overflow-hidden transition-all active:scale-[0.97] {activeTournaments ===
        0
          ? 'opacity-40'
          : ''}"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.2) 0%, transparent 70%),
            linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
          border: 1px solid rgba(244,201,93,0.4);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        "
      >
        <div class="flex items-center gap-2 mb-1.5">
          <Icon name="trophy" size={16} color="#f4c95d" />
          <span class="text-micro font-extrabold text-gold uppercase tracking-wider">
            Tourneys
          </span>
        </div>
        <p class="text-2xl font-extrabold text-white leading-none tabular-nums">
          {activeTournaments}
        </p>
        <p class="text-micro text-white/50 mt-1 font-bold">live events</p>
        {#if activeTournaments > 0}
          <div class="flex items-center gap-1 mt-1.5">
            <span class="text-micro font-extrabold text-gold">View</span>
            <Icon name="arrow-right" size={10} color="#f4c95d" />
          </div>
        {/if}
      </button>
    </div>
  </div>
{/if}
