<script lang="ts">
  import Icon from './Icon.svelte';

  export let progress: any = null;
  export let onOpen: () => void = () => {};

  $: level = progress?.level ?? 1;
  $: xpInto = progress?.xpIntoLevel ?? 0;
  $: xpNext = progress?.xpForNextLevel ?? 100;
  $: xpPct = xpNext > 0 ? Math.min(100, (xpInto / xpNext) * 100) : 0;
  $: tierLabel = progress?.tierLabel ?? 'Welcome';
  $: tierIcon = progress?.tierIcon ?? '🌱';
  $: tierColor = progress?.tierColor ?? '#6ee7b7';
  $: rakebackPct = Math.round((progress?.rakebackPct ?? 0) * 100);
  $: progressToNextTier = Math.round((progress?.progressToNextTier ?? 0) * 100);
</script>

{#if progress}
  <div class="px-4 mb-4">
    <button
      on:click={onOpen}
      class="w-full rounded-2xl p-3.5 text-left relative overflow-hidden active:scale-[0.98] transition-all"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, {tierColor}15 0%, transparent 60%),
          linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
        border: 1px solid {tierColor}40;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <!-- Header row -->
      <div class="flex items-center gap-2 mb-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: linear-gradient(180deg, {tierColor}30, {tierColor}10);
            border: 1.5px solid {tierColor}60;
          "
        >
          <span class="text-base leading-none">{tierIcon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-[10px] text-white/45 uppercase tracking-widest font-bold leading-none mb-1"
          >
            Your Progress
          </p>
          <p class="text-[13px] font-extrabold text-white leading-none">
            Level {level}
            <span class="text-white/40 font-bold mx-1">·</span>
            <span style="color: {tierColor};">{tierLabel}</span>
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold leading-none mb-1">
            Rakeback
          </p>
          <p
            class="text-[14px] font-extrabold tabular-nums leading-none"
            style="color: {tierColor};"
          >
            {rakebackPct}%
          </p>
        </div>
      </div>

      <!-- XP bar -->
      <div class="mb-2">
        <div class="flex justify-between items-center mb-1">
          <span class="text-[9px] text-white/50 font-bold uppercase tracking-wider">
            XP · Level {level}
          </span>
          <span class="text-[9px] text-white/60 font-bold tabular-nums">
            {xpInto.toLocaleString()} / {xpNext.toLocaleString()}
          </span>
        </div>
        <div
          class="w-full h-1.5 rounded-full overflow-hidden"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {xpPct}%;
              background: linear-gradient(90deg, #c4b5fd, #8b5cf6 50%, #6d28d9);
              box-shadow: 0 0 8px rgba(139,92,246,0.6);
            "
          ></div>
        </div>
      </div>

      <!-- Tier bar -->
      <div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-[9px] text-white/50 font-bold uppercase tracking-wider">
            Tier Progress
          </span>
          <span class="text-[9px] font-bold tabular-nums" style="color: {tierColor};">
            {progressToNextTier}%
          </span>
        </div>
        <div
          class="w-full h-1.5 rounded-full overflow-hidden"
          style="background: rgba(0,0,0,0.55);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {progressToNextTier}%;
              background: linear-gradient(90deg, {tierColor}, {tierColor}aa);
              box-shadow: 0 0 8px {tierColor}80;
            "
          ></div>
        </div>
      </div>

      <!-- Footer hint -->
      <div class="flex items-center justify-end gap-1 mt-2.5">
        <span class="text-[9px] font-extrabold" style="color: {tierColor};"> View details </span>
        <Icon name="arrow-right" size={10} color={tierColor} />
      </div>
    </button>
  </div>
{/if}
