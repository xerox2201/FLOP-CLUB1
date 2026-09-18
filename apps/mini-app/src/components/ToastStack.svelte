<script lang="ts">
  import { notifications, dismissNotif } from '../lib/notifications';
</script>

<div
  class="fixed left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-[380px] space-y-2 pointer-events-none"
  style="top: max(16px, env(safe-area-inset-top));"
>
  {#each $notifications as n (n.id)}
    <button
      on:click={() => dismissNotif(n.id)}
      class="w-full text-left rounded-2xl p-3 flex items-start gap-3 active:scale-[0.98] transition pointer-events-auto"
      style="background: rgba(8,13,36,0.98); border: 1px solid {n.color}60; box-shadow: 0 8px 24px rgba(0,0,0,0.7), 0 0 24px {n.color}30; backdrop-filter: blur(16px); animation: toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style="background: {n.color}25; border: 1px solid {n.color}60;"
      >
        {n.icon}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-extrabold text-white leading-tight">{n.title}</p>
        {#if n.message}
          <p class="text-[10px] text-white/60 mt-0.5 leading-tight">{n.message}</p>
        {/if}
      </div>
    </button>
  {/each}
</div>

<style>
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>