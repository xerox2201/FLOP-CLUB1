<script lang="ts">
  export let amount: number = 0;
  export let size: number = 28;
  export let maxStack: number = 5;

  // chips-set-hq.png layout: 4 columns × 3 rows
  // Row 0: 1,   5,    25,   100
  // Row 1: 500, 1K,   5K,   10K
  // Row 2: 50K, 100K, 500K, 1M
  const DENOMS = [
    { value: 1,       row: 0, col: 0 },
    { value: 5,       row: 0, col: 1 },
    { value: 25,      row: 0, col: 2 },
    { value: 100,     row: 0, col: 3 },
    { value: 500,     row: 1, col: 0 },
    { value: 1000,    row: 1, col: 1 },
    { value: 5000,    row: 1, col: 2 },
    { value: 10000,   row: 1, col: 3 },
    { value: 50000,   row: 2, col: 0 },
    { value: 100000,  row: 2, col: 1 },
    { value: 500000,  row: 2, col: 2 },
    { value: 1000000, row: 2, col: 3 },
  ];

  function breakdown(amt: number) {
    const result: { value: number; row: number; col: number; count: number }[] = [];
    let remaining = Math.round(amt * 100) / 100;
    for (let i = DENOMS.length - 1; i >= 0; i--) {
      const d = DENOMS[i];
      if (remaining >= d.value) {
        const count = Math.floor(remaining / d.value);
        result.push({ ...d, count });
        remaining -= count * d.value;
      }
    }
    if (result.length === 0 && amt > 0) result.push({ ...DENOMS[0], count: 1 });
    return result;
  }

  $: stacks = breakdown(amount);
</script>

{#if amount > 0}
  <div class="flex items-end" style="gap: {size * 0.1}px;">
    {#each stacks as s}
      <div
        class="relative"
        style="
          width: {size}px;
          height: {size + (Math.min(s.count, maxStack) - 1) * (size * 0.16)}px;
        "
      >
        {#each Array(Math.min(s.count, maxStack)) as _, i}
          <div
            class="absolute"
            style="
              width: {size}px;
              height: {size}px;
              bottom: {i * (size * 0.16)}px;
              left: 0;
              background-image: url('/chips-set-hq.png');
              background-size: 400% 300%;
              background-position: {(s.col * 100) / 3}% {(s.row * 100) / 2}%;
              background-repeat: no-repeat;
              filter: drop-shadow(0 {size * 0.06}px {size * 0.1}px rgba(0,0,0,0.7));
            "
          ></div>
        {/each}

        {#if s.count > maxStack}
          <div
            class="absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold z-10"
            style="
              background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
              color: #0a0800;
              box-shadow: 0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,235,170,0.5);
              line-height: 1;
            "
          >
            ×{s.count}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}