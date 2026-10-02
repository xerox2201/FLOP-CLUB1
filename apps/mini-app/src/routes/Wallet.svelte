<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  type Tab = 'deposit' | 'withdraw' | 'history';
  let activeTab: Tab = 'deposit';

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

  $: if (withdrawStatus?.antiAbuse?.justUnlocked) {
    successMsg = 'Withdrawals verified & unlocked';
    setTimeout(() => (successMsg = ''), 5000);
  }

  function fmt(n: any, decimals = 2): string {
    const v = Number(n || 0);
    return formatAmount(v, decimals);
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
        successMsg = `Withdraw submitted: ${amt} TON`;
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
      successMsg = 'Address copied';
      setTimeout(() => (successMsg = ''), 2000);
    }
  }

  function copyMemo() {
    if (depositInfo?.memo) {
      navigator.clipboard.writeText(depositInfo.memo);
      successMsg = 'Memo copied';
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

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  let withdrawPollTimer: any = null;

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

    withdrawPollTimer = setInterval(async () => {
      if (activeTab !== 'withdraw') return;
      try {
        const stat = await api.request<any>('/api/wallet/withdraw-status');
        if (stat.ok && stat.data) withdrawStatus = stat.data;
      } catch {
        // silent — keep the last known withdraw status
      }
    }, 30_000);
  });

  onDestroy(() => {
    if (withdrawPollTimer) clearInterval(withdrawPollTimer);
  });

  $: tonNet = tonStats.deposited - tonStats.withdrawn;
  $: estReceive = (() => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || !withdrawStatus) return 0;
    return Math.max(0, amt - withdrawStatus.feeTon);
  })();

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'deposit', label: 'Deposit', icon: 'plus' },
    { key: 'withdraw', label: 'Withdraw', icon: 'dollar' },
    { key: 'history', label: 'History', icon: 'receipt' },
  ];
</script>

