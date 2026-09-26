<script lang="ts">
  import { getAvatar } from '../lib/avatars';

  export let avatarId: string = 'king';
  /** Diameter of the inner avatar circle in px */
  export let size: number = 96;

  $: av = getAvatar(avatarId);
  $: avatarImgSrc = `/avatars/avatar-${avatarId}.png`;

  // Frame image is square; circular opening = ~62% of frame width.
  $: frameSize = size * 1.62;
  $: innerSize = size * 1.0;
</script>

<div class="relative inline-block" style="width: {frameSize}px; height: {frameSize}px;">
  <!-- Avatar circle (fits perfectly inside frame opening) -->
  <div
    class="absolute rounded-full overflow-hidden"
    style="
      width: {innerSize}px;
      height: {innerSize}px;
      top: 52%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, #142d52 0%, #05080f 100%);
    "
  >
    <!-- Image fits exactly inside circle, no zoom, no crop issues -->
    <img
      src={avatarImgSrc}
      alt={avatarId}
      class="w-full h-full select-none"
      style="object-fit: cover; object-position: center center;"
      on:error={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
        (e.currentTarget.parentElement as HTMLElement).innerHTML =
          `<span style="font-size:${size * 0.42}px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${av.emoji}</span>`;
      }}
      draggable="false"
    />
  </div>

  <!-- Frame image on top (gold ring overlaps avatar edge perfectly) -->
  <img
    src="/avatar-frame.webp"
    alt=""
    class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-10"
    draggable="false"
  />
</div>
