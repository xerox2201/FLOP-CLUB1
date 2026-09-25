<script lang="ts">
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import Icon from './Icon.svelte';

  export let open = false;
  export let availableXp = 0;
  export let level = 1;
  export let onClose: () => void = () => {};

  let amount = 5000;
  let busy = false;
  let error = '';
  let success = false;

  const MIN_XP = 5000;
  const STEP = 1000;

  $: maxXp = Math.floor((availableXp ?? 0) / STEP) * STEP;
  $: canSubmit = !busy && level >= 5 && amount >= MIN_XP && amount <= maxXp && amount % STEP === 0;
  $: usdValue = (amount / 1000).toFixed(2);

  $: if (open) {
    busy = false;
    error = '';
    success = false;
    amount = Math.min(MIN_XP, maxXp) || MIN_XP;
  }

  async function convert() {
    if (!canSubmit) return;
    busy = true;
    error = '';
    try {
      const res = await api.request<{ ok: boolean; usd: number }>('/api/xp/convert', {
        method: 'POST',
        body: JSON.stringify({ xp: amount }),
      });
      if (res.ok) {
        success = true;
        await auth.refresh();
        setTimeout(() => onClose(), 1800);
      } else {
        error = res.error || 'convert_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      busy = false;
    }
  }

  function setPreset(p: number) {
    amount = Math.max(MIN_XP, Math.min(maxXp, Math.floor((maxXp * p) / STEP) * STEP));
  }
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>
  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] rounded-3xl p-5 w-[90%] max-w-[380px]"
    style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1.5px solid rgba(139,92,246,0.5); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <div class="flex items-center gap-2 mb-4">
      <Icon name="gem" size={24} />
      <h2 class="text-base font-extrabold text-white flex-1">Cash Out XP</h2>
      <button
        on:click={onClose}
        class="w-8 h-8 rounded-xl flex items-center justify-center text-white/60"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={14} />
      </button>
    </div>

    {#if level < 5}
      <div
        class="rounded-xl p-3 mb-4"
        style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4);"
      >
        <p class="text-[11px] text-amber-300 font-bold flex items-center gap-1">
          <Icon name="warning" size={12} color="#fcd34d" />
          <span>Level 5 مورد نیازه (الان Level {level})</span>
        </p>
      </div>
    {:else if maxXp < MIN_XP}
      <div
        class="rounded-xl p-3 mb-4"
        style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4);"
      >
        <p class="text-[11px] text-amber-300 font-bold flex items-center gap-1">
          <Icon name="warning" size={12} color="#fcd34d" />
          <span>حداقل ۵۰۰۰ XP برای برداشت لازمه (الان {availableXp.toLocaleString()} XP)</span>
        </p>
      </div>
    {/if}

    <div
      class="rounded-2xl p-4 mb-4"
      style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.3);"
    >
      <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2">Amount (XP)</p>
      <div class="flex items-center gap-2">
        <input
          type="number"
          bind:value={amount}
          min={MIN_XP}
          step={STEP}
          max={maxXp}
          class="flex-1 bg-transparent text-2xl font-extrabold text-white tabular-nums outline-none"
        />
        <span class="text-[11px] text-white/40">XP</span>
      </div>
      <p class="text-[11px] text-white/50 mt-2">
        = <span class="font-extrabold text-emerald-400">${usdValue}</span>
      </p>
    </div>

    <div class="grid grid-cols-3 gap-2 mb-4">
      {#each [{ p: 0.25, l: '25%' }, { p: 0.5, l: '50%' }, { p: 1, l: 'MAX' }] as o}
        <button
          on:click={() => setPreset(o.p)}
          class="rounded-xl py-2 text-[11px] font-extrabold active:scale-95"
          style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.4); color: #c4b5fd;"
          >{o.l}</button
        >
      {/each}
    </div>

    <p class="text-[10px] text-white/40 mb-3 text-center leading-relaxed">
      Min 5,000 XP · Max 50,000 XP/month · Once per 24h<br />
      ⚠️ Level change نمی‌کنه (XP از lifetime حساب می‌شه)
    </p>

    {#if success}
      <div
        class="rounded-xl p-3 text-center"
        style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.5);"
      >
        <p
          class="text-[12px] font-extrabold text-emerald-300 flex items-center gap-1 justify-center"
        >
          <Icon name="success" size={14} color="#6ee7b7" />
          <span>${usdValue} added to wallet</span>
        </p>
      </div>
    {:else}
      <button
        on:click={convert}
        disabled={!canSubmit}
        class="w-full rounded-xl py-3 text-[13px] font-extrabold active:scale-[0.98] disabled:opacity-40"
        style="background: linear-gradient(180deg, #a78bfa, #6d28d9); color: white; box-shadow: 0 3px 0 #4c1d95;"
        >{busy ? 'Processing…' : `Convert ${amount.toLocaleString()} XP`}</button
      >
      {#if error}<p class="text-[11px] text-red-300 text-center mt-3">{error}</p>{/if}
    {/if}
  </div>
{/if}
