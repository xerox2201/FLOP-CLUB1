<script lang="ts">
  import { t, type MessageKey } from '../i18n';
  import Icon from './Icon.svelte';

  export let onDeposit: () => void = () => {};
  export let onShop: () => void = () => {};
  export let onLeaderboard: () => void = () => {};

  const actions: {
    id: string;
    label: MessageKey;
    sub: MessageKey;
    icon: string;
    color: string;
    handler: () => void;
  }[] = [
    {
      id: 'deposit',
      label: 'quickActions.deposit',
      sub: 'quickActions.depositSub',
      icon: 'dollar',
      color: '#f4c95d',
      handler: () => onDeposit(),
    },
    {
      id: 'shop',
      label: 'quickActions.shop',
      sub: 'quickActions.shopSub',
      icon: 'cart',
      color: '#22d3ee',
      handler: () => onShop(),
    },
    {
      id: 'leaderboard',
      label: 'quickActions.ranks',
      sub: 'quickActions.ranksSub',
      icon: 'trophy',
      color: '#60a5fa',
      handler: () => onLeaderboard(),
    },
  ];
</script>

<div class="grid grid-cols-3 gap-2 px-4 mb-4">
  {#each actions as a}
    <button
      on:click={a.handler}
      class="relative rounded-2xl py-3 px-2 flex flex-col items-center gap-1.5 active:scale-[0.96] transition-all"
      style="
        background:
          radial-gradient(ellipse at 50% 0%, {a.color}18 0%, transparent 70%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid {a.color}40;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center"
        style="
          background: radial-gradient(circle at 30% 30%, {a.color}35, {a.color}10);
          border: 1px solid {a.color}60;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
        "
      >
        <Icon name={a.icon} size={18} color={a.color} />
      </div>
      <div class="text-center leading-tight">
        <p class="text-mini font-extrabold text-white">{$t(a.label)}</p>
        <p class="text-[8px] text-white/45 mt-0.5">{$t(a.sub)}</p>
      </div>
    </button>
  {/each}
</div>
