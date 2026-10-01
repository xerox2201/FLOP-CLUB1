<script lang="ts">
  import { requestAdmin } from '../stores/admin';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import AvatarPickerModal from '../components/AvatarPickerModal.svelte';
  import FreePlayDetailModal from '../components/FreePlayDetailModal.svelte';
  import InfoSheet from '../components/InfoSheet.svelte';
  import SeedClaimModal from '../components/SeedClaimModal.svelte';
  import XPConvertModal from '../components/XPConvertModal.svelte';
  import Icon from '../components/Icon.svelte';

  export let onNavigate: (page: any) => void = () => {};

  // ============ SECRET ADMIN GESTURE (20 taps in 5s) ============
  let adminTapCount = 0;
  let adminTapTimer: any = null;
  function handleVersionTap() {
    adminTapCount++;
    if (adminTapTimer) clearTimeout(adminTapTimer);
    if (adminTapCount >= 20) {
      adminTapCount = 0;
      requestAdmin();
      return;
    }
    adminTapTimer = setTimeout(() => {
      adminTapCount = 0;
    }, 5000);
  }

  let showSeedClaim = false;
  let selectedSeed: any = null;
  let showXpConvert = false;
  let showAvatarPicker = false;
  let showFreeDetail = false;

  // InfoSheet state
  type InfoKey =
    'real' | 'rake' | 'rakeback' | 'net' | 'free' | 'xp' | 'loyalty' | 'vouchers' | 'seeds' | null;
  let infoOpen: InfoKey = null;

  const INFO_META: Record<Exclude<InfoKey, null>, { title: string; icon: string }> = {
    real: { title: 'Real Money Stats', icon: '💰' },
    rake: { title: 'Rake', icon: '💵' },
    rakeback: { title: 'Rakeback', icon: '🎁' },
    net: { title: 'Net Position', icon: '💎' },
    free: { title: 'Free Play', icon: '🎮' },
    xp: { title: 'XP System', icon: '⭐' },
    loyalty: { title: 'Loyalty Progress', icon: '🎯' },
    vouchers: { title: 'Vouchers', icon: '🎫' },
    seeds: { title: 'Seeds', icon: '🌱' },
  };

  $: user = $auth.user;
  $: chips = $auth.freeChips;
  $: stats = $auth.stats;
  $: loyalty = $auth.loyalty;
  $: selectedAvatar = (user as any)?.avatar_id || 'king';
  $: selectedFrame = (user as any)?.frame_id || 'royal';

  // ===== Real Play =====
  $: realHands = stats?.handsPlayedReal ?? 0;
  $: realWon = stats?.totalWon ?? 0;
  $: realHandsWon = stats?.handsWon ?? 0;
  $: realWinRate = realHands > 0 ? Math.round((realHandsWon / realHands) * 100) : 0;

  // ===== Real Money breakdown =====
  $: rakePaid = loyalty?.rakePaidLifetime ?? 0;
  $: rakebackEarned = loyalty?.rakebackEarned ?? 0;
  $: netPosition = realWon - rakePaid + rakebackEarned;

  // ===== Free Play =====
  $: freeHands = (chips as any)?.free_hands ?? chips?.total_hands ?? 0;
  $: freeWon = (chips as any)?.free_won ?? 0;
  $: freeHandsWon = (chips as any)?.free_hands_won ?? 0;
  $: freeChipsBalance = Number(chips?.chips ?? 0);

  // ===== Loyalty / XP =====
  $: level = loyalty?.level ?? 1;
  $: xpIntoLevel = loyalty?.xpIntoLevel ?? 0;
  $: xpForNextLevel = loyalty?.xpForNextLevel ?? 100;
  $: xpPct = xpForNextLevel > 0 ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 0;
  $: availableXp = loyalty?.availableXp ?? 0;

  $: tierLabel = loyalty?.tierLabel ?? 'Welcome';
  $: tierIcon = loyalty?.tierIcon ?? '🌱';
  $: tierColor = loyalty?.tierColor ?? '#6ee7b7';
  $: rakebackPct = Math.round((loyalty?.rakebackPct ?? 0.6) * 100);
  $: lifetimeRake = loyalty?.lifetimeRake ?? 0;
  $: nextTier = loyalty?.nextTier ?? null;
  $: progressToNextTier = Math.round((loyalty?.progressToNextTier ?? 0) * 100);

  // ===== Vouchers =====
  $: activeVouchers = (loyalty?.vouchers ?? []).filter((v: any) => !v.used);
  $: vouchersTotal = activeVouchers.reduce((s: number, v: any) => s + v.amount, 0);

  // ===== Seeds =====
  $: seeds = loyalty?.seeds ?? [];

  // ===== Trophies =====
  $: trophies = stats?.trophies ?? 0;

  // ===== Helpers =====
  function fmtMoney(n: any): string {
    return `$${Number(n || 0).toFixed(2)}`;
  }
  function fmtChips(n: any): string {
    const num = Number(n || 0);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  }

  async function pickAvatar(id: string) {
    if (user) (user as any).avatar_id = id;
    await api.updateAvatar(id);
    await auth.refresh();
  }
  function pickFrame(frame: string | null) {
    if (!frame) return;
    if (user) (user as any).frame_id = frame;
  }

  function openSeedClaim(seed: any) {
    if (!seed.eligible || seed.claimed) return;
    selectedSeed = seed;
    showSeedClaim = true;
  }

  // ─── Menu groups ───
  const QUICK_ACTIONS = [
    { icon: 'users', label: 'Refer', page: 'referral', color: '#f4c95d' },
    { icon: 'ticket', label: 'Tourneys', page: 'my-tournaments', color: '#a78bfa' },
    { icon: 'dollar', label: 'My Money', page: 'my-money', color: '#6ee7b7' },
    { icon: 'trophy', label: 'Ranks', page: 'leaderboard', color: '#60a5fa' },
  ];

  const MORE_MENU = [
    {
      icon: 'star',
      label: 'Loyalty',
      sub: 'XP, Tier, Rakeback',
      page: 'loyalty',
      color: '#a78bfa',
    },
    {
      icon: 'users',
      label: 'Referral',
      sub: 'Invite & earn 12%',
      page: 'referral',
      color: '#f4c95d',
    },
    {
      icon: 'dollar',
      label: 'My Money',
      sub: 'Rake & returns',
      page: 'my-money',
      color: '#6ee7b7',
    },
    {
      icon: 'chat',
      label: 'Community',
      sub: 'Channel & chat',
      page: 'community',
      color: '#22d3ee',
    },
    {
      icon: 'chart',
      label: 'Live Books',
      sub: 'Public transparency',
      page: 'books',
      color: '#60a5fa',
    },
    { icon: 'cart', label: 'Shop', sub: 'Chips & cosmetics', page: 'shop', color: '#22d3ee' },
    {
      icon: 'receipt',
      label: 'Rewards History',
      sub: 'XP & purchases',
      page: 'rewards-history',
      color: '#f4c95d',
    },
    {
      icon: 'bell',
      label: 'Notifications',
      sub: 'Messages & alerts',
      page: 'notifications',
      color: '#ef4444',
    },
    { icon: 'settings', label: 'Settings', sub: 'Preferences', page: 'settings', color: '#94a3b8' },
    { icon: 'help', label: 'Help Center', sub: 'FAQ & support', page: 'help', color: '#6ee7b7' },
  ];
