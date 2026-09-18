<script lang="ts">
  import { getAvatar } from '../lib/avatars';

  export let avatarId: string = 'king';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let showOnline: boolean = false;
  export let frame: string | null = null; // 'legendary' | 'royal' | 'epic' | 'rare' | 'common' | 'special' | 'event' | 'default' | null

  $: av = getAvatar(avatarId);

  const sizePx = { sm: 32, md: 48, lg: 64, xl: 96 }[size];
  const fontSize = { sm: 16, md: 22, lg: 30, xl: 44 }[size];

  let imgFailed = false;
  $: avatarImgSrc = `/avatars/avatar-${avatarId}.png`;
  $: if (avatarId) imgFailed = false;

  // Frame image size (frame image has built-in padding)
  $: frameSize = Math.round(sizePx * 1.55);
</script>

<div class="relative inline-block" style="width: {frameSize}px; height: {frameSize}px;">
  {#if frame}
    <!-- Frame image as background -->
    <img
      src="/frame-{frame}.png"
      alt=""
      class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-10"
      style="filter: drop-shadow(0 3px 10px rgba(0,0,0,0.5));"
      draggable="false"
    />

    <!-- Avatar centered inside frame -->
    <div
      class="absolute rounded-full overflow-hidden"
      style="
        width: {Math.round(sizePx * 0.98)}px;
        height: {Math.round(sizePx * 0.98)}px;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: radial-gradient(circle, #1a3a5c, #05080f);
      "
    >
      {#if !imgFailed}
        <img
          src={avatarImgSrc}
          alt={avatarId}
          class="w-full h-full object-cover select-none"
          on:error={() => (imgFailed = true)}
          draggable="false"
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center" style="font-size: {fontSize}px;">
          {av.emoji}
        </div>
      {/if}
    </div>
  {:else}
    <!-- No frame version -->
    <div
      class="rounded-full overflow-hidden border-2 border-white/15"
      style="
        width: {sizePx}px;
        height: {sizePx}px;
        background: radial-gradient(circle, #1a3a5c, #05080f);
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "
    >
      {#if !imgFailed}
        <img
          src={avatarImgSrc}
          alt={avatarId}
          class="w-full h-full object-cover select-none"
          on:error={() => (imgFailed = true)}
          draggable="false"
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center" style="font-size: {fontSize}px;">
          {av.emoji}
        </div>
      {/if}
    </div>
  {/if}

  {#if showOnline}
    <span
      class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 z-20"
      style="background: #10b981; border-color: #05080f;"
    ></span>
  {/if}
</div>