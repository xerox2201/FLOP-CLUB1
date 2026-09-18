<script lang="ts">
  import Avatar from './Avatar.svelte';

  export let avatarId: string = 'king';
  export let selected: string | null = null;
  export let onSelect: (frame: string | null) => void = () => {};

  const FRAMES = [
    { id: 'default', label: 'Default' },
    { id: 'common', label: 'Common' },
    { id: 'rare', label: 'Rare' },
    { id: 'epic', label: 'Epic' },
    { id: 'legendary', label: 'Legendary' },
    { id: 'royal', label: 'Royal' },
    { id: 'special', label: 'Special' },
    { id: 'event', label: 'Event' },
  ];
</script>

<div class="flex gap-3 overflow-x-auto no-scrollbar pb-2">
  {#each FRAMES as f}
    <button
      on:click={() => onSelect(f.id)}
      class="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition"
    >
      <div
        class="rounded-full transition"
        style="
          {selected === f.id
            ? 'box-shadow: 0 0 0 2px #d4af37, 0 0 16px rgba(212,175,55,0.6);'
            : ''}
        "
      >
        <Avatar avatarId={avatarId} size="lg" frame={f.id} />
      </div>
      <span
        class="text-[9px] font-bold"
        style="color: {selected === f.id ? '#f4e5a8' : 'rgba(255,255,255,0.55)'};"
      >
        {f.label}
      </span>
    </button>
  {/each}
</div>