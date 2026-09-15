<script lang="ts">
  import Avatar from './Avatar.svelte';

  export let open: boolean = false;
  export let player: any = null;
  export let myUserId: number | null = null;
  export let onClose: () => void = () => {};
  export let onMute: (userId: number) => void = () => {};

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  $: isMe = player?.userId === myUserId;
</script>

{#if open && player}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] rounded-3xl p-5 w-[90%] max-w-[360px]"
    style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1px solid rgba(139,92,246,0.35); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <!-- Avatar + name -->
    <div class="flex items-center gap-3 mb-4">
      <div
        class="rounded-full p-[3px]"
        style="border: 2.5px solid {isMe ? '#f4c95d' : 'rgba(139,92,246,0.6)'};"
      >
        <div class="w-14 h-14 rounded-full overflow-hidden">
          <Avatar avatarId={player.avatarId || 'spade'} size="md" />
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-lg font-extrabold text-white truncate">
            {player.displayName}
          </p>
          {#if isMe}
            <span
              class="text-[9px] font-bold text-gold px-1.5 py-0.5 rounded-full"
              style="background: rgba(244,201,93,0.2);"
            >
              YOU
            </span>
          {/if}
        </div>
        <p class="text-[10px] text-white/40 font-mono">
          Seat {player.seat}
          {#if player.dealer}· D{/if}
        </p>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <div
        class="rounded-xl p-3 text-center"
        style="background: linear-gradient(135deg, rgba(244,201,93,0.15), rgba(168,121,34,0.05)); border: 1px solid rgba(244,201,93,0.3);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Stack</p>
        <p class="text-lg font-extrabold text-gold tabular-nums">
          ${fmt(player.stack)}
        </p>
      </div>
      <div
        class="rounded-xl p-3 text-center"
        style="background: rgba(16,26,58,0.6); border: 1px solid rgba(139,92,246,0.2);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Bet This Street</p>
        <p class="text-lg font-extrabold text-cyan tabular-nums">
          ${fmt(player.betThisStreet || 0)}
        </p>
      </div>
    </div>

    <!-- Status badges -->
    <div class="flex flex-wrap gap-2 mb-4">
      {#if player.folded}
        <span
          class="text-[10px] font-bold px-2 py-1 rounded-full"
          style="background: rgba(107,114,128,0.3); color: #9ca3af;"
        >
          FOLDED
        </span>
      {/if}
      {#if player.allIn}
        <span
          class="text-[10px] font-bold px-2 py-1 rounded-full"
          style="background: rgba(239,68,68,0.25); color: #fca5a5;"
        >
          ALL-IN
        </span>
      {/if}
      {#if !player.folded && !player.allIn}
        <span
          class="text-[10px] font-bold px-2 py-1 rounded-full"
          style="background: rgba(16,185,129,0.2); color: #6ee7b7;"
        >
          ACTIVE
        </span>
      {/if}
    </div>

    <!-- Actions -->
    <div class="grid grid-cols-2 gap-2">
      {#if !isMe}
        <button
          on:click={() => {
            onMute(player.userId);
            onClose();
          }}
          class="rounded-xl py-2.5 text-xs font-bold text-white/70 active:scale-[0.98]"
          style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);"
        >
          🔇 Mute
        </button>
      {/if}
      <button
        on:click={onClose}
        class="rounded-xl py-2.5 text-xs font-bold text-white/70 active:scale-[0.98] {isMe
          ? 'col-span-2'
          : ''}"
        style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);"
      >
        Close
      </button>
    </div>
  </div>
{/if}
