<script lang="ts">
  export let amount: number = 0;
  export let size: number = 18;

  const DENOMS = [
    { value: 500, color: '#7c3aed', light: '#c4b5fd', text: '#fff' },
    { value: 100, color: '#111827', light: '#6b7280', text: '#fff' },
    { value: 25,  color: '#047857', light: '#34d399', text: '#fff' },
    { value: 5,   color: '#b91c1c', light: '#f87171', text: '#fff' },
    { value: 1,   color: '#f3f4f6', light: '#9ca3af', text: '#000' },
  ];

  function breakdown(amt: number) {
    const result: { value: number; color: string; light: string; text: string; count: number }[] = [];
    let remaining = Math.round(amt * 100) / 100;

    for (const d of DENOMS) {
      if (remaining >= d.value) {
        const count = Math.floor(remaining / d.value);
        result.push({ ...d, count: Math.min(count, 4) });
        remaining -= count * d.value;
      }
    }
    if (result.length === 0 && amt > 0) {
      result.push({ ...DENOMS[4], count: 1 });
    }
    return result;
  }

  $: stacks = breakdown(amount);
</script>

{#if amount > 0}
  <div class="flex items-end" style="gap: 2px;">
    {#each stacks as s}
      <div class="relative" style="width: {size}px; height: {size + (s.count - 1) * 3}px;">
        {#each Array(s.count) as _, i}
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            style="position: absolute; bottom: {i * 3}px; left: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));"
          >
            <circle cx="12" cy="12" r="11" fill={s.color} stroke={s.light} stroke-width="1.5"/>
            <circle cx="12" cy="12" r="11" fill="none" stroke={s.light} stroke-width="1.5" stroke-dasharray="2.5 2.5" opacity="0.9"/>
            <circle cx="12" cy="12" r="8" fill="none" stroke={s.light} stroke-width="0.8" opacity="0.7"/>
            <circle cx="12" cy="12" r="5.5" fill={s.light} opacity="0.35"/>
            {#if size >= 16}
              <text x="12" y="15" text-anchor="middle" font-size="7" font-weight="900" fill={s.text} opacity="0.9">
                {s.value}
              </text>
            {/if}
          </svg>
        {/each}
      </div>
    {/each}
  </div>
{/if}