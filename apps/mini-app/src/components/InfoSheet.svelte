<script lang="ts">
  import Icon from './Icon.svelte';

  export let open: boolean = false;
  export let title: string = '';
  export let icon: string = 'ℹ️';
  export let onClose: () => void = () => {};
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(5,8,15,0.85); backdrop-filter: blur(8px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed bottom-0 left-0 right-0 z-[100] mx-auto flex flex-col rounded-t-3xl sheet-in"
    style="
      max-width: 520px;
      max-height: 70vh;
      background: linear-gradient(180deg, rgba(15,31,58,0.99), rgba(7,14,27,1));
      border-top: 1.5px solid rgba(212,175,55,0.4);
      box-shadow: 0 -12px 40px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.15);
      padding-bottom: env(safe-area-inset-bottom);
    "
  >
    <!-- Drag handle -->
    <div
      class="w-12 h-1 rounded-full mx-auto mt-2 mb-1 shrink-0"
      style="background: rgba(212,175,55,0.4);"
    ></div>

    <!-- Header -->
    <div
      class="flex items-center gap-3 px-5 py-3 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.08)); border: 1px solid rgba(212,175,55,0.4);"
      >
        {icon}
      </div>
      <h2 class="text-base font-extrabold text-white flex-1 leading-tight">{title}</h2>
      <button
        on:click={onClose}
        aria-label="Close"
        class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 active:scale-95"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={12} color="rgba(255,255,255,0.6)" />
      </button>
    </div>

    <!-- Content -->
    <div
      class="flex-1 overflow-y-auto no-scrollbar px-5 py-4 text-[12px] text-white/80 leading-relaxed"
    >
      <slot />
    </div>

    <!-- Footer button -->
    <div class="px-5 py-3 shrink-0" style="border-top: 1px solid rgba(212,175,55,0.15);">
      <button
        on:click={onClose}
        class="w-full rounded-2xl py-3 text-[12px] font-extrabold tracking-wider active:scale-[0.98] transition"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.5);"
      >
        فهمیدم
      </button>
    </div>
  </div>
{/if}

<style>
  @keyframes sheet-in-kf {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .sheet-in {
    animation: sheet-in-kf 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
