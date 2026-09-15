<script lang="ts">
  import { auth } from '../stores/auth';
  import Avatar from './Avatar.svelte';

  export let onOpenSettings: () => void = () => {};
  export let onOpenWallet: () => void = () => {};

  $: user = $auth.user;
  $: wallet = $auth.wallet;
  $: avatarId = (user as any)?.avatar_id || 'spade';
</script>

<div class="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
  <button
    on:click={onOpenWallet}
    aria-label="Open Wallet"
    class="glass rounded-full pl-2 pr-3 py-1.5 flex items-center gap-2 active:scale-95 transition"
  >
    <div
      class="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-700 flex items-center justify-center text-black font-bold text-sm"
    >
      $
    </div>
    <span class="font-bold text-sm">${Number(wallet?.balance_usd || 0).toFixed(2)}</span>
    <span
      class="w-6 h-6 rounded-full border border-gold text-gold flex items-center justify-center text-lg leading-none"
      >+</span
    >
  </button>

  <div class="flex items-center gap-2">
    <span class="font-semibold text-sm max-w-[80px] truncate">{user?.display_name || 'Player'}</span
    >
    <Avatar {avatarId} size="md" showOnline={true} />
  </div>

  <button
    on:click={onOpenSettings}
    aria-label="Open Settings"
    class="glass rounded-full w-10 h-10 flex items-center justify-center active:scale-95 transition"
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </svg>
  </button>
</div>
