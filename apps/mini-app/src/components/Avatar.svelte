<script lang="ts">
  import { getAvatar } from '../lib/avatars';

  export let avatarId: string = 'spade';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let showOnline: boolean = false;

  $: av = getAvatar(avatarId);

  const sizeClass = {
    sm: 'w-8 h-8 text-base',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
    xl: 'w-24 h-24 text-5xl',
  }[size];
</script>

<div class="relative inline-block">
  <div class="{sizeClass} rounded-full bg-gradient-to-br {av.gradient} flex items-center justify-center border-2 border-white/10 shadow-card">
    <span>{av.emoji}</span>
  </div>
  {#if showOnline}
    <span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-good rounded-full border-2 border-base"></span>
  {/if}
</div>