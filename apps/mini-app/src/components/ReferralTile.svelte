<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';

  export let onOpen: () => void = () => {};

  let loading = true;
  let dashboard: any = null;

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  async function load() {
    try {
      const res = await api.request<any>('/api/referral/me');
      if (res.ok && res.data) dashboard = res.data;
    } catch {
      // silent
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

{#if !loading && dashboard}
  <div class="px-4 mb-4">
    <button
      type="button"
      on:click={onOpen}
      class="w-full rounded-2xl p-3.5 relative overflow-hidden active:scale-[0.98] transition-all text-left"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.22) 0%, transparent 60%),
          radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.12) 0%, transparent 60%),
          linear-gradient(135deg, rgba(15,31,58,0.95), rgba(7,14,27,0.98));
        border: 1.5px solid rgba(244,201,93,0.45);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <div class="flex items-center gap-3">
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
            border: 1.5px solid rgba(244,201,93,0.55);
            box-shadow: inset 0 1px 0 rgba(255,235,170,0.3);
          "
        >
          <Icon name="users" size={18} color="#f4c95d" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold">
              Refer Friends
            </p>
            <span
              class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
              style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
            >
              12%
            </span>
          </div>

          {#if dashboard.activeRefs > 0 || dashboard.lifetime > 0}
            <div class="flex items-baseline gap-2">
              <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums leading-none">
                ${fmt(dashboard.lifetime)}
                <span class="text-white/40 font-bold text-[10px]">earned</span>
              </p>
              <span class="text-white/30 text-[10px]">·</span>
              <p class="text-[11px] font-bold text-white/70 tabular-nums">
                {dashboard.activeRefs} active
              </p>
            </div>
          {:else}
            <p class="text-[11px] font-extrabold text-white leading-tight">
              Earn 12% of friends' rake
            </p>
            <p class="text-[9px] text-white/45 mt-0.5">For 12 months · Instant payout</p>
          {/if}
        </div>

        <div class="text-gold shrink-0">
          <Icon name="arrow-right" size={14} color="#f4c95d" />
        </div>
      </div>
    </button>
  </div>
{/if}
