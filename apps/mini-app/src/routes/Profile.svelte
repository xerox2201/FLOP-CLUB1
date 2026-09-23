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
import DailyRefillButton from '../components/DailyRefillButton.svelte';

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
    | 'real'
    | 'rake'
    | 'rakeback'
    | 'net'
    | 'free'
    | 'xp'
    | 'loyalty'
    | 'vouchers'
    | 'seeds'
    | null;
  let infoOpen: InfoKey = null;

  const INFO_META: Record<
    Exclude<InfoKey, null>,
    { title: string; icon: string }
  > = {
    real: { title: 'Real Money Stats', icon: '💰' },
    rake: { title: 'Rake چیست؟', icon: '💵' },
    rakeback: { title: 'Rakeback چیست؟', icon: '🎁' },
    net: { title: 'موقعیت خالص تو', icon: '💎' },
    free: { title: 'Free Play', icon: '🎮' },
    xp: { title: 'XP چیست؟', icon: '⭐' },
    loyalty: { title:  '<DailyRefillButton />Loyalty Progress', icon: '🎯' },
    vouchers: { title: 'Voucher چیست؟', icon: '🎫' },
    seeds: { title: 'Seed چیست؟', icon: '🌱' },
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

  // ===== Real Money breakdown (from loyalty) =====
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
  $: activeVouchers = (loyalty?.vouchers ?? []).filter((v) => !v.used);
  $: vouchersTotal = activeVouchers.reduce((s, v) => s + v.amount, 0);

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

  const ACCOUNT_MENU = [
    { icon: '💰', label: 'Wallet', page: 'wallet', sub: 'Balance & payments' },
    { icon: '🎫', label: 'My Tournaments', page: 'my-tournaments', sub: 'History & results' },
    { icon: '🏅', label: 'Achievements', page: 'achievements', sub: 'Badges & rewards' },
    { icon: '🏆', label: 'Leaderboard', page: 'leaderboard', sub: 'Top players' },
  ];

  const MORE_MENU = [
    { icon: '🛒', label: 'Shop', page: 'shop', sub: 'Chips & cosmetics' },
    { icon: '🔔', label: 'Notifications', page: 'notifications', sub: 'Messages & alerts' },
    { icon: '⚙️', label: 'Settings', page: 'settings', sub: 'Preferences' },
    { icon: '❓', label: 'Help Center', page: 'help', sub: 'FAQ & support' },
    { icon: '⭐', label: 'Loyalty', page: 'loyalty', sub: 'XP, Tier, Rakeback' },
{ icon: '📜', label: 'Rewards History', page: 'rewards-history', sub: 'XP & purchases' },
  ];
  
</script>

<div class="pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={() => onNavigate('home')}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">Profile</h1>
    <button
      on:click={() => onNavigate('settings')}
      aria-label="Settings"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  </div>

  <!-- HERO CARD -->
  <div
    class="mx-4 rounded-3xl p-4 mb-3 relative overflow-hidden"
    style="
      background:
        radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 60%),
        linear-gradient(180deg, rgba(30,58,138,0.4) 0%, rgba(15,31,58,0.85) 50%, rgba(7,14,27,0.95) 100%);
      border: 1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(212,175,55,0.12);
    "
  >
    <div class="flex items-center gap-4 relative">
      <button
        on:click={() => (showAvatarPicker = true)}
        aria-label="Change avatar"
        class="shrink-0 relative active:scale-95 transition"
      >
        <Avatar avatarId={selectedAvatar} size="xl" frame={selectedFrame} />
        <div
          class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); border: 2px solid #0a0d1a;"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0800" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
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
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        </div>
        <p class="text-[11px] text-white/50 font-mono mb-2 truncate">
          @{user?.username || 'player'}
        </p>
        <div class="flex items-center gap-2 flex-wrap">
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
            style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); box-shadow: 0 2px 6px rgba(0,0,0,0.5);"
          >
            <span class="text-[9px] font-extrabold text-black/70 uppercase tracking-wide">Level</span>
            <span class="text-[13px] font-extrabold text-black leading-none">{level}</span>
          </div>
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
            style="background: {tierColor}25; border: 1px solid {tierColor}80;"
          >
            <span class="text-sm leading-none">{tierIcon}</span>
            <span class="text-[11px] font-extrabold" style="color: {tierColor};">{tierLabel}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- REAL MONEY -->
  <div
    class="mx-4 rounded-3xl mb-3 overflow-hidden"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.75), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.3);"
  >
    <div class="p-4" style="background: linear-gradient(180deg, rgba(30,58,138,0.15), transparent);">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">💰</span>
        <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #60a5fa;">Real Money</p>
        <button
          on:click={() => (infoOpen = 'real')}
          aria-label="Info"
          class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white/50 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
        >?</button>
      </div>
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands</p>
          <p class="text-lg font-extrabold text-white tabular-nums leading-none">{realHands.toLocaleString()}</p>
        </div>
        <div class="text-center" style="border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Won</p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #d4af37;">{fmtMoney(realWon)}</p>
        </div>
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Win %</p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #60a5fa;">{realWinRate}%</p>
        </div>
      </div>

      <div style="height: 1px; background: rgba(212,175,55,0.15); margin: 8px 0;"></div>

      <div class="space-y-1.5 text-[11px]">
        <div class="flex items-center gap-2">
          <span>💵</span>
          <span class="text-white/60 flex-1">Rake Paid</span>
          <span class="font-extrabold tabular-nums" style="color: #fca5a5;">−{fmtMoney(rakePaid)}</span>
          <button on:click={() => (infoOpen = 'rake')} aria-label="Info" class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white/40 active:scale-95" style="background: rgba(255,255,255,0.06);">?</button>
        </div>
        <div class="flex items-center gap-2">
          <span>🎁</span>
          <span class="text-white/60 flex-1">Rakeback Earned</span>
          <span class="font-extrabold tabular-nums" style="color: #6ee7b7;">+{fmtMoney(rakebackEarned)}</span>
          <button on:click={() => (infoOpen = 'rakeback')} aria-label="Info" class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white/40 active:scale-95" style="background: rgba(255,255,255,0.06);">?</button>
        </div>
        <div class="flex items-center gap-2 pt-1" style="border-top: 1px solid rgba(255,255,255,0.06);">
          <span>💎</span>
          <span class="text-white/70 flex-1 font-bold">Net Position</span>
          <span class="font-extrabold tabular-nums text-base" style="color: {netPosition >= 0 ? '#6ee7b7' : '#fca5a5'};">{netPosition >= 0 ? '+' : ''}{fmtMoney(netPosition)}</span>
          <button on:click={() => (infoOpen = 'net')} aria-label="Info" class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white/40 active:scale-95" style="background: rgba(255,255,255,0.06);">?</button>
        </div>
      </div>
    </div>
  </div>

  <!-- FREE PLAY -->
  <button
    on:click={() => (showFreeDetail = true)}
    class="w-full mx-4 rounded-3xl mb-3 p-4 text-left active:scale-[0.98] transition"
    style="background: linear-gradient(180deg, rgba(16,185,129,0.1), rgba(7,14,27,0.95)); border: 1.5px solid rgba(16,185,129,0.35); width: calc(100% - 2rem);"
  >
    <div class="flex items-center gap-2 mb-3">
      <span class="text-base">🎮</span>
      <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #6ee7b7;">Free Play</p>
      <span class="text-[10px] text-white/40 font-bold flex items-center gap-1">
        Details
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div>
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands</p>
        <p class="text-lg font-extrabold text-white tabular-nums leading-none">{freeHands.toLocaleString()}</p>
      </div>
      <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Won</p>
        <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #6ee7b7;">{freeHandsWon.toLocaleString()}</p>
      </div>
      <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Chips</p>
        <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #d4af37;">{fmtChips(freeChipsBalance)}</p>
      </div>
    </div>
  </button>

  <!-- LOYALTY PROGRESS -->
  <div
    class="mx-4 rounded-3xl p-4 mb-3"
    style="background: linear-gradient(180deg, rgba(139,92,246,0.1), rgba(7,14,27,0.95)); border: 1.5px solid rgba(139,92,246,0.4);"
  >
    <div class="flex items-center gap-2 mb-3">
      <span class="text-base">⭐</span>
      <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #a78bfa;">Loyalty Progress</p>
      <button
        on:click={() => (infoOpen = 'loyalty')}
        aria-label="Info"
        class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white/50 active:scale-95"
        style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
      >?</button>
    </div>

    <!-- XP bar -->
    <div class="mb-4">
      <div class="flex justify-between items-center mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-extrabold text-white/70 uppercase tracking-wider">XP</span>
          <span class="text-[9px] text-white/40 font-mono tabular-nums">{xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
        </div>
        <span class="text-[10px] font-extrabold" style="color: #a78bfa;">Level {level}</span>
      </div>
      <div class="w-full h-2.5 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.55);">
        <div
          class="h-full rounded-full transition-all"
          style="width: {xpPct}%; background: linear-gradient(90deg, #c4b5fd 0%, #8b5cf6 50%, #6d28d9 100%); box-shadow: 0 0 12px rgba(139,92,246,0.7);"
        ></div>
      </div>
      <p class="text-[9px] text-white/40 mt-1 tabular-nums">
        {Math.max(0, xpForNextLevel - xpIntoLevel).toLocaleString()} XP تا Level {level + 1} · موجودی: <span style="color: #a78bfa;" class="font-bold">{availableXp.toLocaleString()} XP</span>
      </p>
    </div>

    <!-- Tier bar -->
    <div class="mb-4">
      <div class="flex justify-between items-center mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-sm leading-none">{tierIcon}</span>
          <span class="text-[10px] font-extrabold uppercase tracking-wider" style="color: {tierColor};">{tierLabel} · Rakeback {rakebackPct}%</span>
        </div>
        {#if nextTier}
          <span class="text-[9px] text-white/40 font-mono tabular-nums">{fmtMoney(lifetimeRake)} / {fmtMoney(nextTier.minRake)}</span>
        {/if}
      </div>
      <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.55);">
        <div
          class="h-full rounded-full transition-all"
          style="width: {progressToNextTier}%; background: linear-gradient(90deg, {tierColor}, {tierColor}cc); box-shadow: 0 0 12px {tierColor}80;"
        ></div>
      </div>
      {#if nextTier}
        <p class="text-[9px] text-white/40 mt-1">
          تا {nextTier.label}: <span style="color: {tierColor};" class="font-bold">{fmtMoney(Math.max(0, nextTier.minRake - lifetimeRake))}</span> ریک دیگه
        </p>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="flex gap-2">
      <button
        on:click={() => onNavigate('shop')}
        class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 transition"
        style="background: linear-gradient(180deg, rgba(139,92,246,0.25), rgba(139,92,246,0.08)); border: 1px solid rgba(139,92,246,0.5); color: #e9d5ff;"
      >
        💎 Cash Out XP
      </button>
      <button
  on:click={() => (showXpConvert = true)}
  class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 transition"
  style="background: linear-gradient(180deg, rgba(139,92,246,0.25), rgba(139,92,246,0.08)); border: 1px solid rgba(139,92,246,0.5); color: #e9d5ff;"
>
  💎 Cash Out XP
</button>
    </div>
  </div>

  <!-- VOUCHERS -->
  {#if activeVouchers.length > 0}
    <div
      class="mx-4 rounded-3xl p-4 mb-3"
      style="background: linear-gradient(180deg, rgba(244,201,93,0.08), rgba(7,14,27,0.95)); border: 1.5px solid rgba(244,201,93,0.4);"
    >
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">🎫</span>
        <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #f4c95d;">Vouchers</p>
        <span class="text-[11px] font-extrabold" style="color: #f4c95d;">{fmtMoney(vouchersTotal)} active</span>
        <button
          on:click={() => (infoOpen = 'vouchers')}
          aria-label="Info"
          class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white/50 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
        >?</button>
      </div>
      <div class="space-y-2">
        {#each activeVouchers as v}
          <div class="rounded-xl p-2.5" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(244,201,93,0.25);">
            <div class="flex justify-between items-center text-[10px] mb-1.5">
              <span class="font-extrabold" style="color: #f4c95d;">{fmtMoney(v.amount)}</span>
              <span class="text-white/50 font-mono tabular-nums">{fmtMoney(v.currentRake)} / {fmtMoney(v.minRake)} rake</span>
            </div>
            <div class="w-full h-1.5 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.5);">
              <div class="h-full rounded-full transition-all" style="width: {v.progressPct}%; background: linear-gradient(90deg, #f4e5a8, #d4af37); box-shadow: 0 0 8px rgba(244,201,93,0.5);"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- SEEDS -->
  {#if seeds.length > 0}
    <div
      class="mx-4 rounded-3xl p-4 mb-3"
      style="background: linear-gradient(180deg, rgba(34,197,94,0.08), rgba(7,14,27,0.95)); border: 1.5px solid rgba(34,197,94,0.4);"
    >
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">🌱</span>
        <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #4ade80;">Seeds</p>
        <button
          on:click={() => (infoOpen = 'seeds')}
          aria-label="Info"
          class="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white/50 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
        >?</button>
      </div>
      <div class="space-y-2">
        {#each seeds as s}
  {@const pct = Math.min(100, Math.round((s.progress.freeHands / s.progress.minFreeHands) * 100))}
  <button
    type="button"
    on:click={() => openSeedClaim(s)}
    disabled={!s.eligible || s.claimed}
    class="w-full flex items-center gap-2.5 p-2 rounded-xl text-left active:scale-[0.98] transition disabled:cursor-default"
    style="background: rgba(0,0,0,0.35); {s.eligible && !s.claimed ? 'border: 1px solid rgba(34,197,94,0.5); box-shadow: 0 0 12px rgba(34,197,94,0.25);' : 'border: 1px solid transparent;'}"
  >
    <span class="text-lg">{s.icon}</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-0.5">
        <p class="text-[11px] font-extrabold text-white truncate">{s.label}</p>
        {#if s.claimed}
          <span class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full" style="background: rgba(16,185,129,0.25); color: #6ee7b7;">✓ CLAIMED</span>
        {:else if s.eligible}
          <span class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse" style="background: rgba(34,197,94,0.4); color: #86efac;">TAP TO CLAIM</span>
        {:else}
          <span class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full" style="background: rgba(107,114,128,0.3); color: #9ca3af;">LOCKED</span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.5);">
          <div class="h-full rounded-full transition-all" style="width: {pct}%; background: linear-gradient(90deg, #86efac, #22c55e); box-shadow: 0 0 6px rgba(34,197,94,0.6);"></div>
        </div>
        <span class="text-[9px] font-mono tabular-nums text-white/60">{s.progress.freeHands.toLocaleString()}/{s.progress.minFreeHands.toLocaleString()}</span>
      </div>
    </div>
    <span class="text-[11px] font-extrabold tabular-nums shrink-0" style="color: #86efac;">${s.amount.toFixed(2)}</span>
  </button>
{/each}
</div>
  </div>         
{/if}


  <!-- TROPHIES -->
  <div
    class="mx-4 rounded-3xl p-3 mb-3 flex items-center gap-3"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.75), rgba(7,14,27,0.95)); border: 1.5px solid rgba(139,92,246,0.2);"
  >
    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.35);"
    >
      🏆
    </div>
    <div class="flex-1">
      <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Trophies</p>
      <p class="text-base font-extrabold tabular-nums leading-tight" style="color: #a78bfa;">{trophies}</p>
    </div>
    <button
      on:click={() => onNavigate('achievements')}
      class="text-[10px] font-bold text-white/40 flex items-center gap-1 active:text-white/70"
    >
      View
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  </div>

  <!-- ACCOUNT MENU -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-extrabold mb-2 px-5 mt-5">Account</h2>
  <div class="mx-4 rounded-2xl overflow-hidden mb-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    {#each ACCOUNT_MENU as item, i}
      <button on:click={() => onNavigate(item.page)} class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition" style="border-bottom: {i < ACCOUNT_MENU.length - 1 ? '1px solid rgba(212,175,55,0.08)' : 'none'};">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.15);">{item.icon}</div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-white/90 leading-tight">{item.label}</p>
          <p class="text-[10px] text-white/40 leading-tight mt-0.5">{item.sub}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    {/each}
  </div>

  <!-- MORE MENU -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-extrabold mb-2 px-5">More</h2>
  <div class="mx-4 rounded-2xl overflow-hidden mb-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    {#each MORE_MENU as item, i}
      <button on:click={() => onNavigate(item.page)} class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition" style="border-bottom: {i < MORE_MENU.length - 1 ? '1px solid rgba(212,175,55,0.08)' : 'none'};">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.15);">{item.icon}</div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-white/90 leading-tight">{item.label}</p>
          <p class="text-[10px] text-white/40 leading-tight mt-0.5">{item.sub}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
    {/each}
  </div>

  <!-- LOGOUT -->
  <div class="mx-4 rounded-2xl overflow-hidden mb-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(239,68,68,0.25);">
    <button on:click={() => auth.logout()} class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-red-500/5 transition">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);">🚪</div>
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-bold text-red-400 leading-tight">Logout</p>
        <p class="text-[10px] text-white/40 leading-tight mt-0.5">Sign out of account</p>
      </div>
    </button>
  </div>

  <!-- Hidden version text (20-tap secret admin) -->
  <button
    type="button"
    class="w-full text-center text-[8px] text-white/15 mt-8 mb-2 select-none cursor-default bg-transparent border-0"
    on:click={handleVersionTap}
    aria-hidden="true"
    tabindex="-1"
  >Flop Club v1.0.0</button>
</div>

<!-- MODALS -->
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

<!-- INFO SHEETS -->
<InfoSheet
  open={infoOpen === 'real'}
  title={INFO_META.real.title}
  icon={INFO_META.real.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">این آمار فقط دست‌هایی رو نشون می‌ده که با پول واقعی روی میزهای Real بازی کردی.</p>
  <ul class="space-y-1.5 mb-3">
    <li><strong class="text-white">HANDS:</strong> تعداد دست‌هایی که بازی کردی</li>
    <li><strong class="text-white">WON:</strong> مجموع پولی که بردی (بعد از ریک)</li>
    <li><strong class="text-white">WIN%:</strong> درصد دست‌هایی که برنده شدی</li>
  </ul>
  <div class="rounded-xl p-3" style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.25);">
    <p class="text-[11px]"><strong class="text-gold">💡 مثال:</strong> 100 دست بازی کردی، $5 بردی، 45 دست برنده شدی → WIN 45%</p>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'rake'}
  title={INFO_META.rake.title}
  icon={INFO_META.rake.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">ریک = کمیسیون پلتفرم از هر دست. ما <strong class="text-white">3%</strong> از پات هر دست رو ریک می‌گیریم.</p>
  <div class="rounded-xl p-3 mb-3" style="background: rgba(30,58,138,0.15); border: 1px solid rgba(96,165,250,0.3);">
    <p class="text-[11px] mb-1"><strong class="text-blue-300">📊 محاسبه:</strong></p>
    <p class="text-[11px] font-mono">پات $100 → ریک $3</p>
    <p class="text-[11px] font-mono">سهم تو از پات: $50 → سهم تو از ریک: $1.50</p>
  </div>
  <p>ولی ما <strong class="text-emerald-400">{rakebackPct}%</strong> این مبلغ رو بهت برمی‌گردونیم به عنوان Rakeback!</p>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'rakeback'}
  title={INFO_META.rakeback.title}
  icon={INFO_META.rakeback.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">از هر ریکی که پلتفرم می‌گیره، بخشی رو مستقیم به حساب تو برمی‌گردونیم.</p>
  <div class="rounded-xl p-3 mb-3" style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3);">
    <p class="text-[11px] mb-1"><strong class="text-gold">نرخ فعلی تو:</strong></p>
    <p class="text-[13px] font-extrabold" style="color: {tierColor};">{tierIcon} {tierLabel} → {rakebackPct}% Rakeback</p>
  </div>
  <p class="mb-2 font-bold text-white">📈 جدول نرخ‌ها:</p>
  <div class="space-y-1 text-[11px] font-mono">
    <div class="flex justify-between"><span>🌱 Welcome (L1-5)</span><span class="text-emerald-400">60%</span></div>
    <div class="flex justify-between"><span>🥉 Bronze (L6-15)</span><span class="text-amber-600">50%</span></div>
    <div class="flex justify-between"><span>🥈 Silver (L16-30)</span><span class="text-slate-300">45%</span></div>
    <div class="flex justify-between"><span>🥇 Gold (L31-50)</span><span class="text-yellow-400">40%</span></div>
    <div class="flex justify-between"><span>💎 Platinum (L51-80)</span><span class="text-indigo-300">35%</span></div>
    <div class="flex justify-between"><span>💠 Diamond (L81+)</span><span class="text-cyan-300">30%</span></div>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'net'}
  title={INFO_META.net.title}
  icon={INFO_META.net.icon}
  onClose={() => (infoOpen = null)}
>
  <div class="rounded-xl p-3 mb-3" style="background: rgba(30,58,138,0.15); border: 1px solid rgba(96,165,250,0.3);">
    <p class="text-[12px] font-mono text-center"><strong class="text-white">Net = Won − Rake Paid + Rakeback</strong></p>
  </div>
  <p class="mb-3">این عدد نشون می‌ده که آیا الان در سود هستی یا در ضرر (بدون در نظر گرفتن پول اولت).</p>
  <ul class="space-y-1.5">
    <li>✅ <strong class="text-emerald-400">اگه مثبت باشه</strong> → تو برنده‌ای 🎉</li>
    <li>💪 <strong class="text-red-400">اگه منفی باشه</strong> → هنوز جبران نشده</li>
  </ul>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'free'}
  title={INFO_META.free.title}
  icon={INFO_META.free.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">چیپ‌های Free برای تمرین و یادگیری. هیچ ارزش نقدی ندارن.</p>
  <ul class="space-y-1.5 mb-3">
    <li><strong class="text-white">HANDS:</strong> تعداد دست‌های Free</li>
    <li><strong class="text-white">WON:</strong> تعداد دست‌هایی که بردی</li>
    <li><strong class="text-white">CHIPS:</strong> موجودی فعلی چیپ</li>
  </ul>
  <div class="rounded-xl p-3" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);">
    <p class="text-[11px]">🎁 با بازی Free می‌تونی <strong class="text-emerald-400">Seed</strong> بگیری که پول واقعی رایگانه!</p>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'loyalty'}
  title={INFO_META.loyalty.title}
  icon={INFO_META.loyalty.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3 font-bold text-white">🎯 دو سیستم جدا:</p>
  <div class="space-y-2 mb-3">
    <div class="rounded-xl p-3" style="background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);">
      <p class="text-[11px] font-extrabold mb-1" style="color: #a78bfa;">1️⃣ XP Level</p>
      <p class="text-[11px]">بر اساس XP کسب‌شده. 6 Tier، پلکانی سخت‌تر. الان: <strong class="text-white">Level {level}</strong></p>
    </div>
    <div class="rounded-xl p-3" style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3);">
      <p class="text-[11px] font-extrabold mb-1" style="color: #f4c95d;">2️⃣ Rakeback Tier</p>
      <p class="text-[11px]">بر اساس ریک تجمعی. Rakeback % رو تعیین می‌کنه. الان: <strong style="color: {tierColor};">{rakebackPct}% ({tierLabel})</strong></p>
    </div>
  </div>
  <div class="rounded-xl p-3" style="background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.3);">
    <p class="text-[11px]"><strong class="text-cyan-300">💡 مستقل هستن:</strong> یه بازیکن با XP بالا می‌تونه ریک کم بده و برعکس!</p>
  </div>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'vouchers'}
  title={INFO_META.vouchers.title}
  icon={INFO_META.vouchers.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">Voucher یه جایزه‌ی نقدی شرطی هست که از خرید Shop میاد.</p>
  <p class="mb-2 font-bold text-white">📋 چطور فعال می‌شه:</p>
  <ol class="space-y-1.5 mb-3 list-decimal pl-4">
    <li>Voucher می‌خری (مثلاً $4)</li>
    <li>باید <strong class="text-white">2.5 برابر</strong> ریک بدی تا فعال شه (مثلاً $10 ریک برای $4 Voucher)</li>
    <li>وقتی به آستانه رسید، مبلغ خودکار به حسابت اضافه می‌شه</li>
    <li>مهلت: <strong class="text-white">90 روز</strong></li>
  </ol>
</InfoSheet>

<InfoSheet
  open={infoOpen === 'seeds'}
  title={INFO_META.seeds.title}
  icon={INFO_META.seeds.icon}
  onClose={() => (infoOpen = null)}
>
  <p class="mb-3">جایزه‌های پول واقعی که با بازی Free به دست میاری.</p>
  <div class="space-y-1.5 mb-3 text-[11px]">
    <div class="flex justify-between"><span>🥉 Bronze</span><span class="font-mono">50 دست + 10 برد → $0.50</span></div>
    <div class="flex justify-between"><span>🥈 Silver</span><span class="font-mono">200 دست + 50 برد → $1.00</span></div>
    <div class="flex justify-between"><span>🥇 Gold</span><span class="font-mono">500 دست + 150 برد → $2.50</span></div>
    <div class="flex justify-between"><span>💎 Platinum</span><span class="font-mono">2000 دست + 500 برد → $5.00</span></div>
  </div>
  <div class="rounded-xl p-3" style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3);">
    <p class="text-[11px] mb-1"><strong class="text-amber-400">⚠️ برای برداشت این جوایز:</strong></p>
    <ul class="space-y-0.5 list-disc pl-4 text-[11px]">
      <li>10x مبلغ جایزه رو بازی کنی</li>
      <li>حداقل $15 ریک بدی</li>
      <li>150 دست Real بازی کنی</li>
      <li>14 روز صبر کنی</li>
    </ul>
    <SeedClaimModal
  bind:open={showSeedClaim}
  seed={selectedSeed}
  onClose={() => { showSeedClaim = false; selectedSeed = null; }}
/>

<XPConvertModal
  bind:open={showXpConvert}
  availableXp={availableXp}
  level={level}
  onClose={() => (showXpConvert = false)}
/>
  </div>
</InfoSheet>

<!-- INFO TITLE HELPER (invisible, for type safety) -->
<span class="hidden" aria-hidden="true">
  {infoOpen ? INFO_META[infoOpen].title : ''}
</span>