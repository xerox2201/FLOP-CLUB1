<script lang="ts">
  import TopBar from '../components/TopBar.svelte';

  export let onBack: () => void = () => {};

  type Category = 'all' | 'chips' | 'cards' | 'frames' | 'table';
  type Rarity = 'common' | 'rare' | 'legendary' | 'immortal' | 'arcana' | 'ton';

  let activeCategory: Category = 'all';
  let rarityFilter: Rarity | 'all' = 'all';
  let priceFilter: 'all' | 'low' | 'high' = 'all';

  interface Item {
    id: string;
    name: string;
    category: Category;
    rarity: Rarity;
    priceUsd: number;
    priceTon: number;
    image: string;
    imageBg: string;
    label: string;
  }

  const items: Item[] = [
    { id: 'chip_blue',   name: 'Blue Chip Pack',   category: 'chips',  rarity: 'common',    priceUsd: 0.99,  priceTon: 0.25,  image: '/chips-set-hq.png', imageBg: 'chip_blue',   label: 'Common' },
    { id: 'chip_green',  name: 'Green Chip Pack',  category: 'chips',  rarity: 'rare',      priceUsd: 4.99,  priceTon: 1.25,  image: '/chips-set-hq.png', imageBg: 'chip_green',  label: 'Rare' },
    { id: 'chip_gold',   name: 'Gold Chip Pack',   category: 'chips',  rarity: 'legendary', priceUsd: 19.99, priceTon: 5.00,  image: '/chips-set-hq.png', imageBg: 'chip_gold',   label: 'Legendary' },
    { id: 'chip_purple', name: 'Purple Chip Pack', category: 'chips',  rarity: 'immortal',  priceUsd: 49.99, priceTon: 12.50, image: '/chips-set-hq.png', imageBg: 'chip_purple', label: 'Immortal' },
    { id: 'chip_red',    name: 'Red Chip Pack',    category: 'chips',  rarity: 'arcana',    priceUsd: 99.99, priceTon: 25.00, image: '/chips-set-hq.png', imageBg: 'chip_red',    label: 'Arcana' },
    { id: 'chip_ton',    name: 'TON Chip Pack',    category: 'chips',  rarity: 'ton',       priceUsd: 99.99, priceTon: 25.00, image: '/chips-set-hq.png', imageBg: 'chip_ton',    label: 'TON' },
    { id: 'card_royal',  name: 'Royal Deck',       category: 'cards',  rarity: 'legendary', priceUsd: 4.99,  priceTon: 1.25,  image: '/card-back-royal.png',   imageBg: 'card_royal',   label: 'Legendary' },
    { id: 'card_classic',name: 'Classic Deck',     category: 'cards',  rarity: 'rare',      priceUsd: 2.99,  priceTon: 0.75,  image: '/card-back-classic.png', imageBg: 'card_classic', label: 'Rare' },
    { id: 'card_dark',   name: 'Dark Deck',        category: 'cards',  rarity: 'immortal',  priceUsd: 6.99,  priceTon: 1.75,  image: '/card-back-dark.png',    imageBg: 'card_dark',    label: 'Immortal' },
    { id: 'frame_royal', name: 'Royal Frame',      category: 'frames', rarity: 'legendary', priceUsd: 9.99,  priceTon: 2.50,  image: '/frame-royal.png',       imageBg: 'frame_royal',  label: 'Legendary' },
    { id: 'frame_epic',  name: 'Epic Frame',       category: 'frames', rarity: 'rare',      priceUsd: 3.99,  priceTon: 1.00,  image: '/frame-epic.png',        imageBg: 'frame_epic',   label: 'Rare' },
    { id: 'table_royal', name: 'Royal Table',      category: 'table',  rarity: 'immortal',  priceUsd: 12.99, priceTon: 3.25,  image: '/table-top.png',         imageBg: 'table_royal',  label: 'Immortal' },
  ];

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'chips', label: 'Chips' },
    { key: 'cards', label: 'Cards' },
    { key: 'frames', label: 'Frames' },
    { key: 'table', label: 'Table' },
  ];

  const rarityColors: Record<string, string> = {
    common: '#94a3b8',
    rare: '#3b82f6',
    legendary: '#d4af37',
    immortal: '#8b5cf6',
    arcana: '#ef4444',
    ton: '#22d3ee',
  };

  // Chip background positions (for chips-set-hq.png 4×3 grid)
  const chipBg: Record<string, string> = {
    chip_blue:   '0% 0%',    // 1 chip
    chip_green:  '33.33% 0%', // 5 chip
    chip_gold:   '66.66% 0%', // 25 chip
    chip_purple: '100% 0%',  // 100 chip
    chip_red:    '0% 50%',   // 500 chip
    chip_ton:    '33.33% 50%', // 1K chip
  };

  $: filtered = items.filter((i) => {
    if (activeCategory !== 'all' && i.category !== activeCategory) return false;
    if (rarityFilter !== 'all' && i.rarity !== rarityFilter) return false;
    if (priceFilter === 'low' && i.priceUsd > 5) return false;
    if (priceFilter === 'high' && i.priceUsd <= 5) return false;
    return true;
  });

  let balanceUsd = 2840;
  let balanceTon = 1.25;

  function getImageStyle(item: Item): string {
    if (item.category === 'chips') {
      const pos = chipBg[item.imageBg] || '0% 0%';
      return `
        background-image: url('${item.image}');
        background-size: 400% 300%;
        background-position: ${pos};
        background-repeat: no-repeat;
      `;
    }
    if (item.category === 'cards') {
      return `
        background-image: url('${item.image}');
        background-size: 55% auto;
        background-position: center;
        background-repeat: no-repeat;
        border-radius: 8px;
      `;
    }
    if (item.category === 'table') {
      return `
        background-image: url('${item.image}');
        background-size: 95% auto;
        background-position: center;
        background-repeat: no-repeat;
      `;
    }
    // frames
    return `
      background-image: url('${item.image}');
      background-size: 70% auto;
      background-position: center;
      background-repeat: no-repeat;
    `;
  }
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">🛒 Shop</h1>
  </div>

  <!-- BALANCE BAR -->
  <div class="flex items-center gap-2 mb-4 px-4">
    <div class="flex-1 rounded-2xl px-3 py-2 flex items-center gap-2"
         style="background: linear-gradient(180deg, rgba(212,175,55,0.18), rgba(168,122,21,0.08)); border: 1.5px solid rgba(212,175,55,0.4);">
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold"
           style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5);">$</div>
      <span class="text-[13px] font-extrabold text-white tabular-nums">{balanceUsd.toLocaleString()}</span>
      <button class="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-gold text-base font-extrabold" style="background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.4);">+</button>
    </div>

    <div class="flex-1 rounded-2xl px-3 py-2 flex items-center gap-2"
         style="background: linear-gradient(180deg, rgba(34,211,238,0.18), rgba(14,116,144,0.08)); border: 1.5px solid rgba(34,211,238,0.4);">
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold"
           style="background: linear-gradient(180deg, #67e8f9, #22d3ee 45%, #0e7490); color: #0a0800; box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5);">💎</div>
      <span class="text-[13px] font-extrabold text-white tabular-nums">{balanceTon}</span>
      <span class="text-[9px] text-cyan/80 font-bold">TON</span>
    </div>
  </div>

  <!-- CATEGORIES -->
  <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each categories as c}
      <button
        on:click={() => (activeCategory = c.key)}
        class="px-4 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition-all uppercase tracking-wider"
        style="
          background: {activeCategory === c.key
            ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {activeCategory === c.key ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {activeCategory === c.key ? 'transparent' : 'rgba(212,175,55,0.15)'};
          {activeCategory === c.key ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);' : ''}
        "
      >
        {c.label}
      </button>
    {/each}
  </div>

  <!-- FILTERS -->
  <div class="flex gap-2 mb-4 px-4">
    <div class="relative flex-1">
      <select bind:value={rarityFilter}
              class="w-full rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none appearance-none pr-8"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);">
        <option value="all">All Rarity</option>
        <option value="common">Common</option>
        <option value="rare">Rare</option>
        <option value="legendary">Legendary</option>
        <option value="immortal">Immortal</option>
        <option value="arcana">Arcana</option>
        <option value="ton">TON</option>
      </select>
      <svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>

    <div class="relative flex-1">
      <select bind:value={priceFilter}
              class="w-full rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none appearance-none pr-8"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);">
        <option value="all">All Prices</option>
        <option value="low">Under $5</option>
        <option value="high">$5+</option>
      </select>
      <svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  </div>

  <!-- ITEMS GRID -->
  <div class="grid grid-cols-2 gap-3 px-4">
    {#each filtered as item}
      {@const rc = rarityColors[item.rarity] || '#94a3b8'}
      <button
        class="rounded-2xl overflow-hidden active:scale-[0.97] transition-all text-left relative"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1.5px solid {rc}50;
          box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 20px {rc}20, inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <!-- Rarity label -->
        <div
          class="absolute top-2 left-2 z-10 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style="background: {rc}25; color: {rc}; border: 1px solid {rc}60; box-shadow: 0 0 8px {rc}40;"
        >
          {item.label}
        </div>

        <!-- Preview -->
        <div
                              class="relative w-full overflow-hidden"
          style="
            aspect-ratio: 1 / 1;
            background:
              radial-gradient(ellipse at 50% 45%, {rc}30 0%, transparent 65%),
              linear-gradient(180deg, rgba(15,31,58,0.6), rgba(7,14,27,0.9));
            border-bottom: 1px solid rgba(255,255,255,0.05);
          "
        >
          <!-- dotted pattern -->
          <div class="absolute inset-0 opacity-20"
               style="background-image: radial-gradient(circle at 1px 1px, {rc}80 0.5px, transparent 0); background-size: 6px 6px;"></div>

          <!-- image -->
          <div
            class="absolute inset-0"
            style="{getImageStyle(item)}"
          ></div>
        </div>

        <!-- Info -->
        <div class="p-2.5">
          <p class="text-[11px] font-extrabold text-white leading-tight truncate mb-2">{item.name}</p>

          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-extrabold text-gold/70">$</span>
              <span class="text-[12px] font-extrabold text-white tabular-nums">{item.priceUsd.toFixed(2)}</span>
            </div>
            <div class="flex items-center gap-0.5">
              <span class="text-[9px]">💎</span>
              <span class="text-[10px] font-bold text-cyan tabular-nums">{item.priceTon}</span>
            </div>
          </div>
        </div>

        <div class="h-0.5" style="background: linear-gradient(90deg, transparent, {rc}, transparent);"></div>
      </button>
    {/each}
  </div>

  {#if filtered.length === 0}
    <div class="rounded-2xl p-8 text-center mt-4 mx-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px solid rgba(212,175,55,0.15);">
      <div class="text-4xl mb-2">🛒</div>
      <p class="text-white/50 text-sm font-bold">No items match your filters</p>
    </div>
  {/if}
</div>