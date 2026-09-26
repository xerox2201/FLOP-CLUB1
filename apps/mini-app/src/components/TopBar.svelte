<script lang="ts">
  import { auth } from '../stores/auth';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  export let onOpenSettings: () => void = () => {};
  export let onOpenWallet: () => void = () => {};

  $: user = $auth.user;
  $: wallet = $auth.wallet;
  $: avatarId = (user as any)?.avatar_id || 'spade';
</script>

<div class="flex items-center gap-2 px-1 pt-3 pb-1">
  <!-- Logo -->
  <img
    src="/logo-flop-club.png"
    alt="Flop Club"
    class="w-9 h-9 object-contain shrink-0"
    style="filter: drop-shadow(0 2px 10px rgba(212,175,55,0.5));"
    draggable="false"
  />

  <!-- Wallet pill -->
  <button
    on:click={onOpenWallet}
    aria-label="Open Wallet"
    class="rounded-full pl-1.5 pr-2.5 py-1 flex items-center gap-1.5 active:scale-95 transition shrink-0"
    style="background: linear-gradient(180deg, rgba(139,92,246,0.2), rgba(109,40,217,0.1)); border: 1px solid rgba(139,92,246,0.35);"
  >
    <div class="w-7 h-7 rounded-full flex items-center justify-center badge-gold shrink-0">
      <Icon name="dollar" size={14} color="#0a0800" />
    </div>
    <span class="font-extrabold text-[13px] text-white tabular-nums">
      ${Number((wallet as any)?.balance_usd || 0).toFixed(2)}
    </span>
    <span
      class="w-4 h-4 rounded-full border border-gold/60 text-gold flex items-center justify-center text-[10px] leading-none font-bold shrink-0"
    >
      +
    </span>
  </button>

  <!-- Spacer (flexible) -->
  <div class="flex-1 min-w-0"></div>

  <!-- User -->
  <div class="flex items-center gap-1.5 shrink-0">
    <span class="font-bold text-[12px] max-w-[64px] truncate text-white/90">
      {user?.display_name || 'Player'}
    </span>
    <Avatar {avatarId} size="sm" showOnline={true} />
  </div>

  <!-- Settings -->
  <button
    on:click={onOpenSettings}
    aria-label="Open Settings"
    class="w-9 h-9 rounded-full flex items-center justify-center text-white/80 active:scale-95 transition shrink-0"
    style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
  >
    <Icon name="settings" size={16} />
  </button>
</div>
