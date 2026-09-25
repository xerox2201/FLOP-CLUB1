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

<div class="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
  <button
    on:click={onOpenWallet}
    aria-label="Open Wallet"
    class="rounded-full pl-1.5 pr-3 py-1 flex items-center gap-2 active:scale-95 transition"
    style="background: linear-gradient(180deg, rgba(139,92,246,0.2), rgba(109,40,217,0.1)); border: 1px solid rgba(139,92,246,0.35);"
  >
    <div class="w-8 h-8 rounded-full flex items-center justify-center badge-gold">
      <Icon name="dollar" size={16} color="#0a0800" />
    </div>
    <span class="font-extrabold text-sm text-white tabular-nums">
      ${Number((wallet as any)?.balance_usd || 0).toFixed(2)}
    </span>
    <span
      class="w-5 h-5 rounded-full border border-gold/60 text-gold flex items-center justify-center text-sm leading-none font-bold"
    >
      +
    </span>
  </button>

  <div class="flex items-center gap-2">
    <span class="font-bold text-sm max-w-[80px] truncate text-white/90">
      {user?.display_name || 'Player'}
    </span>
    <Avatar {avatarId} size="md" showOnline={true} />
  </div>

  <button
    on:click={onOpenSettings}
    aria-label="Open Settings"
    class="w-10 h-10 rounded-full flex items-center justify-center text-white/80 active:scale-95 transition"
    style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
  >
    <Icon name="settings" size={18} />
  </button>
</div>
