<script lang="ts">
  import TopBar from '../components/TopBar.svelte';

  export let onBack: () => void = () => {};

  let activeCategory: 'all' | 'cards' | 'chips' | 'avatars' | 'emotes' = 'all';

  type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
  interface Item {
    id: string;
    name: string;
    category: 'cards' | 'chips' | 'avatars' | 'emotes';
    rarity: Rarity;
    price: number;
    icon: string;
    owned?: boolean;
  }

  const items: Item[] = [
    { id: 'cb_neon', name: 'Neon Deck', category: 'cards', rarity: 'rare', price: 500, icon: '🎴' },
    {
      id: 'cb_gold',
      name: 'Gold Deck',
      category: 'cards',
      rarity: 'legendary',
      price: 5000,
      icon: '✨',
    },
    {
      id: 'cb_classic',
      name: 'Classic Deck',
      category: 'cards',
      rarity: 'common',
      price: 100,
      icon: '🃏',
    },
    {
      id: 'ch_violet',
      name: 'Violet Chips',
      category: 'chips',
      rarity: 'epic',
      price: 1500,
      icon: '🟣',
    },
    {
      id: 'ch_rose',
      name: 'Rose Chips',
      category: 'chips',
      rarity: 'rare',
      price: 800,
      icon: '🔴',
    },
    {
      id: 'av_shark',
      name: 'Shark Avatar',
      category: 'avatars',
      rarity: 'rare',
      price: 300,
      icon: '🦈',
    },
    {
      id: 'av_dragon',
      name: 'Dragon Avatar',
      category: 'avatars',
      rarity: 'legendary',
      price: 4000,
      icon: '🐉',
    },
    {
      id: 'em_cool',
      name: 'Cool Emote',
      category: 'emotes',
      rarity: 'common',
      price: 50,
      icon: '😎',
    },
    {
      id: 'em_fire',
      name: 'Fire Emote',
      category: 'emotes',
      rarity: 'rare',
      price: 200,
      icon: '🔥',
    },
    {
      id: 'em_crown',
      name: 'Crown Emote',
      category: 'emotes',
      rarity: 'epic',
      price: 1000,
      icon: '👑',
    },
  ];

  const categories = [
    { key: 'all', label: 'All', icon: '🌟' },
    { key: 'cards', label: 'Cards', icon: '🎴' },
    { key: 'chips', label: 'Chips', icon: '🪙' },
    { key: 'avatars', label: 'Avatars', icon: '🦈' },
    { key: 'emotes', label: 'Emotes', icon: '😎' },
  ];

  $: filtered =
    activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  const rarityColors: Record<Rarity, { border: string; bg: string; glow: string; label: string }> =
    {
      common: {
        border: 'rgba(107,114,128,0.5)',
        bg: 'linear-gradient(135deg, rgba(107,114,128,0.15), rgba(55,65,81,0.1))',
        glow: 'rgba(107,114,128,0.3)',
        label: 'Common',
      },
      rare: {
        border: 'rgba(34,211,238,0.5)',
        bg: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.1))',
        glow: 'rgba(34,211,238,0.4)',
        label: 'Rare',
      },
      epic: {
        border: 'rgba(139,92,246,0.55)',
        bg: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.1))',
        glow: 'rgba(139,92,246,0.5)',
        label: 'Epic',
      },
      legendary: {
        border: 'rgba(244,201,93,0.6)',
        bg: 'linear-gradient(135deg, rgba(244,201,93,0.2), rgba(168,121,34,0.1))',
        glow: 'rgba(244,201,93,0.6)',
        label: 'Legendary',
      },
    };

  function tryBuy(item: Item) {
    alert('Shop is coming soon! Item: ' + item.name);
  }
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center gap-2 mt-3 mb-2">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      ←
    </button>
    <h1 class="text-xl font-extrabold flex-1">🛒 Shop</h1>
  </div>

  <!-- Coming soon banner -->
  <div
    class="rounded-2xl p-3 mb-4 flex items-center gap-2"
    style="background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.05)); border: 1px solid rgba(34,211,238,0.3);"
  >
    <span class="text-xl">🚧</span>
    <div class="flex-1">
      <p class="text-xs font-bold text-cyan">Coming Soon</p>
      <p class="text-[10px] text-white/60">
        Shop items are previews. Purchases will be enabled soon.
      </p>
    </div>
  </div>

  <!-- Category tabs -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1 no-scrollbar">
    {#each categories as c}
      <button
        on:click={() => (activeCategory = c.key as any)}
        class="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap active:scale-95 transition flex items-center gap-1"
        style="background: {activeCategory === c.key
          ? 'linear-gradient(180deg, #ffe9a8 0%, #f4c95d 50%, #a87922 100%)'
          : 'rgba(139,92,246,0.12)'}; color: {activeCategory === c.key
          ? '#050611'
          : 'rgba(255,255,255,0.7)'}; border: 1px solid {activeCategory === c.key
          ? 'transparent'
          : 'rgba(139,92,246,0.2)'};"
      >
        <span>{c.icon}</span>
        <span>{c.label}</span>
      </button>
    {/each}
  </div>

  <!-- Items grid -->
  <div class="grid grid-cols-2 gap-3">
    {#each filtered as item}
      {@const rc = rarityColors[item.rarity]}
      <button
        on:click={() => tryBuy(item)}
        class="rounded-2xl p-3 text-left active:scale-[0.97] transition relative overflow-hidden"
        style="background: {rc.bg}; border: 1.5px solid {rc.border}; box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 20px {rc.glow}30;"
      >
        <!-- Rarity tag -->
        <div class="flex items-center justify-between mb-2">
          <span
            class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style="background: {rc.border}25; color: {rc.border}; border: 1px solid {rc.border}60;"
          >
            {rc.label}
          </span>
          {#if item.owned}
            <span class="text-[8px] font-bold text-emerald-400">✓ Owned</span>
          {/if}
        </div>

        <!-- Icon preview -->
        <div
          class="w-full h-[80px] rounded-xl flex items-center justify-center text-5xl mb-3"
          style="background: rgba(0,0,0,0.35);"
        >
          {item.icon}
        </div>

        <!-- Name -->
        <p class="text-sm font-extrabold text-white leading-tight truncate mb-1">
          {item.name}
        </p>

        <!-- Price -->
        <div class="flex items-center justify-between">
          <span class="text-[9px] text-white/40 uppercase font-bold">
            {item.category}
          </span>
          <span class="text-xs font-extrabold text-gold tabular-nums">
            ${item.price}
          </span>
        </div>
      </button>
    {/each}
  </div>
</div>
