<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import TopBar from '../components/TopBar.svelte';

  let activeTab: 'deposit' | 'withdraw' | 'history' = 'deposit';
  let balance = 0;
  let freeChips = 0;
  let tonStats = { deposited: 0, withdrawn: 0 };
  let hotWalletReady = false;
  let depositInfo: any = null;
  let withdrawStatus: any = null;
  let history: any = { tonTransactions: [], ledgerTransactions: [] };
  let loading = true;
  let error = '';
  let successMsg = '';
  let withdrawAmount = '';
  let withdrawAddress = '';
  let withdrawing = false;
  let walletConnected = false;
  let walletAddress: string | null = null;

  function fmt(n: any, decimals = 2): string {
    return Number(Number(n || 0).toFixed(decimals)).toFixed(decimals);
  }

  async function loadAll() {
    loading = true;
    error = '';
    try {
      const [bal, dep, stat, hist] = await Promise.all([
        api.walletBalance(),
        api.walletDepositInfo(),
        api.request<any>('/api/wallet/withdraw-status'),
        api.walletHistory(),
      ]);
      if (bal.ok && bal.data) {
        const d = bal.data as any;
        balance = d.balance || 0;
        freeChips = d.freeChips || 0;
        tonStats = d.ton || { deposited: 0, withdrawn: 0 };
        hotWalletReady = !!d.hotWalletReady;
      }
      if (dep.ok && dep.data) depositInfo = dep.data;
      if (stat.ok && stat.data) withdrawStatus = stat.data;
      if (hist.ok && hist.data) history = hist.data;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function connectWallet() {
    try {
      const tc = (window as any).tonConnectUI;
      if (!tc) {
        error = 'TON Connect not loaded';
        setTimeout(() => (error = ''), 3000);
        return;
      }
      if (tc.connected) await tc.disconnect();
      else await tc.openModal();
    } catch (e: any) {
      error = e.message;
      setTimeout(() => (error = ''), 3000);
    }
  }

  async function doWithdraw() {
    if (!withdrawAddress || !withdrawAmount) return;
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      error = 'Invalid amount';
      setTimeout(() => (error = ''), 3000);
      return;
    }
    withdrawing = true;
    error = '';
    try {
      const res = await api.walletWithdraw(amt, withdrawAddress);
      if (res.ok) {
        successMsg = `✅ Withdraw submitted: ${amt} TON`;
        withdrawAmount = '';
        withdrawAddress = '';
        setTimeout(() => (successMsg = ''), 4000);
        await loadAll();
      } else {
        error = res.error || 'withdraw_failed';
        setTimeout(() => (error = ''), 4000);
      }
    } catch (e: any) {
      error = e.message;
      setTimeout(() => (error = ''), 4000);
    } finally {
      withdrawing = false;
    }
  }

  function copyDepositAddress() {
    if (depositInfo?.depositAddress) {
      navigator.clipboard.writeText(depositInfo.depositAddress);
      successMsg = '📋 Address copied';
      setTimeout(() => (successMsg = ''), 2000);
    }
  }

  function copyMemo() {
    if (depositInfo?.memo) {
      navigator.clipboard.writeText(depositInfo.memo);
      successMsg = '📋 Memo copied';
      setTimeout(() => (successMsg = ''), 2000);
    }
  }

  function useConnectedAddress() {
    if (walletAddress) withdrawAddress = walletAddress;
  }

  function setMaxWithdraw() {
    if (!withdrawStatus) return;
    const max = withdrawStatus.availableBalance;
    const maxTon = Math.floor((max / withdrawStatus.tonPriceUsd) * 1000) / 1000;
    withdrawAmount = String(maxTon);
  }

  onMount(async () => {
    await loadAll();
    const tc = (window as any).tonConnectUI;
    if (tc) {
      tc.onStatusChange((wallet: any) => {
        if (wallet) {
          walletConnected = true;
          walletAddress = wallet.account?.address || null;
        } else {
          walletConnected = false;
          walletAddress = null;
        }
      });
      if (tc.connected) {
        walletConnected = true;
        walletAddress = tc.account?.address || null;
      }
    }
  });

  $: tonNet = tonStats.deposited - tonStats.withdrawn;

  $: estReceive = (() => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || !withdrawStatus) return 0;
    return Math.max(0, amt - withdrawStatus.feeTon);
  })();
</script>

