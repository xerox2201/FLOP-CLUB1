<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { AVATARS } from '../lib/avatars';
  import Icon from './Icon.svelte';

  export let open: boolean = false;
  export let avatarId: string = 'king';
  export let frame: string | null = 'royal';
  export let onSelectAvatar: (id: string) => void = () => {};
  export let onSelectFrame: (f: string | null) => void = () => {};
  export let onClose: () => void = () => {};

  let tab: 'avatar' | 'frame' = 'avatar';

  const FRAMES: { id: string | null; label: string }[] = [
    { id: null, label: 'None' },
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

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[85] cursor-default"
    style="background: rgba(5,8,15,0.88); backdrop-filter: blur(6px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] flex flex-col w-[94%] max-w-[440px] rounded-3xl overflow-hidden"
    style="height: 80vh; max-height: 700px; background: linear-gradient(180deg, rgba(15,31,58,0.98), rgba(7,14,27,1)); border: 1.5px solid rgba(212,175,55,0.35); box-shadow: 0 20px 60px rgba(0,0,0,0.95);"
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3.5 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      <h2 class="text-sm font-extrabold text-white flex-1 flex items-center gap-2">
        <Icon name="edit" size={16} />
        <span>Customize</span>
      </h2>
      <button
        on:click={onClose}
        aria-label="Close"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 active:scale-95"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={14} color="rgba(255,255,255,0.6)" />
      </button>
    </div>

    <!-- Tabs -->
    <div
      class="flex shrink-0"
      style="background: rgba(15,31,58,0.98); border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      {#each [['avatar', 'Avatar'], ['frame', 'Frame']] as [k, l]}
        <button
          on:click={() => (tab = k as any)}
          class="flex-1 py-3 text-tiny font-extrabold uppercase tracking-wider"
          style="color: {tab === k
            ? '#f4e5a8'
            : 'rgba(255,255,255,0.4)'}; border-bottom: 2px solid {tab === k
            ? '#d4af37'
            : 'transparent'};"
        >
          {l}
        </button>
      {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar p-4">
      {#if tab === 'avatar'}
        <div class="grid grid-cols-4 gap-3">
          {#each AVATARS as a}
            <button
              on:click={() => onSelectAvatar(a.id)}
              aria-label={a.id}
              class="aspect-square rounded-2xl overflow-hidden transition-all active:scale-95"
              style="
                background: radial-gradient(circle, #1a3a5c, #05080f);
                {avatarId === a.id
                ? 'box-shadow: 0 0 0 2.5px #d4af37, 0 0 20px rgba(212,175,55,0.6);'
                : 'opacity: 0.85;'}
              "
            >
              <img
                src="/avatars/avatar-{a.id}.png"
                alt={a.id}
                class="w-full h-full object-cover"
                draggable="false"
              />
            </button>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-3 gap-3">
          {#each FRAMES as f}
            <button
              on:click={() => onSelectFrame(f.id)}
              class="flex flex-col items-center gap-1.5 active:scale-95 transition p-2 rounded-2xl"
              style="
                background: {frame === f.id ? 'rgba(212,175,55,0.15)' : 'transparent'};
                border: 1.5px solid {frame === f.id ? '#d4af37' : 'transparent'};
              "
            >
              {#if f.id === null}
                <div
                  class="w-16 h-16 rounded-full flex items-center justify-center"
                  style="background: radial-gradient(circle, #1a3a5c, #05080f); border: 1px solid rgba(255,255,255,0.1);"
                >
                  <span class="text-mini font-bold text-white/50">None</span>
                </div>
              {:else}
                <Avatar {avatarId} size="lg" frame={f.id} />
              {/if}
              <span
                class="text-micro font-bold"
                style="color: {frame === f.id ? '#f4e5a8' : 'rgba(255,255,255,0.55)'};"
              >
                {f.label}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
