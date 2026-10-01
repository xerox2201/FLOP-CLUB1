<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import Missions from '../components/Missions.svelte';

  export let onBack: () => void = () => {};
</script>

<div class="pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="px-4 mt-2 mb-4">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);"
      >
        <Icon name="arrow-left" size={16} color="#ffffff" />
      </button>

      <div class="flex-1 min-w-0">
        <h1
          class="text-[26px] font-extrabold leading-none tracking-tight"
          style="
            background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
          "
        >
          Daily Missions
        </h1>
        <p class="text-[10px] text-white/50 mt-1 font-bold">
          Complete missions, earn chips and XP · resets 00:00 UTC
        </p>
      </div>
    </div>
  </div>

  <!-- MISSION LIST -->
  <Missions showTitle={false} />
</div>