<div class="pb-28">
  <TopBar />

  <div class="flex items-center justify-between mt-3 mb-4 px-4">
    <div>
      <h1 class="text-2xl font-extrabold text-white">💰 Wallet</h1>
      <p class="text-[11px] text-white/50 mt-0.5">Instant · Automatic</p>
    </div>
  </div>

  {#if loading}
    <div class="mx-4 rounded-3xl h-[180px]" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"></div>
  {:else}
    <!-- BALANCE CARD -->
    <div
      class="mx-4 rounded-3xl p-5 mb-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(212,175,55,0.25) 0%, transparent 60%),
          linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
        border: 1.5px solid rgba(212,175,55,0.45);
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.2);
      "
    >
      <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-25 pointer-events-none" style="background: radial-gradient(circle, #d4af37, transparent 70%);"></div>

      <div class="relative">
        <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-1">Real Money Balance</p>

        <div class="flex items-baseline gap-2 mb-2">
          <span
            class="text-5xl font-extrabold tabular-nums leading-none"
            style="
              background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              letter-spacing: -0.03em;
            "
          >
            ${fmt(balance)}
          </span>
        </div>

        {#if withdrawStatus && withdrawStatus.bonusLocked > 0}
          <div class="rounded-xl p-2 mb-3" style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4);">
            <p class="text-[10px] text-amber-300 font-bold">
              🔒 ${fmt(withdrawStatus.bonusLocked)} locked by bonus conditions
            </p>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3 pt-4" style="border-top: 1px solid rgba(212,175,55,0.25);">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base" style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);">🎁</div>
            <div>
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Free Chips</p>
              <p class="text-[14px] font-extrabold text-emerald-400 tabular-nums">{fmt(freeChips, 0)}</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden" style="background: rgba(34,211,238,0.15); border: 1px solid rgba(34,211,238,0.4);">
              <img src="/ton-logo.png" alt="TON" class="w-7 h-7 object-contain" />
            </div>
            <div>
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">TON Net</p>
              <p class="text-[14px] font-extrabold text-cyan tabular-nums">{fmt(tonNet, 4)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- TON CONNECT -->
  <button
    on:click={connectWallet}
    class="mx-4 w-[calc(100%-2rem)] rounded-2xl p-3.5 mb-4 active:scale-[0.98] transition-all flex items-center justify-between relative overflow-hidden"
    style="
      background: {walletConnected ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))' : 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.08))'};
      border: 1.5px solid {walletConnected ? 'rgba(16,185,129,0.45)' : 'rgba(34,211,238,0.4)'};
    "
  >
    <div class="flex items-center gap-3 relative">
      <div class="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden" style="background: {walletConnected ? 'rgba(16,185,129,0.2)' : 'rgba(34,211,238,0.2)'}; border: 1px solid {walletConnected ? 'rgba(16,185,129,0.4)' : 'rgba(34,211,238,0.4)'};">
        <img src="/ton-logo.png" alt="TON" class="w-8 h-8 object-contain" />
      </div>
      <div class="text-left">
        <p class="text-sm font-extrabold text-white">
          {walletConnected ? 'Wallet Connected' : 'Connect TON Wallet'}
        </p>
        {#if walletAddress}
          <p class="text-[10px] text-white/50 font-mono mt-0.5">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</p>
        {:else}
          <p class="text-[10px] text-white/50 mt-0.5">Tap to connect</p>
        {/if}
      </div>
    </div>
    <div class="w-8 h-8 rounded-full flex items-center justify-center relative" style="background: {walletConnected ? 'rgba(16,185,129,0.2)' : 'rgba(34,211,238,0.2)'};">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={walletConnected ? '#6ee7b7' : '#67e8f9'} stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </div>
  </button>

  <!-- TABS -->
  <div class="mx-4 rounded-2xl p-1 grid grid-cols-3 gap-1 mb-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    {#each ['deposit', 'withdraw', 'history'] as tab}
      <button
        on:click={() => (activeTab = tab as any)}
        class="py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider"
        style="
          background: {activeTab === tab ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)' : 'transparent'};
          color: {activeTab === tab ? '#0a0800' : 'rgba(255,255,255,0.6)'};
        "
      >
        {tab}
      </button>
    {/each}
  </div>

  <!-- DEPOSIT -->
  {#if activeTab === 'deposit'}
    {#if !depositInfo}
      <div class="rounded-2xl p-6 text-center mx-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);">
        <p class="text-3xl mb-2">🔒</p>
        <p class="text-white/50 text-sm">Deposits are currently disabled</p>
      </div>
    {:else}
      <div class="mx-4 rounded-2xl p-4 space-y-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);">
        <div>
          <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Network</p>
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.35);">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse"></span>
            <span class="text-[11px] font-extrabold text-cyan uppercase tracking-wider">{depositInfo.network}</span>
          </div>
        </div>

        <div>
          <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Deposit Address</p>
          <div class="flex gap-2">
            <div class="flex-1 rounded-xl p-2.5 font-mono text-[10px] text-white/80 break-all leading-relaxed" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06);">{depositInfo.depositAddress || '—'}</div>
            <button on:click={copyDepositAddress} aria-label="Copy" class="w-11 rounded-xl text-white/70 active:scale-95 flex items-center justify-center text-lg" style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.6)); border: 1px solid rgba(96,165,250,0.3);">📋</button>
          </div>
        </div>

        <div>
          <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Memo (important!)</p>
          <div class="flex gap-2">
            <div class="flex-1 rounded-xl p-2.5 font-mono text-[12px] font-extrabold text-gold break-all" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.3);">{depositInfo.memo}</div>
            <button on:click={copyMemo} aria-label="Copy" class="w-11 rounded-xl text-gold active:scale-95 flex items-center justify-center text-lg" style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1)); border: 1px solid rgba(212,175,55,0.4);">📋</button>
          </div>
        </div>

        <div class="rounded-xl p-3 flex gap-2.5" style="background: linear-gradient(135deg, rgba(212,175,55,0.12), rgba(168,122,21,0.06)); border: 1px solid rgba(212,175,55,0.3);">
          <span class="text-base shrink-0">⚡</span>
          <p class="text-[10px] text-gold leading-relaxed">Deposits are credited <strong class="text-white">automatically</strong> after network confirmation (~15 seconds).</p>
        </div>

        <div class="flex items-center justify-between pt-2" style="border-top: 1px solid rgba(212,175,55,0.1);">
          <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Minimum deposit</span>
          <span class="text-[13px] font-extrabold text-gold tabular-nums">{depositInfo.minDeposit} TON</span>
        </div>
      </div>
    {/if}
  {/if}

  <!-- WITHDRAW -->
   {#if activeTab === 'withdraw'}
    <div class="mx-4 space-y-3">
      {#if !withdrawStatus}
        <p class="text-center text-white/40 py-8">Loading withdraw status…</p>
      {:else}
        <!-- Available -->
        <div class="rounded-2xl p-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1.5px solid rgba(212,175,55,0.25);">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-[9px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Available</p>
              <p class="text-[18px] font-extrabold text-emerald-400 tabular-nums">${fmt(withdrawStatus.availableBalance)}</p>
            </div>
            <div class="text-right">
              <p class="text-[9px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Fee · Min</p>
              <p class="text-[11px] font-extrabold text-white/80 tabular-nums">{withdrawStatus.feeTon} TON · {withdrawStatus.minWithdrawTon} TON</p>
            </div>
          </div>
        </div>

        <!-- Anti-abuse checklist (first withdrawal) -->
        {#if !withdrawStatus.antiAbuse?.alreadyUnlocked}
          {@const a = withdrawStatus.antiAbuse}
          {@const c = a.current}
          {@const r = a.required}
          <div class="rounded-2xl p-4" style="background: linear-gradient(180deg, rgba(139,92,246,0.08), rgba(7,14,27,0.95)); border: 1.5px solid rgba(139,92,246,0.4);">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-base">🔓</span>
              <p class="text-[11px] font-extrabold uppercase tracking-wider flex-1" style="color: #a78bfa;">First Withdrawal Unlock</p>
            </div>

            <div class="space-y-2">
              <div class="flex items-center gap-2.5">
                {#if a.checks.depositOk}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: rgba(16,185,129,0.25); border: 1px solid #10b981;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                {:else}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4);">○</span>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold" style="color: {a.checks.depositOk ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};">Deposit $5+ (total)</p>
                  <p class="text-[9px] tabular-nums" style="color: rgba(255,255,255,0.4);">${fmt(c.lifetimeDepositUsd)} / ${r.minDeposit}</p>
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                {#if a.checks.rakeOk}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: rgba(16,185,129,0.25); border: 1px solid #10b981;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                {:else}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4);">○</span>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold" style="color: {a.checks.rakeOk ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};">Play $0.50+ rake</p>
                  <p class="text-[9px] tabular-nums" style="color: rgba(255,255,255,0.4);">${fmt(c.lifetimeRakeUsd)} / ${r.minRake}</p>
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                {#if a.checks.handsOk}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: rgba(16,185,129,0.25); border: 1px solid #10b981;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                {:else}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4);">○</span>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold" style="color: {a.checks.handsOk ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};">Play 20+ real hands</p>
                  <p class="text-[9px] tabular-nums" style="color: rgba(255,255,255,0.4);">{c.realHandsPlayed} / {r.minHands}</p>
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                {#if a.checks.accountAgeOk}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: rgba(16,185,129,0.25); border: 1px solid #10b981;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                {:else}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4);">○</span>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold" style="color: {a.checks.accountAgeOk ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};">Account age 24h+</p>
                  <p class="text-[9px] tabular-nums" style="color: rgba(255,255,255,0.4);">{c.accountAgeHours}h / {r.minAccountAgeH}h</p>
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                {#if a.checks.depositAgeOk}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: rgba(16,185,129,0.25); border: 1px solid #10b981;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </span>
                {:else}
                  <span class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.4);">○</span>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold" style="color: {a.checks.depositAgeOk ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};">Deposit age 6h+</p>
                  <p class="text-[9px] tabular-nums" style="color: rgba(255,255,255,0.4);">{c.depositAgeHours}h / {r.minDepositAgeH}h</p>
                </div>
              </div>
            </div>

            <p class="text-[10px] text-white/50 leading-relaxed mt-3 pt-3" style="border-top: 1px solid rgba(139,92,246,0.2);">
              ℹ️ These conditions prevent abuse. Once met, withdrawals are unlocked forever.
            </p>
          </div>
        {/if}

        <!-- Bonus conditions (باقیمونده) -->
        {#if !withdrawStatus.bonusConditionsMet}
          <div class="rounded-2xl p-3.5" style="background: rgba(245,158,11,0.12); border: 1.5px solid rgba(245,158,11,0.4);">
            <p class="text-[11px] font-extrabold text-amber-300 mb-2">🔒 Bonus conditions</p>
            <div class="space-y-1 text-[10px] text-amber-200/90">
              {#if withdrawStatus.conditions.playthroughRemaining > 0}
                <p>• Playthrough: ${fmt(withdrawStatus.conditions.playthroughRemaining)}</p>
              {/if}
              {#if withdrawStatus.conditions.rakeRemaining > 0}
                <p>• Rake: ${fmt(withdrawStatus.conditions.rakeRemaining)}</p>
              {/if}
              {#if withdrawStatus.conditions.handsRemaining > 0}
                <p>• Hands: {withdrawStatus.conditions.handsRemaining}</p>
              {/if}
              {#if withdrawStatus.conditions.waitDaysRemaining > 0}
                <p>• Wait: {withdrawStatus.conditions.waitDaysRemaining} days</p>
              {/if}
            </div>
          </div>
        {/if}

        {#if !withdrawStatus.hotWalletReady}
          <div class="rounded-xl p-3 text-center" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);">
            <p class="text-[11px] text-red-300 font-bold">⚠️ Withdrawals temporarily disabled</p>
          </div>
        {/if}

        <!-- Withdraw form (disabled until conditions met) -->
        <div class="rounded-2xl p-4 space-y-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);">
          <div>
            <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">To Address</p>
            <div class="flex gap-2">
              <input type="text" bind:value={withdrawAddress} placeholder="EQ..." disabled={!withdrawStatus.canWithdraw} class="flex-1 rounded-xl p-3 text-sm text-white border outline-none font-mono disabled:opacity-50" style="background: rgba(0,0,0,0.4); border-color: rgba(212,175,55,0.2);" />
              {#if walletAddress}
                <button on:click={useConnectedAddress} disabled={!withdrawStatus.canWithdraw} class="px-3 rounded-xl text-[10px] font-extrabold text-gold active:scale-95 disabled:opacity-50" style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1)); border: 1px solid rgba(212,175,55,0.4);">USE</button>
              {/if}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold">Amount (TON)</p>
              <button on:click={setMaxWithdraw} disabled={!withdrawStatus.canWithdraw} class="text-[10px] font-extrabold text-gold active:opacity-70 disabled:opacity-40">MAX</button>
            </div>
            <input type="text" inputmode="decimal" bind:value={withdrawAmount} placeholder="0.0" disabled={!withdrawStatus.canWithdraw} class="w-full rounded-xl p-3 text-2xl font-extrabold border outline-none tabular-nums disabled:opacity-50" style="background: rgba(0,0,0,0.4); border-color: rgba(212,175,55,0.3); color: #f4e5a8; text-shadow: 0 0 8px rgba(212,175,55,0.4);" />
          </div>

          <div class="grid grid-cols-4 gap-1.5">
            {#each [0.1, 0.5, 1, 5] as v}
              <button on:click={() => (withdrawAmount = String(v))} disabled={!withdrawStatus.canWithdraw} class="py-2 rounded-lg text-[11px] font-extrabold text-white/85 active:scale-95 disabled:opacity-40" style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.6)); border: 1px solid rgba(96,165,250,0.3);">{v}</button>
            {/each}
          </div>

          {#if withdrawAmount && parseFloat(withdrawAmount) > 0}
            {@const amt = parseFloat(withdrawAmount)}
            {@const usd = amt * withdrawStatus.tonPriceUsd}
            <div class="rounded-xl p-3 space-y-2" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(212,175,55,0.15);">
              <div class="flex justify-between text-[11px]"><span class="text-white/50">Requested</span><span class="text-white/85 font-bold tabular-nums">{amt} TON · ${fmt(usd)}</span></div>
              <div class="flex justify-between text-[11px]"><span class="text-white/50">Fee</span><span class="text-red-300 tabular-nums">{withdrawStatus.feeTon} TON</span></div>
              <div style="height: 1px; background: rgba(212,175,55,0.15);"></div>
              <div class="flex justify-between text-[13px]">
                <span class="text-white/70 font-bold">You receive</span>
                <span class="text-emerald-400 font-extrabold tabular-nums">~{estReceive.toFixed(4)} TON</span>
              </div>
            </div>
          {/if}

          <button on:click={doWithdraw} disabled={withdrawing || !withdrawStatus.canWithdraw || !withdrawAmount || !withdrawAddress} class="btn-gold w-full disabled:opacity-40" style="padding: 14px; font-size: 14px;">
            {withdrawing ? 'Sending…' : withdrawStatus.canWithdraw ? '⚡ Withdraw Instantly' : '🔒 Locked'}
          </button>

          <p class="text-[10px] text-white/40 text-center font-mono">Automated · Instant · Flat {withdrawStatus.feeTon} TON fee</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- HISTORY -->
  {#if activeTab === 'history'}
    {#if history.tonTransactions.length === 0}
      <div class="rounded-2xl p-6 text-center mx-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);">
        <div class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl" style="background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.08)); border: 1px solid rgba(212,175,55,0.3);">📜</div>
        <p class="text-white/60 text-sm font-bold">No transactions yet</p>
        <p class="text-white/40 text-[11px] mt-1">Your history will appear here</p>
      </div>
    {:else}
      <div class="space-y-2 px-4">
        {#each history.tonTransactions as tx}
          {@const isDep = tx.direction === 'deposit'}
          {@const sc = tx.status === 'confirmed' ? '#10b981' : (tx.status === 'pending' || tx.status === 'processing') ? '#f59e0b' : '#ef4444'}
          <div class="rounded-2xl p-3.5 flex items-center justify-between" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.12);">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl flex items-center justify-center text-lg" style="background: {isDep ? 'linear-gradient(180deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))' : 'linear-gradient(180deg, rgba(212,175,55,0.25), rgba(168,122,21,0.15))'}; border: 1px solid {isDep ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.4)'};">{isDep ? '⬇️' : '⬆️'}</div>
              <div>
                <p class="text-sm font-extrabold tabular-nums" style="color: {isDep ? '#6ee7b7' : '#d4af37'};">{isDep ? '+' : '-'}{fmt(tx.amountTon, 4)} TON</p>
                <p class="text-[10px] text-white/40 mt-0.5">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <span class="text-[9px] px-2 py-1 rounded-full font-extrabold uppercase tracking-wider" style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;">{tx.status}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if successMsg}
    <div class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%]" style="background: linear-gradient(180deg, rgba(6,78,59,0.95), rgba(5,150,105,0.9)); border: 1px solid rgba(16,185,129,0.6);">
      <p class="text-xs font-extrabold text-emerald-100">{successMsg}</p>
    </div>
  {/if}

  {#if error}
    <div class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%]" style="background: linear-gradient(180deg, rgba(153,27,27,0.95), rgba(127,29,29,0.9)); border: 1px solid rgba(239,68,68,0.6);">
      <p class="text-xs font-extrabold text-red-100">{error}</p>
    </div>
  {/if}
</div>