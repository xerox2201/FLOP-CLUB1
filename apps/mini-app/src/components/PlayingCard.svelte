<script lang="ts">
  export let rank: string = 'A';
  export let suit: '♠' | '♥' | '♦' | '♣' = '♠';
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let rotation: number = 0;

  $: isRed = suit === '♥' || suit === '♦';

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-7 rounded',
    sm: 'w-7 h-10 rounded-md',
    md: 'w-11 h-[60px] rounded-md',
    lg: 'w-[58px] h-[82px] rounded-lg',
  };

  $: sizeCls = sizeClasses[size] || sizeClasses.md;
</script>

<div
  class="{sizeCls} bg-gradient-to-br from-white via-white to-gray-100 flex flex-col items-center justify-center font-bold leading-none relative overflow-hidden {isRed
    ? 'text-red-600'
    : 'text-black'}"
  style="
    transform: rotate({rotation}deg);
    box-shadow: 0 3px 10px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.5);
  "
>
  <!-- Corner top-left -->
  <div class="absolute top-0.5 left-1 flex flex-col items-center leading-none">
    <span class="text-[0.7em] font-extrabold">{rank}</span>
    <span class="text-[0.6em] leading-none">{suit}</span>
  </div>

  <!-- Center suit -->
  <span class="text-[1.6em] leading-none opacity-90">{suit}</span>

  <!-- Corner bottom-right (rotated) -->
  <div class="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180">
    <span class="text-[0.7em] font-extrabold">{rank}</span>
    <span class="text-[0.6em] leading-none">{suit}</span>
  </div>
</div>
