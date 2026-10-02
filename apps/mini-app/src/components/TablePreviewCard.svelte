<script lang="ts">
  export let table: any;
  export let onClick: () => void = () => {};

  function variantEmoji(v: string): string {
    if (v === 'holdem') return '♠';
    if (v === 'omaha4') return '♦';
    if (v === 'omaha5') return '♣';
    return '♠'; // neutral card glyph fallback
  }

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }

  $: isFree = table.mode === 'free';
  $: accentColor = isFree ? '#10b981' : '#d4af37';
</script>

<button
  on:click={onClick}
  class="rounded-2xl active:scale-[0.97] transition-all text-left w-[160px] shrink-0 relative overflow-hidden"
  style="
    background: linear-gradient(180deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
    border: 1.5px solid {isFree ? 'rgba(16,185,129,0.3)' : 'rgba(212,175,55,0.35)'};
    box-shadow:
      0 6px 20px rgba(0,0,0,0.55),
      inset 0 1px 0 rgba(255,255,255,0.05);
  "
>
  <!-- Mini felt preview -->
  <div
    class="relative w-full h-[80px] overflow-hidden flex items-center justify-center"
    style="
      background:
        radial-gradient(ellipse at 50% 40%, #142d52 0%, #0a1a33 55%, #05080f 100%);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    "
  >
    <!-- Felt texture -->
    <div
      class="absolute inset-0 opacity-40"
      style="
        background-image:
          repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 2px);
      "
    ></div>

    <!-- Inner rim oval -->
    <div
      class="absolute inset-3 rounded-[50%]"
      style="
        border: 1px solid rgba(212,175,55,0.35);
        box-shadow:
          inset 0 0 12px rgba(0,0,0,0.8),
          0 0 8px rgba(212,175,55,0.15);
      "
    ></div>

    <!-- Emoji -->
    <span class="text-2xl relative z-10 drop-shadow-lg">{variantEmoji(table.variant)}</span>

    <!-- Mode badge -->
    <span
      class="absolute top-2 right-2 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
      style="
        background: {isFree
        ? 'rgba(16,185,129,0.25)'
        : 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'};
        color: {isFree ? '#6ee7b7' : '#0a0800'};
        border: 1px solid {isFree ? 'rgba(16,185,129,0.5)' : 'rgba(255,235,170,0.5)'};
        box-shadow: {isFree ? 'none' : '0 1px 0 rgba(122,86,10,0.8)'};
      "
    >
      {isFree ? 'FREE' : 'REAL'}
    </span>
  </div>

  <!-- Info -->
  <div class="p-2.5">
    <p class="text-[11px] font-extrabold text-white truncate leading-tight">
      {variantLabel(table.variant)}
    </p>

    <p class="text-[9px] text-white/55 font-mono mt-1 tabular-nums">
      ${table.blinds?.sb ?? 0}/${table.blinds?.bb ?? 0}
    </p>

    <!-- Live indicator -->
    <div class="flex items-center gap-1 mt-1.5">
      <span
        class="w-1.5 h-1.5 rounded-full animate-pulse"
        style="
          background: {accentColor};
          box-shadow: 0 0 6px {accentColor};
        "
      ></span>
      <span class="text-[9px] font-bold" style="color: {accentColor};">
        {table.live_players ?? Math.floor(Math.random() * 4) + 1} playing
      </span>
    </div>
  </div>
</button>