<div class="pb-28 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="px-4 mt-2 mb-3">
    <h1
      class="text-[26px] font-extrabold leading-none tracking-[-0.02em]"
      style="
        background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
      "
    >
      Wallet
    </h1>
    <p class="text-[11px] text-white/45 mt-1.5">Instant · Automatic · Provably fair</p>
  </div>

  {#if loading}
    <div class="px-4">
      <div
        class="rounded-3xl h-[180px]"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
      ></div>
    </div>
  {:else}
    <!-- BALANCE CARD -->
    <div class="px-4 mb-4">
      <div
        class="rounded-3xl p-5 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(212,175,55,0.28) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 100%, rgba(30,58,138,0.3) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
          border: 1.5px solid rgba(212,175,55,0.45);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.18);
        "
      >
        <!-- Decorative glow -->
        <div
          class="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-25 pointer-events-none"
          style="background: radial-gradient(circle, #d4af37, transparent 70%);"
        ></div>

        <div class="relative">
          <!-- Label row -->
          <div class="flex items-center justify-between mb-1">
            <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold">Real Balance</p>
            {#if walletConnected}
              <div class="flex items-center gap-1">
                <span
                  class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  style="box-shadow: 0 0 6px #34d399;"
                ></span>
                <span class="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                  Connected
                </span>
              </div>
            {/if}
          </div>

          <!-- Balance amount -->
          <div class="flex items-baseline gap-2 mb-4">
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
            <div
              class="rounded-xl p-2.5 mb-3 flex items-center gap-2"
              style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4);"
            >
              <Icon name="lock" size={12} color="#fcd34d" />
              <p class="text-[10px] text-amber-300 font-bold">
                ${fmt(withdrawStatus.bonusLocked)} locked by bonus
              </p>
            </div>
          {/if}

          <!-- Stats grid -->
          <div
            class="grid grid-cols-2 gap-3 pt-3"
            style="border-top: 1px solid rgba(212,175,55,0.22);"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
              >
                <Icon name="gift" size={16} color="#6ee7b7" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] text-white/45 uppercase tracking-wider font-bold">
                  Free Chips
                </p>
                <p class="text-[15px] font-extrabold text-emerald-400 tabular-nums leading-tight">
                  {freeChips.toLocaleString()}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2.5">
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                style="background: rgba(34,211,238,0.15); border: 1px solid rgba(34,211,238,0.4);"
              >
                <img src="/ton-logo.png" alt="TON" class="w-6 h-6 object-contain" />
              </div>
              <div class="min-w-0">
                <p class="text-[9px] text-white/45 uppercase tracking-wider font-bold">
                  TON Balance
                </p>
                <p class="text-[15px] font-extrabold text-cyan-300 tabular-nums leading-tight">
                  {fmt(tonNet, 4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TABS -->
    <div class="px-4 mb-4">
      <div
        class="rounded-2xl p-1 grid grid-cols-3 gap-1"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
          border: 1px solid rgba(212,175,55,0.15);
        "
      >
        {#each TABS as tab}
          <button
            on:click={() => (activeTab = tab.key)}
            class="py-2.5 rounded-xl text-[11px] font-extrabold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
            style="
              background: {activeTab === tab.key
              ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
              : 'transparent'};
              color: {activeTab === tab.key ? '#0a0800' : 'rgba(255,255,255,0.6)'};
              {activeTab === tab.key
              ? 'box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.3);'
              : ''}
            "
          >
            <Icon
              name={tab.icon}
              size={12}
              color={activeTab === tab.key ? '#0a0800' : 'rgba(255,255,255,0.6)'}
            />
            <span>{tab.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- ═══════════ DEPOSIT ═══════════ -->
    {#if activeTab === 'deposit'}
      {#if !depositInfo}
        <div class="px-4">
          <div
            class="rounded-2xl p-6 text-center"
            style="
              background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
              border: 1px solid rgba(212,175,55,0.15);
            "
          >
            <div class="flex justify-center mb-2">
              <Icon name="lock" size={32} color="#d4af37" />
            </div>
            <p class="text-white/60 text-sm font-bold">Deposits are currently disabled</p>
          </div>
        </div>
      {:else}
        <div class="px-4 space-y-3">
          <!-- Network badge -->
          <div class="flex items-center justify-between">
            <div
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style="background: rgba(34,211,238,0.12); border: 1px solid rgba(34,211,238,0.35);"
            >
              <span
                class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
                style="box-shadow: 0 0 6px #22d3ee;"
              ></span>
              <span class="text-[10px] font-extrabold text-cyan-300 uppercase tracking-wider">
                {depositInfo.network}
              </span>
            </div>
            <span class="text-[10px] text-white/40 font-bold">
              Min {depositInfo.minDeposit} TON
            </span>
          </div>

          <!-- Address card -->
          <div
            class="rounded-2xl p-4 space-y-4"
            style="
              background:
                radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.1) 0%, transparent 60%),
                linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
              border: 1px solid rgba(34,211,238,0.25);
            "
          >
            <div>
              <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                Deposit Address
              </p>
              <div class="flex gap-2">
                <div
                  class="flex-1 rounded-xl p-2.5 font-mono text-[10px] text-white/85 break-all leading-relaxed"
                  style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06);"
                >
                  {depositInfo.depositAddress || '—'}
                </div>
                <button
                  on:click={copyDepositAddress}
                  aria-label="Copy address"
                  class="w-11 rounded-xl text-white/80 active:scale-95 flex items-center justify-center shrink-0"
                  style="
                    background: linear-gradient(180deg, rgba(34,211,238,0.2), rgba(14,116,144,0.1));
                    border: 1px solid rgba(34,211,238,0.4);
                  "
                >
                  <Icon name="copy" size={16} color="#67e8f9" />
                </button>
              </div>
            </div>

            <div>
              <p
                class="text-[10px] uppercase tracking-widest text-gold/70 font-bold mb-2 flex items-center gap-1.5"
              >
                <Icon name="warning" size={11} color="#f4c95d" />
                <span>Memo · Required</span>
              </p>
              <div class="flex gap-2">
                <div
                  class="flex-1 rounded-xl p-2.5 font-mono text-[13px] font-extrabold text-gold break-all"
                  style="
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(212,175,55,0.4);
                    text-shadow: 0 0 8px rgba(212,175,55,0.4);
                  "
                >
                  {depositInfo.memo}
                </div>
                <button
                  on:click={copyMemo}
                  aria-label="Copy memo"
                  class="w-11 rounded-xl text-gold active:scale-95 flex items-center justify-center shrink-0"
                  style="
                    background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1));
                    border: 1px solid rgba(212,175,55,0.45);
                  "
                >
                  <Icon name="copy" size={16} color="#f4c95d" />
                </button>
              </div>
            </div>

            <div
              class="rounded-xl p-3 flex gap-2.5 items-start"
              style="
                background: linear-gradient(135deg, rgba(212,175,55,0.1), rgba(168,122,21,0.04));
                border: 1px solid rgba(212,175,55,0.28);
              "
            >
              <Icon name="zap" size={14} color="#f4c95d" />
              <p class="text-[10px] text-gold/90 leading-relaxed">
                Deposits are credited <strong class="text-white">automatically</strong> after network
                confirmation (~15 seconds).
              </p>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ═══════════ WITHDRAW ═══════════ -->
    {#if activeTab === 'withdraw'}
      {#if !withdrawStatus}
        <div class="px-4 text-center text-white/40 py-8 text-sm">Loading withdraw status…</div>
      {:else}
        <div class="px-4 space-y-3">
          <!-- Available card -->
          <div
            class="rounded-2xl p-4"
            style="
              background:
                radial-gradient(ellipse at 0% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
                linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
              border: 1.5px solid rgba(16,185,129,0.35);
            "
          >
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-[10px] text-white/45 uppercase font-bold tracking-wider mb-0.5">
                  Available
                </p>
                <p class="text-[22px] font-extrabold text-emerald-400 tabular-nums leading-none">
                  ${fmt(withdrawStatus.availableBalance)}
                </p>
              </div>
              <div class="text-right">
                <p class="text-[9px] text-white/45 uppercase font-bold tracking-wider mb-1">
                  Fee · Min
                </p>
                <p class="text-[11px] font-extrabold text-white/85 tabular-nums">
                  {withdrawStatus.feeTon} · {withdrawStatus.minWithdrawTon} TON
                </p>
              </div>
            </div>
          </div>

          <!-- First withdrawal checklist -->
          {#if !withdrawStatus.antiAbuse?.alreadyUnlocked}
            {@const a = withdrawStatus.antiAbuse}
            {@const c = a.current}
            {@const r = a.required}
            <div
              class="rounded-2xl p-4"
              style="
                background:
                  radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.12) 0%, transparent 60%),
                  linear-gradient(180deg, rgba(37,99,235,0.08), rgba(7,14,27,0.95));
                border: 1.5px solid rgba(37,99,235,0.4);
              "
            >
              <div class="flex items-center gap-2 mb-3">
                <div
                  class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style="
                    background: rgba(37,99,235,0.2);
                    border: 1px solid rgba(37,99,235,0.5);
                  "
                >
                  <Icon name="unlock" size={16} color="#93c5fd" />
                </div>
                <div class="flex-1">
                  <p class="text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                    Unlock Withdrawals
                  </p>
                  <p class="text-[9px] text-white/45 font-bold">Complete all conditions once</p>
                </div>
              </div>

              <div class="space-y-2.5">
                {#each [{ ok: a.checks.depositOk, label: 'Lifetime deposit $5+', current: `$${fmt(c.lifetimeDepositUsd)}`, target: `$${r.minDeposit}` }, { ok: a.checks.rakeOk, label: 'Rake contributed $0.50+', current: `$${fmt(c.lifetimeRakeUsd)}`, target: `$${r.minRake}` }, { ok: a.checks.handsOk, label: 'Play 20+ real hands', current: c.realHandsPlayed, target: r.minHands }, { ok: a.checks.accountAgeOk, label: 'Account age 24h+', current: `${c.accountAgeHours}h`, target: `${r.minAccountAgeH}h` }, { ok: a.checks.depositAgeOk, label: 'Deposit age 6h+', current: `${c.depositAgeHours}h`, target: `${r.minDepositAgeH}h` }] as chk}
                  <div class="flex items-center gap-2.5">
                    {#if chk.ok}
                      <span
                        class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style="
                          background: rgba(16,185,129,0.25);
                          border: 1px solid #10b981;
                          box-shadow: 0 0 8px rgba(16,185,129,0.4);
                        "
                      >
                        <Icon name="check" size={10} color="#6ee7b7" />
                      </span>
                    {:else}
                      <span
                        class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                        style="
                          background: rgba(0,0,0,0.4);
                          border: 1px solid rgba(255,255,255,0.15);
                          color: rgba(255,255,255,0.4);
                        "
                      >
                        ○
                      </span>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-[11px] font-bold leading-tight"
                        style="color: {chk.ok ? '#6ee7b7' : 'rgba(255,255,255,0.75)'};"
                      >
                        {chk.label}
                      </p>
                      <p
                        class="text-[9px] tabular-nums text-white/40 font-mono leading-tight mt-0.5"
                      >
                        {chk.current} / {chk.target}
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Bonus conditions -->
          {#if !withdrawStatus.bonusConditionsMet}
            <div
              class="rounded-2xl p-3.5"
              style="
                background: rgba(245,158,11,0.1);
                border: 1.5px solid rgba(245,158,11,0.4);
              "
            >
              <div class="flex items-center gap-2 mb-2">
                <Icon name="lock" size={14} color="#fcd34d" />
                <p class="text-[11px] font-extrabold text-amber-300">Bonus Conditions</p>
              </div>
              <div class="space-y-1 text-[10px] text-amber-200/90 font-mono">
                {#if withdrawStatus.conditions.playthroughRemaining > 0}
                  <p>· Playthrough: ${fmt(withdrawStatus.conditions.playthroughRemaining)}</p>
                {/if}
                {#if withdrawStatus.conditions.rakeRemaining > 0}
                  <p>· Rake: ${fmt(withdrawStatus.conditions.rakeRemaining)}</p>
                {/if}
                {#if withdrawStatus.conditions.handsRemaining > 0}
                  <p>· Hands: {withdrawStatus.conditions.handsRemaining}</p>
                {/if}
                {#if withdrawStatus.conditions.waitDaysRemaining > 0}
                  <p>· Wait: {withdrawStatus.conditions.waitDaysRemaining} days</p>
                {/if}
              </div>
            </div>
          {/if}

          {#if !withdrawStatus.hotWalletReady}
            <div
              class="rounded-xl p-3 flex items-center gap-2"
              style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35);"
            >
              <Icon name="warning" size={14} color="#fca5a5" />
              <p class="text-[11px] text-red-300 font-bold">Withdrawals temporarily disabled</p>
            </div>
          {/if}

          <!-- Form -->
          <div
            class="rounded-2xl p-4 space-y-4"
            style="
              background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
              border: 1px solid rgba(212,175,55,0.15);
            "
          >
            <div>
              <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
                To Address
              </p>
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={withdrawAddress}
                  placeholder="EQ..."
                  disabled={!withdrawStatus.canWithdraw}
                  class="flex-1 rounded-xl p-3 text-sm text-white border outline-none font-mono disabled:opacity-50"
                  style="background: rgba(0,0,0,0.4); border-color: rgba(212,175,55,0.2);"
                />
                {#if walletAddress}
                  <button
                    on:click={useConnectedAddress}
                    disabled={!withdrawStatus.canWithdraw}
                    class="px-3 rounded-xl text-[10px] font-extrabold text-gold active:scale-95 disabled:opacity-50"
                    style="
                      background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1));
                      border: 1px solid rgba(212,175,55,0.4);
                    "
                  >
                    USE
                  </button>
                {/if}
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                  Amount (TON)
                </p>
                <button
                  on:click={setMaxWithdraw}
                  disabled={!withdrawStatus.canWithdraw}
                  class="text-[10px] font-extrabold text-gold active:opacity-70 disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
              <input
                type="text"
                inputmode="decimal"
                bind:value={withdrawAmount}
                placeholder="0.0"
                disabled={!withdrawStatus.canWithdraw}
                class="w-full rounded-xl p-3 text-2xl font-extrabold border outline-none tabular-nums disabled:opacity-50"
                style="
                  background: rgba(0,0,0,0.4);
                  border-color: rgba(212,175,55,0.3);
                  color: #f4e5a8;
                  text-shadow: 0 0 8px rgba(212,175,55,0.4);
                "
              />
            </div>

            <div class="grid grid-cols-4 gap-1.5">
              {#each [0.1, 0.5, 1, 5] as v}
                <button
                  on:click={() => (withdrawAmount = String(v))}
                  disabled={!withdrawStatus.canWithdraw}
                  class="py-2 rounded-lg text-[11px] font-extrabold text-white/85 active:scale-95 disabled:opacity-40"
                  style="
                    background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.6));
                    border: 1px solid rgba(96,165,250,0.3);
                  "
                >
                  {v}
                </button>
              {/each}
            </div>

            {#if withdrawAmount && parseFloat(withdrawAmount) > 0}
              {@const amt = parseFloat(withdrawAmount)}
              {@const usd = amt * withdrawStatus.tonPriceUsd}
              <div
                class="rounded-xl p-3 space-y-2"
                style="background: rgba(0,0,0,0.35); border: 1px solid rgba(212,175,55,0.15);"
              >
                <div class="flex justify-between text-[11px]">
                  <span class="text-white/50">Requested</span>
                  <span class="text-white/85 font-bold tabular-nums">
                    {amt} TON · ${fmt(usd)}
                  </span>
                </div>
                <div class="flex justify-between text-[11px]">
                  <span class="text-white/50">Network Fee</span>
                  <span class="text-red-300 font-bold tabular-nums">
                    −{withdrawStatus.feeTon} TON
                  </span>
                </div>
                <div style="height: 1px; background: rgba(212,175,55,0.15);"></div>
                <div class="flex justify-between text-[13px]">
                  <span class="text-white/70 font-bold">You receive</span>
                  <span class="text-emerald-400 font-extrabold tabular-nums">
                    ~{formatAmount(estReceive, 4)} TON
                  </span>
                </div>
              </div>
            {/if}

            <button
              on:click={doWithdraw}
              disabled={withdrawing ||
                !withdrawStatus.canWithdraw ||
                !withdrawAmount ||
                !withdrawAddress}
              class="w-full rounded-xl py-3.5 text-[13px] font-extrabold active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
              style="
                background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
                color: #0a0800;
                box-shadow: 0 4px 0 #7a560a, 0 8px 20px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
              "
            >
              {#if withdrawing}
                <span>Sending…</span>
              {:else if withdrawStatus.canWithdraw}
                <Icon name="arrow-right" size={14} color="#0a0800" />
                <span>Withdraw Instantly</span>
              {:else}
                <Icon name="lock" size={14} color="#0a0800" />
                <span>Locked</span>
              {/if}
            </button>

            <p class="text-[10px] text-white/40 text-center font-mono">
              Automated · Flat {withdrawStatus.feeTon} TON fee
            </p>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ═══════════ HISTORY ═══════════ -->
    {#if activeTab === 'history'}
      {#if history.tonTransactions.length === 0}
        <div class="px-4">
          <div
            class="rounded-2xl p-8 text-center"
            style="
              background:
                radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.08) 0%, transparent 60%),
                linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
              border: 1px dashed rgba(212,175,55,0.3);
            "
          >
            <div class="flex justify-center mb-3">
              <div
                class="w-14 h-14 rounded-2xl flex items-center justify-center"
                style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
              >
                <Icon name="receipt" size={24} color="#d4af37" />
              </div>
            </div>
            <p class="text-sm font-bold text-white/75">No transactions yet</p>
            <p class="text-[11px] text-white/45 mt-1">
              Your deposits and withdrawals will appear here
            </p>
          </div>
        </div>
      {:else}
        <div class="px-4 space-y-2">
          {#each history.tonTransactions as tx}
            {@const isDep = tx.direction === 'deposit'}
            {@const sc =
              tx.status === 'confirmed'
                ? '#10b981'
                : tx.status === 'pending' || tx.status === 'processing'
                  ? '#f59e0b'
                  : '#ef4444'}
            <div
              class="rounded-2xl p-3.5 flex items-center gap-3"
              style="
                background:
                  radial-gradient(ellipse at 100% 50%, {isDep
                ? 'rgba(16,185,129,0.08)'
                : 'rgba(212,175,55,0.08)'} 0%, transparent 60%),
                  linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
                border: 1px solid rgba(212,175,55,0.12);
              "
            >
              <!-- Direction icon -->
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style="
                  background: {isDep
                  ? 'linear-gradient(180deg, rgba(16,185,129,0.25), rgba(5,150,105,0.1))'
                  : 'linear-gradient(180deg, rgba(212,175,55,0.25), rgba(168,122,21,0.1))'};
                  border: 1px solid {isDep ? 'rgba(16,185,129,0.45)' : 'rgba(212,175,55,0.45)'};
                "
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isDep ? '#6ee7b7' : '#f4c95d'}
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  style="transform: rotate({isDep ? 0 : 180}deg);"
                >
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-extrabold tabular-nums leading-tight"
                  style="color: {isDep ? '#6ee7b7' : '#f4c95d'};"
                >
                  {isDep ? '+' : '−'}{fmt(tx.amountTon, 4)} TON
                </p>
                <p class="text-[10px] text-white/45 mt-0.5 truncate font-bold">
                  {isDep ? 'Deposit' : 'Withdrawal'} · {fmtDate(tx.createdAt)}
                </p>
              </div>

              <!-- Status badge -->
              <span
                class="text-[9px] px-2 py-1 rounded-full font-extrabold uppercase tracking-wider shrink-0"
                style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;"
              >
                {tx.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  <!-- Toast: success -->
  {#if successMsg}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%] flex items-center gap-2"
      style="
        background: linear-gradient(180deg, rgba(6,78,59,0.95), rgba(5,150,105,0.9));
        border: 1px solid rgba(16,185,129,0.6);
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      "
    >
      <Icon name="check" size={14} color="#a7f3d0" />
      <p class="text-xs font-extrabold text-emerald-100">{successMsg}</p>
    </div>
  {/if}

  <!-- Toast: error -->
  {#if error}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%] flex items-center gap-2"
      style="
        background: linear-gradient(180deg, rgba(153,27,27,0.95), rgba(127,29,29,0.9));
        border: 1px solid rgba(239,68,68,0.6);
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      "
    >
      <Icon name="warning" size={14} color="#fca5a5" />
      <p class="text-xs font-extrabold text-red-100">{error}</p>
    </div>
  {/if}
</div>