</script>

<div class="pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center justify-between mt-2 mb-3 px-4">
    <div>
      <h1 class="text-2xl font-extrabold text-white leading-none">Profile</h1>
      <p class="text-[11px] text-white/45 mt-1">Manage your account</p>
    </div>
    <button
      on:click={() => onNavigate('settings')}
      aria-label="Settings"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="
        background: linear-gradient(180deg, rgba(139,92,246,0.2), rgba(109,40,217,0.08));
        border: 1px solid rgba(139,92,246,0.35);
      "
    >
      <Icon name="settings" size={18} color="#c4b5fd" />
    </button>
  </div>

  <!-- HERO CARD -->
  <div class="px-4 mb-3">
    <div
      class="rounded-3xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 60%),
          linear-gradient(180deg, rgba(30,58,138,0.4) 0%, rgba(15,31,58,0.85) 50%, rgba(7,14,27,0.95) 100%);
        border: 1.5px solid rgba(212,175,55,0.35);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(212,175,55,0.12);
      "
    >
      <div class="flex items-center gap-4 relative">
        <!-- Avatar -->
        <button
          on:click={() => (showAvatarPicker = true)}
          aria-label="Change avatar"
          class="shrink-0 relative active:scale-95 transition"
        >
          <Avatar avatarId={selectedAvatar} size="xl" frame={selectedFrame} />
          <div
            class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style="
              background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
              border: 2px solid #0a0d1a;
            "
          >
            <Icon name="edit" size={11} color="#0a0800" />
          </div>
        </button>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="text-lg font-extrabold text-white truncate">
              {user?.display_name || 'Player'}
            </p>
            <span
              class="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style="background: linear-gradient(180deg, #3b82f6, #1e40af);"
            >
              <Icon name="check" size={9} color="#ffffff" />
            </span>
          </div>
          <p class="text-[11px] text-white/50 font-mono mb-2 truncate">
            @{user?.username || 'player'}
          </p>

          <!-- Badges -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <div
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
              style="
                background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
                box-shadow: 0 2px 6px rgba(0,0,0,0.5);
              "
            >
              <span class="text-[8px] font-extrabold text-black/70 uppercase tracking-wider">
                LVL
              </span>
              <span class="text-[12px] font-extrabold text-black leading-none">{level}</span>
            </div>
            <div
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
              style="background: {tierColor}22; border: 1px solid {tierColor}70;"
            >
              <span class="text-sm leading-none">{tierIcon}</span>
              <span class="text-[10px] font-extrabold leading-none" style="color: {tierColor};">
                {tierLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- QUICK STATS (2 cols) -->
  <div class="grid grid-cols-2 gap-2 px-4 mb-3">
    <!-- Real Money -->
    <button
      on:click={() => (infoOpen = 'real')}
      class="rounded-2xl p-3 text-left active:scale-[0.97] transition-all relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(96,165,250,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(96,165,250,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(96,165,250,0.2); border: 1px solid rgba(96,165,250,0.4);"
        >
          <Icon name="dollar" size={12} color="#60a5fa" />
        </div>
        <span class="text-[9px] font-extrabold text-blue-300 uppercase tracking-wider"> Real </span>
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        ${fmtMoney(realWon).replace('$', '')}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {realHands.toLocaleString()} hands · {realWinRate}% win
      </p>
    </button>

    <!-- Free Play -->
    <button
      on:click={() => (showFreeDetail = true)}
      class="rounded-2xl p-3 text-left active:scale-[0.97] transition-all relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="gift" size={12} color="#6ee7b7" />
        </div>
        <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">
          Free
        </span>
      </div>
      <p class="text-[17px] font-extrabold text-emerald-400 tabular-nums leading-none">
        {fmtChips(freeChipsBalance)}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {freeHands.toLocaleString()} hands · {freeHandsWon.toLocaleString()} wins
      </p>
    </button>
  </div>

  <!-- LOYALTY PROGRESS CARD -->
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, {tierColor}15 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid {tierColor}40;
      "
    >
      <div class="flex items-center gap-2 mb-3">
        <div
          class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: linear-gradient(180deg, {tierColor}30, {tierColor}10);
            border: 1px solid {tierColor}60;
          "
        >
          <Icon name="star" size={16} color={tierColor} />
        </div>
        <div class="flex-1">
          <p
            class="text-[10px] uppercase tracking-widest font-extrabold"
            style="color: {tierColor};"
          >
            Loyalty Progress
          </p>
          <p class="text-[9px] text-white/45 font-bold">
            {rakebackPct}% rakeback · {tierLabel}
          </p>
        </div>
        <button
          on:click={() => (infoOpen = 'loyalty')}
          aria-label="Info"
          class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white/50 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
        >
          ?
        </button>
      </div>

      <!-- XP bar -->
      <div class="mb-3">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[9px] font-bold text-white/60 uppercase tracking-wider">
            XP · Level {level}
          </span>
          <span class="text-[9px] font-mono text-white/50 tabular-nums">
            {xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()}
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
      <div class="mb-3">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-[9px] font-bold text-white/60 uppercase tracking-wider">
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

      <!-- Cash Out XP button -->
      <button
        on:click={() => (showXpConvert = true)}
        class="w-full rounded-xl py-2.5 text-[11px] font-extrabold active:scale-[0.98] flex items-center justify-center gap-1.5"
        style="
          background: linear-gradient(180deg, rgba(139,92,246,0.3), rgba(109,40,217,0.15));
          border: 1px solid rgba(139,92,246,0.55);
          color: #e9d5ff;
        "
      >
        <Icon name="gem" size={13} color="#e9d5ff" />
        <span>Cash Out XP</span>
        <span class="text-[10px] font-mono opacity-70">
          ({availableXp.toLocaleString()} avail)
        </span>
      </button>
    </div>
  </div>

  <!-- VOUCHERS -->
  {#if activeVouchers.length > 0}
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="
          background:
            radial-gradient(ellipse at 0% 0%, rgba(244,201,93,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(244,201,93,0.4);
        "
      >
        <div class="flex items-center gap-2 mb-3">
          <Icon name="ticket" size={16} color="#f4c95d" />
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold flex-1">
            Vouchers
          </p>
          <span class="text-[11px] font-extrabold text-gold tabular-nums">
            {fmtMoney(vouchersTotal)}
          </span>
        </div>
        <div class="space-y-2">
          {#each activeVouchers as v}
            <div
              class="rounded-xl p-2.5"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(244,201,93,0.25);"
            >
              <div class="flex justify-between items-center text-[10px] mb-1.5">
                <span class="font-extrabold text-gold">{fmtMoney(v.amount)}</span>
                <span class="text-white/50 font-mono tabular-nums">
                  {fmtMoney(v.currentRake)} / {fmtMoney(v.minRake)}
                </span>
              </div>
              <div
                class="w-full h-1.5 rounded-full overflow-hidden"
                style="background: rgba(0,0,0,0.5);"
              >
                <div
                  class="h-full rounded-full transition-all"
                  style="
                    width: {v.progressPct}%;
                    background: linear-gradient(90deg, #f4e5a8, #d4af37);
                    box-shadow: 0 0 8px rgba(244,201,93,0.5);
                  "
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- SEEDS -->
  {#if seeds.length > 0}
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="
          background:
            radial-gradient(ellipse at 0% 0%, rgba(34,197,94,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(34,197,94,0.4);
        "
      >
        <div class="flex items-center gap-2 mb-3">
          <Icon name="seed" size={16} color="#4ade80" />
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-emerald-300 flex-1">
            Seeds
          </p>
          <button
            on:click={() => (infoOpen = 'seeds')}
            aria-label="Info"
            class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white/50 active:scale-95"
            style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
          >
            ?
          </button>
        </div>
        <div class="space-y-2">
          {#each seeds as s}
            {@const pct = Math.min(
              100,
              Math.round((s.progress.freeHands / s.progress.minFreeHands) * 100),
            )}
            <button
              type="button"
              on:click={() => openSeedClaim(s)}
              disabled={!s.eligible || s.claimed}
              class="w-full flex items-center gap-2.5 p-2 rounded-xl text-left active:scale-[0.98] transition disabled:cursor-default"
              style="
                background: rgba(0,0,0,0.35);
                {s.eligible && !s.claimed
                ? 'border: 1px solid rgba(34,197,94,0.5); box-shadow: 0 0 12px rgba(34,197,94,0.2);'
                : 'border: 1px solid transparent;'}
              "
            >
              <span class="text-lg">{s.icon}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <p class="text-[11px] font-extrabold text-white truncate">{s.label}</p>
                  {#if s.claimed}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style="background: rgba(16,185,129,0.25); color: #6ee7b7;">✓ CLAIMED</span
                    >
                  {:else if s.eligible}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse"
                      style="background: rgba(34,197,94,0.4); color: #86efac;">TAP TO CLAIM</span
                    >
                  {:else}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
                      style="background: rgba(107,114,128,0.3); color: #9ca3af;">LOCKED</span
                    >
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <div
                    class="flex-1 h-1.5 rounded-full overflow-hidden"
                    style="background: rgba(0,0,0,0.5);"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      style="
                        width: {pct}%;
                        background: linear-gradient(90deg, #86efac, #22c55e);
                        box-shadow: 0 0 6px rgba(34,197,94,0.6);
                      "
                    ></div>
                  </div>
                  <span class="text-[9px] font-mono tabular-nums text-white/60">
                    {s.progress.freeHands.toLocaleString()}/{s.progress.minFreeHands.toLocaleString()}
                  </span>
                </div>
              </div>
              <span
                class="text-[11px] font-extrabold tabular-nums shrink-0"
                style="color: #86efac;"
              >
                ${s.amount.toFixed(2)}
              </span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- QUICK ACTIONS (4 buttons) -->
  <div class="px-4 mb-4">
    <div class="grid grid-cols-4 gap-2">
      {#each QUICK_ACTIONS as a}
        <button
          on:click={() => onNavigate(a.page)}
          class="rounded-2xl py-3 flex flex-col items-center gap-1.5 active:scale-[0.96] transition-all"
          style="
            background:
              radial-gradient(ellipse at 50% 0%, {a.color}15 0%, transparent 70%),
              linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1px solid {a.color}35;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          "
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center"
            style="
              background: radial-gradient(circle at 30% 30%, {a.color}30, {a.color}10);
              border: 1px solid {a.color}55;
            "
          >
            <Icon name={a.icon} size={16} color={a.color} />
          </div>
          <p class="text-[9px] font-extrabold text-white/85 leading-none text-center">
            {a.label}
          </p>
        </button>
      {/each}
    </div>
  </div>

  <!-- MORE MENU -->
  <div class="px-4 mb-4">
    <div
      class="rounded-2xl overflow-hidden"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9));
        border: 1px solid rgba(212,175,55,0.15);
      "
    >
      {#each MORE_MENU as item, i}
        <button
          on:click={() => onNavigate(item.page)}
          class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition"
          style="border-bottom: {i < MORE_MENU.length - 1
            ? '1px solid rgba(212,175,55,0.08)'
            : 'none'};"
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style="
              background: radial-gradient(circle at 30% 30%, {item.color}20, transparent);
              border: 1px solid {item.color}40;
            "
          >
            <Icon name={item.icon} size={16} color={item.color} />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-bold text-white/90 leading-tight">{item.label}</p>
            <p class="text-[10px] text-white/40 leading-tight mt-0.5">{item.sub}</p>
          </div>
          <Icon name="arrow-right" size={12} color="rgba(212,175,55,0.6)" />
        </button>
      {/each}
    </div>
  </div>

  <!-- LOGOUT -->
  <div class="px-4 mb-4">
    <button
      on:click={() => auth.logout()}
      class="w-full rounded-2xl py-3 flex items-center gap-3 px-4 active:scale-[0.98] transition"
      style="
        background: linear-gradient(180deg, rgba(127,29,29,0.25), rgba(7,14,27,0.9));
        border: 1px solid rgba(239,68,68,0.35);
      "
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);"
      >
        <Icon name="logout" size={16} color="#fca5a5" />
      </div>
      <div class="flex-1 min-w-0 text-left">
        <p class="text-[13px] font-bold text-red-400 leading-tight">Logout</p>
        <p class="text-[10px] text-white/40 leading-tight mt-0.5">Sign out of account</p>
      </div>
    </button>
  </div>

  <!-- Hidden version text (20-tap secret admin) -->
  <button
    type="button"
    class="w-full text-center text-[8px] text-white/15 mt-4 mb-2 select-none cursor-default bg-transparent border-0"
    on:click={handleVersionTap}
    aria-hidden="true"
    tabindex="-1"
  >
    Flop Club v1.0.0
  </button>
</div>

<!-- ═══════════ MODALS ═══════════ -->
<AvatarPickerModal
  bind:open={showAvatarPicker}
  avatarId={selectedAvatar}
  frame={selectedFrame}
  onSelectAvatar={pickAvatar}
  onSelectFrame={pickFrame}
  onClose={() => (showAvatarPicker = false)}
/>

<FreePlayDetailModal
  bind:open={showFreeDetail}
  stats={{
    free_hands: freeHands,
    free_won: freeWon,
    free_hands_won: freeHandsWon,
    chips: freeChipsBalance,
  }}
  onClose={() => (showFreeDetail = false)}
/>

<SeedClaimModal
  bind:open={showSeedClaim}
  seed={selectedSeed}
  onClose={() => {
    showSeedClaim = false;
    selectedSeed = null;
  }}
/>

<XPConvertModal
  bind:open={showXpConvert}
  {availableXp}
  {level}
  onClose={() => (showXpConvert = false)}
/>

<!-- ═══════════ INFO SHEETS ═══════════ -->
<InfoSheet
  open={infoOpen === 'real'}
  title={INFO_META.real.title}
  icon={INFO_META.real.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">Statistics from real-money tables only.</p>
  <ul class="space-y-1.5 mb-3">
    <li><strong class="text-white">Hands:</strong> total hands played</li>
    <li><strong class="text-white">Won:</strong> total winnings after rake</li>
    <li><strong class="text-white">Win rate:</strong> percentage of hands won</li>
  </ul>
  <div
    class="rounded-xl p-3"
    style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.25);"
  >
    <p class="text-[11px]">
      <strong class="text-gold">Example:</strong> 100 hands · $5 won · 45 wins → 45% win rate
    </p>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'rakeback'}
  title={INFO_META.rakeback.title}
  icon={INFO_META.rakeback.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">We return a portion of the rake you paid directly to your balance.</p>
  <div
    class="rounded-xl p-3 mb-3"
    style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3);"
  >
    <p class="text-[11px] mb-1"><strong class="text-gold">Your current rate:</strong></p>
    <p class="text-[13px] font-extrabold" style="color: {tierColor};">
      {tierIcon}
      {tierLabel} → {rakebackPct}% Rakeback
    </p>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'net'}
  title={INFO_META.net.title}
  icon={INFO_META.net.icon}
  onClose={() => (infoOpen = null)}
>
  <div
    class="rounded-xl p-3 mb-3"
    style="background: rgba(30,58,138,0.15); border: 1px solid rgba(96,165,250,0.3);"
  >
    <p class="text-[12px] font-mono text-center">
      <strong class="text-white">Net = Won − Rake + Rakeback</strong>
    </p>
  </div>
  <p class="mb-3">Positive = in profit. Negative = not yet recovered.</p>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'loyalty'}
  title={INFO_META.loyalty.title}
  icon={INFO_META.loyalty.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3 font-bold text-white">Two independent systems:</p>
  <div class="space-y-2 mb-3">
    <div
      class="rounded-xl p-3"
      style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);"
    >
      <p class="text-[11px] font-extrabold mb-1 text-violet-300">1. XP Level</p>
      <p class="text-[11px]">
        Based on XP earned. Current: <strong class="text-white">Level {level}</strong>
      </p>
    </div>
    <div
      class="rounded-xl p-3"
      style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3);"
    >
      <p class="text-[11px] font-extrabold mb-1 text-gold">2. Rakeback Tier</p>
      <p class="text-[11px]">
        Based on lifetime rake. Current:
        <strong style="color: {tierColor};">{rakebackPct}% ({tierLabel})</strong>
      </p>
    </div>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'seeds'}
  title={INFO_META.seeds.title}
  icon={INFO_META.seeds.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">Free real-money rewards earned by playing free tables.</p>
  <div class="space-y-1.5 mb-3 text-[11px]">
    <div class="flex justify-between">
      <span>🥉 Bronze</span><span class="font-mono">50 hands + 10 wins → $0.50</span>
    </div>
    <div class="flex justify-between">
      <span>🥈 Silver</span><span class="font-mono">200 hands + 50 wins → $1.00</span>
    </div>
    <div class="flex justify-between">
      <span>🥇 Gold</span><span class="font-mono">500 hands + 150 wins → $2.50</span>
    </div>
    <div class="flex justify-between">
      <span>💎 Platinum</span><span class="font-mono">2000 hands + 500 wins → $5.00</span>
    </div>
  </div>
</InfoSheet>
