<script lang="ts">
  import { auth } from '../stores/auth';
  import Avatar from './Avatar.svelte';

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
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center text-near-black font-extrabold text-sm badge-gold"
    >
      $
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </button>
</div>