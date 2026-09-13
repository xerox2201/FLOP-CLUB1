<script lang="ts">
  export let rank: string = 'A';
  export let suit: '♠' | '♥' | '♦' | '♣' = '♠';
  export let size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let rotation: number = 0;

  $: isRed = suit === '♥' || suit === '♦';

  const sizeClasses: Record<string, string> = {
    xs: 'w-5 h-7 text-[8px] rounded',
    sm: 'w-7 h-10 text-[10px] rounded-md',
    md: 'w-11 h-[60px] text-base rounded-md',
    lg: 'w-14 h-20 text-xl rounded-lg',
  };

  $: sizeCls = sizeClasses[size] || sizeClasses.md;
</script>

<div
  class="{sizeCls} bg-white flex flex-col items-center justify-center font-bold leading-none {isRed ? 'text-red-600' : 'text-black'}"
  style="
    transform: rotate({rotation}deg);
    box-shadow: 0 3px 8px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.1);
    border: 1px solid rgba(0,0,0,0.15);
  "
>
  <span class="leading-none">{rank}</span>
  <span class="leading-none text-[1.35em]">{suit}</span>
</div>