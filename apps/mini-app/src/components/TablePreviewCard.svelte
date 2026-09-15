<script lang="ts">
  export let table: any;
  export let onClick: () => void = () => {};

  function variantEmoji(v: string): string {
    if (v === 'holdem') return '♠️';
    if (v === 'omaha4') return '♦️';
    if (v === 'omaha5') return '♣️';
    return '🎴';
  }

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }
</script>

<button
  on:click={onClick}
  class="rounded-2xl p-2.5 active:scale-[0.97] transition text-left w-[140px] shrink-0"
  style="background: linear-gradient(135deg, rgba(16,26,58,0.95), rgba(8,13,36,0.95)); border: 1px solid rgba(139,92,246,0.25); box-shadow: 0 4px 12px rgba(0,0,0,0.4);"
>
  <!-- Mini felt preview -->
  <div
    class="relative w-full h-[68px] rounded-xl overflow-hidden mb-2 flex items-center justify-center"
    style="background: radial-gradient(ellipse at 50% 45%, #1a5c3a 0%, #0d3d24 60%, #072a1a 100%); box-shadow: inset 0 0 16px rgba(0,0,0,0.7);"
  >
    <span class="text-2xl relative z-10">{variantEmoji(table.variant)}</span>
    <div
      class="absolute inset-0 rounded-[50%] opacity-50"
      style="background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.15), transparent 60%);"
    ></div>
  </div>

  <!-- Info -->
  <div class="flex items-center justify-between gap-1 mb-0.5">
    <p class="text-[10px] font-extrabold text-white truncate">
      {variantLabel(table.variant)}
    </p>
    <span
      class="text-[8px] font-bold px-1 py-0.5 rounded-full shrink-0 {table.mode === 'free'
        ? 'bg-emerald-900/60 text-emerald-300'
        : 'badge-gold'}"
    >
      {table.mode === 'free' ? 'FREE' : 'REAL'}
    </span>
  </div>

  <p class="text-[9px] text-white/50 font-mono truncate">
    ${table.blinds?.sb}/{table.blinds?.bb} · {table.seats || 6} seats
  </p>

  <!-- Live indicator -->
  <div class="flex items-center gap-1 mt-1.5">
    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
    <span class="text-[8px] text-emerald-300 font-bold">
      {table.live_players ?? Math.floor(Math.random() * 4) + 1} playing
    </span>
  </div>
</button>
