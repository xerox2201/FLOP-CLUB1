<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import Icon from './Icon.svelte';

  export let open = false;
  export let seed: any = null;
  export let onClose: () => void = () => {};

  let busy = false;
  let error = '';
  let success = false;

  $: if (open && seed) {
    busy = false;
    error = '';
    success = false;
  }

  async function claim() {
    if (!seed || busy) return;
    busy = true;
    error = '';
    try {
      const res = await api.request<{ ok: boolean; amount: number }>('/api/seeds/claim', {
        method: 'POST',
        body: JSON.stringify({ type: seed.type }),
      });
      if (res.ok) {
        success = true;
        await auth.refresh();
        setTimeout(() => onClose(), 1800);
      } else {
        error = res.error || 'claim_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

{#if open && seed}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>
  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] rounded-3xl p-5 w-[90%] max-w-[360px]"
    style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1.5px solid rgba(34,197,94,0.5); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <div class="text-center mb-4">
      <div class="text-5xl mb-2">{seed.icon}</div>
      <h2 class="text-lg font-extrabold text-white">{seed.label}</h2>
      <p class="text-[11px] text-white/50 mt-1">
        {seed.progress.freeHands.toLocaleString()} hands · {seed.progress.freeWins.toLocaleString()} wins
      </p>
    </div>
    <div
      class="rounded-2xl p-4 mb-4 text-center"
      style="background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(5,150,105,0.05)); border: 1px solid rgba(34,197,94,0.4);"
    >
      <p class="text-[10px] text-emerald-300/80 uppercase tracking-wider font-bold mb-1">Reward</p>
      <p class="text-3xl font-extrabold text-emerald-400 tabular-nums">
        ${formatAmount(seed.amount)}
      </p>
      <p class="text-[10px] text-white/50 mt-2 leading-relaxed">
        10x playthrough · $15 rake · 150 real hands · 14 days
      </p>
    </div>
    {#if success}
      <div
        class="rounded-xl p-3 text-center mb-4"
        style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.5);"
      >
        <p
          class="text-[12px] font-extrabold text-emerald-300 flex items-center gap-1 justify-center"
        >
          <Icon name="success" size={14} color="#6ee7b7" />
          <span>Claimed! ${formatAmount(seed.amount)} added</span>
        </p>
      </div>
    {:else}
      <div class="flex gap-2">
        <button
          on:click={onClose}
          disabled={busy}
          class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95"
          style="background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);">Cancel</button
        >
        <button
          on:click={claim}
          disabled={busy}
          class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95 disabled:opacity-40"
          style="background: linear-gradient(180deg, #22c55e, #15803d); color: white; box-shadow: 0 3px 0 #14532d;"
          >{busy ? '…' : 'Claim'}</button
        >
      </div>
      {#if error}<p class="text-[11px] text-red-300 text-center mt-3">{error}</p>{/if}
    {/if}
  </div>
{/if}
