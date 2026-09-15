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
      const [bal, dep, hist] = await Promise.all([
        api.walletBalance(),
        api.walletDepositInfo(),
        api.walletHistory(),
      ]);

      if (bal.ok && bal.data) {
        balance = bal.data.balance || 0;
        freeChips = bal.data.freeChips || 0;
        tonStats = bal.data.ton || { deposited: 0, withdrawn: 0 };
        hotWalletReady = !!bal.data.hotWalletReady;
      }
      if (dep.ok && dep.data) depositInfo = dep.data;
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
        setTimeout(() => {
          error = '';
        }, 3000);
        return;
      }
      if (tc.connected) {
        await tc.disconnect();
      } else {
        await tc.openModal();
      }
    } catch (e: any) {
      error = e.message;
      setTimeout(() => {
        error = '';
      }, 3000);
    }
  }

  async function doWithdraw() {
    if (!withdrawAddress || !withdrawAmount) return;
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      error = 'Invalid amount';
      setTimeout(() => {
        error = '';
      }, 3000);
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
        setTimeout(() => {
          successMsg = '';
        }, 4000);
        await loadAll();
      } else {
        error = res.error || 'withdraw_failed';
        setTimeout(() => {
          error = '';
        }, 4000);
      }
    } catch (e: any) {
      error = e.message;
      setTimeout(() => {
        error = '';
      }, 4000);
    } finally {
      withdrawing = false;
    }
  }

  function copyDepositAddress() {
    if (depositInfo?.depositAddress) {
      navigator.clipboard.writeText(depositInfo.depositAddress);
      successMsg = '📋 Address copied';
      setTimeout(() => {
        successMsg = '';
      }, 2000);
    }
  }

  function copyMemo() {
    if (depositInfo?.memo) {
      navigator.clipboard.writeText(depositInfo.memo);
      successMsg = '📋 Memo copied';
      setTimeout(() => {
        successMsg = '';
      }, 2000);
    }
  }

  function useConnectedAddress() {
    if (walletAddress) {
      withdrawAddress = walletAddress;
    }
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
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />
  <h1 class="text-2xl font-extrabold mt-3 mb-4">💰 Wallet</h1>

  {#if loading}
    <div class="text-center py-12 text-white/40">Loading…</div>
  {:else}
    <!-- Balance card -->
    <div
      class="rounded-2xl p-4 mb-4 relative overflow-hidden"
      style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.1)); border: 1px solid rgba(139,92,246,0.35); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
    >
      <div
        class="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20"
        style="background: radial-gradient(circle, #8b5cf6, transparent 70%);"
      ></div>

      <div class="text-[10px] uppercase tracking-widest text-white/60 mb-1 font-bold">
        Real Money Balance
      </div>
      <div class="text-4xl font-extrabold text-gold tabular-nums leading-tight">
        ${fmt(balance)}
      </div>
      <div
        class="flex items-center justify-between mt-3 pt-3 text-[11px]"
        style="border-top: 1px solid rgba(139,92,246,0.2);"
      >
        <span class="text-white/50"
          >Free Chips:
          <span class="text-emerald-400 font-bold">{fmt(freeChips, 0)}</span></span
        >
        <span class="text-white/50"
          >TON net:
          <span class="text-cyan font-bold">{fmt(tonStats.deposited - tonStats.withdrawn, 4)}</span
          ></span
        >
      </div>
    </div>

    <!-- TON Connect -->
    <button
      on:click={connectWallet}
      class="w-full rounded-2xl p-3 mb-4 active:scale-[0.98] transition flex items-center justify-between"
      style="background: {walletConnected
        ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))'
        : 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.1))'}; border: 1px solid {walletConnected
        ? 'rgba(34,197,94,0.4)'
        : 'rgba(34,211,238,0.35)'};"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style="background: rgba(0,0,0,0.3);"
        >
          💎
        </div>
        <div class="text-left">
          <p class="text-sm font-bold text-white">
            {walletConnected ? 'Wallet Connected' : 'Connect TON Wallet'}
          </p>
          {#if walletAddress}
            <p class="text-[10px] text-white/50 font-mono">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </p>
          {:else}
            <p class="text-[10px] text-white/50">Tap to connect</p>
          {/if}
        </div>
      </div>
      <span class="text-white/40 text-xl">›</span>
    </button>

    <!-- Tabs -->
    <div
      class="rounded-2xl p-1 flex gap-1 mb-4"
      style="background: rgba(16,26,58,0.6); border: 1px solid rgba(139,92,246,0.2);"
    >
      <button
        on:click={() => (activeTab = 'deposit')}
        class="flex-1 py-2 rounded-xl text-xs font-bold transition {activeTab === 'deposit'
          ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
          : 'text-white/60'}"
      >
        Deposit
      </button>
      <button
        on:click={() => (activeTab = 'withdraw')}
        class="flex-1 py-2 rounded-xl text-xs font-bold transition {activeTab === 'withdraw'
          ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
          : 'text-white/60'}"
      >
        Withdraw
      </button>
      <button
        on:click={() => (activeTab = 'history')}
        class="flex-1 py-2 rounded-xl text-xs font-bold transition {activeTab === 'history'
          ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
          : 'text-white/60'}"
      >
        History
      </button>
    </div>

    <!-- DEPOSIT -->
    {#if activeTab === 'deposit'}
      {#if !depositInfo}
        <div class="card p-6 text-center">
          <p class="text-3xl mb-2">🔒</p>
          <p class="text-white/50 text-sm">Deposits are currently disabled</p>
        </div>
      {:else}
        <div class="card space-y-3">
          <div>
            <div class="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
              Network
            </div>
            <div class="text-sm font-bold text-cyan">
              {depositInfo.network.toUpperCase()}
            </div>
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
              Deposit Address
            </div>
            <div class="flex gap-2">
              <div
                class="flex-1 rounded-lg p-2 font-mono text-[10px] text-white/80 break-all"
                style="background: rgba(0,0,0,0.4);"
              >
                {depositInfo.depositAddress || '—'}
              </div>
              <button
                on:click={copyDepositAddress}
                aria-label="Copy"
                class="px-3 rounded-lg text-white/70 active:scale-95"
                style="background: rgba(139,92,246,0.15);"
              >
                📋
              </button>
            </div>
          </div>

          <div>
            <div class="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
              Memo (important!)
            </div>
            <div class="flex gap-2">
              <div
                class="flex-1 rounded-lg p-2 font-mono text-[11px] text-gold font-bold"
                style="background: rgba(0,0,0,0.4);"
              >
                {depositInfo.memo}
              </div>
              <button
                on:click={copyMemo}
                aria-label="Copy"
                class="px-3 rounded-lg text-white/70 active:scale-95"
                style="background: rgba(139,92,246,0.15);"
              >
                📋
              </button>
            </div>
          </div>

          <div
            class="rounded-lg p-3"
            style="background: rgba(244,201,93,0.1); border: 1px solid rgba(244,201,93,0.3);"
          >
            <p class="text-[10px] text-gold leading-relaxed">
              ⚠️ Send <strong>TON only</strong> to this address. Include the memo
              <strong>{depositInfo.memo}</strong> — otherwise your deposit will not be credited.
            </p>
          </div>

          <div class="text-[10px] text-white/40">
            Minimum deposit:
            <span class="text-white/70 font-bold">{depositInfo.minDeposit} TON</span>
          </div>
        </div>
      {/if}
    {/if}

    <!-- WITHDRAW -->
    {#if activeTab === 'withdraw'}
      <div class="card space-y-3">
        {#if !hotWalletReady}
          <div
            class="rounded-lg p-3 text-center"
            style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);"
          >
            <p class="text-[11px] text-red-300">⚠️ Withdrawals are currently disabled</p>
          </div>
        {/if}

        <div>
          <div class="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
            To Address
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={withdrawAddress}
              placeholder="EQ..."
              class="flex-1 rounded-lg p-2.5 text-sm text-white border border-white/10 focus:border-cyan outline-none font-mono"
              style="background: rgba(0,0,0,0.4);"
            />
            {#if walletAddress}
              <button
                on:click={useConnectedAddress}
                class="px-3 rounded-lg text-[10px] font-bold text-gold active:scale-95"
                style="background: rgba(244,201,93,0.15); border: 1px solid rgba(244,201,93,0.3);"
              >
                Use
              </button>
            {/if}
          </div>
        </div>

        <div>
          <div class="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
            Amount (TON)
          </div>
          <input
            type="text"
            inputmode="decimal"
            bind:value={withdrawAmount}
            placeholder="0.0"
            class="w-full rounded-lg p-2.5 text-lg font-extrabold text-gold border border-white/10 focus:border-gold outline-none tabular-nums"
            style="background: rgba(0,0,0,0.4);"
          />
        </div>

        <div class="flex gap-1.5">
          {#each [0.1, 0.2, 0.3, 0.5] as v}
            <button
              on:click={() => (withdrawAmount = String(v))}
              class="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white/70 active:scale-95"
              style="background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.2);"
            >
              {v} TON
            </button>
          {/each}
        </div>

        {#if withdrawAmount && parseFloat(withdrawAmount) > 0}
          {@const amt = parseFloat(withdrawAmount)}
          {@const net = Math.max(0, amt - 0.05 - 0.01)}
          <div
            class="rounded-lg p-2.5 space-y-1"
            style="background: rgba(0,0,0,0.35); border: 1px solid rgba(139,92,246,0.2);"
          >
            <div class="flex justify-between text-[10px]">
              <span class="text-white/50">Requested</span>
              <span class="text-white/80 font-bold tabular-nums">{amt} TON</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="text-white/50">Platform fee</span>
              <span class="text-red-300 tabular-nums">-0.05 TON</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="text-white/50">Network fee (est.)</span>
              <span class="text-red-300 tabular-nums">-0.01 TON</span>
            </div>
            <div class="h-px" style="background: rgba(139,92,246,0.2);"></div>
            <div class="flex justify-between text-[12px]">
              <span class="text-white/70 font-bold">You will receive</span>
              <span class="text-emerald-400 font-extrabold tabular-nums">~{net.toFixed(3)} TON</span
              >
            </div>
          </div>
        {/if}

        <button
          on:click={doWithdraw}
          disabled={withdrawing || !hotWalletReady || !withdrawAmount || !withdrawAddress}
          class="w-full btn-gold disabled:opacity-40"
        >
          {withdrawing ? 'Sending…' : 'Withdraw TON'}
        </button>

        <div class="text-[10px] text-white/40 text-center">Min: 0.1 TON</div>
      </div>
    {/if}

    <!-- HISTORY -->
    {#if activeTab === 'history'}
      {#if history.tonTransactions.length === 0}
        <div class="card p-6 text-center">
          <p class="text-3xl mb-2">📜</p>
          <p class="text-white/50 text-sm">No transactions yet</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each history.tonTransactions as tx}
            <div class="card flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                  style="background: {tx.direction === 'deposit'
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(244,201,93,0.15)'};"
                >
                  {tx.direction === 'deposit' ? '⬇️' : '⬆️'}
                </div>
                <div>
                  <p
                    class="text-sm font-bold {tx.direction === 'deposit'
                      ? 'text-emerald-400'
                      : 'text-gold'}"
                  >
                    {tx.direction === 'deposit' ? '+' : '-'}{fmt(tx.amountTon, 4)} TON
                  </p>
                  <div class="text-[10px] text-white/40 mt-0.5">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {tx.status === 'confirmed'
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : tx.status === 'pending'
                    ? 'bg-amber-900/50 text-amber-300'
                    : tx.status === 'processing'
                      ? 'bg-blue-900/50 text-blue-300'
                      : 'bg-red-900/50 text-red-300'}"
              >
                {tx.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  <!-- Toasts -->
  {#if successMsg}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(6,78,59,0.95); border: 1px solid rgba(34,197,94,0.5);"
    >
      <p class="text-xs font-bold text-emerald-100">{successMsg}</p>
    </div>
  {/if}

  {#if error}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(153,27,27,0.95); border: 1px solid rgba(220,38,38,0.5);"
    >
      <p class="text-xs font-bold text-red-200">{error}</p>
    </div>
  {/if}
</div>
