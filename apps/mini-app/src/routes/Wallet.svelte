<script lang="ts">
  import { auth } from '../stores/auth';
  import { t } from '../i18n';
  import TopBar from '../components/TopBar.svelte';

  let activeTab: 'deposit' | 'withdraw' = 'deposit';

  $: wallet = $auth.wallet;
  $: balance = Number(wallet?.balance_usd || 0);

  function fmt(n: any): string {
    return Number(Number(n).toFixed(2)).toFixed(2);
  }
</script>

<div class="px-4 pb-28">
  <TopBar />
  <h1 class="text-2xl font-extrabold mt-3 mb-5">{$t('wallet.title')}</h1>

  <div class="relative rounded-3xl overflow-hidden mb-6 shadow-card">
    <div class="absolute inset-0 bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-900"></div>
    <div class="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10"></div>
    <div class="absolute -left-6 -bottom-10 w-32 h-32 rounded-full bg-black/10"></div>
    <div class="relative p-6">
      <p class="text-black/60 text-xs font-semibold uppercase tracking-wider">{$t('wallet.totalBalance')}</p>
      <p class="text-5xl font-extrabold text-black mt-1">${fmt(balance)}</p>
      <p class="text-black/60 text-xs mt-1">≈ {fmt(balance)} USDT</p>
    </div>
  </div>

  <div class="glass rounded-2xl p-1 flex gap-1 mb-5">
    <button on:click={() => activeTab = 'deposit'} class="flex-1 py-2 rounded-xl text-sm font-bold transition {activeTab === 'deposit' ? 'bg-emerald-500 text-white' : 'text-white/70'}">↓ {$t('wallet.deposit')}</button>
    <button on:click={() => activeTab = 'withdraw'} class="flex-1 py-2 rounded-xl text-sm font-bold transition {activeTab === 'withdraw' ? 'bg-gold text-black' : 'text-white/70'}">↑ {$t('wallet.withdraw')}</button>
  </div>

  <div class="card mb-5">
    {#if activeTab === 'deposit'}
      <p class="text-xs text-white/50 mb-3">{$t('wallet.chooseAsset')}</p>
      <div class="space-y-2 mb-4">
        <button class="w-full glass rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition">
          <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg">T</div>
          <div class="flex-1 text-left"><p class="font-bold text-sm">TON</p><p class="text-[10px] text-white/50">The Open Network</p></div>
          <span class="text-gold">→</span>
        </button>
        <button class="w-full glass rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition">
          <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-lg">₮</div>
          <div class="flex-1 text-left"><p class="font-bold text-sm">USDT</p><p class="text-[10px] text-white/50">Tether</p></div>
          <span class="text-gold">→</span>
        </button>
      </div>
      <p class="text-[10px] text-white/40 text-center">{$t('wallet.depositNote')}</p>
    {:else}
      <p class="text-xs text-white/50 mb-3">{$t('wallet.withdrawTo')}</p>
      <div class="space-y-3">
        <div>
          <label for="w-addr" class="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1 block">{$t('wallet.address')}</label>
          <input id="w-addr" type="text" placeholder="UQ..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-gold" />
        </div>
        <div>
          <label for="w-amt" class="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1 block">{$t('wallet.amount')}</label>
          <input id="w-amt" type="number" step="0.01" placeholder="0.00" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gold" />
        </div>
        <div class="flex justify-between text-[10px] text-white/40">
          <span>{$t('wallet.minWithdraw')}: $10</span>
          <span>{$t('wallet.fee')}: ~$0.5</span>
        </div>
        <button class="w-full btn-gold disabled:opacity-40" disabled>{$t('wallet.comingSoon')}</button>
      </div>
    {/if}
  </div>

  <h2 class="text-lg font-bold mb-3">{$t('wallet.history')}</h2>
  <div class="card text-center py-8">
    <p class="text-white/40 text-sm">{$t('wallet.noTx')}</p>
  </div>
</div>