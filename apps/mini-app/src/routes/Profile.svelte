<script lang="ts">
  import { requestAdmin } from '../stores/admin';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import AvatarPickerModal from '../components/AvatarPickerModal.svelte';
  import FreePlayDetailModal from '../components/FreePlayDetailModal.svelte';

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

  export let onNavigate: (page: any) => void = () => {};

  let showAvatarPicker = false;
  let showFreeDetail = false;

  $: user = $auth.user;
  $: chips = $auth.freeChips;
  $: stats = $auth.stats;
  $: selectedAvatar = (user as any)?.avatar_id || 'king';
  $: selectedFrame = (user as any)?.frame_id || 'royal';

  // Real stats
  $: realHands = stats?.handsPlayedReal ?? 0;
  $: realWon = stats?.totalWon ?? 0;
  $: realHandsWon = stats?.handsWon ?? 0;
  $: realWinRate = realHands > 0 ? Math.round((realHandsWon / realHands) * 100) : 0;

  // Free stats
  $: freeHands = (chips as any)?.free_hands ?? chips?.total_hands ?? 0;
  $: freeWon = (chips as any)?.free_won ?? 0;
  $: freeHandsWon = (chips as any)?.free_hands_won ?? 0;
  $: freeChipsBalance = Number(chips?.chips ?? 0);

  $: trophies = stats?.trophies ?? 0;

  // Level (real winnings $100 = 1 level)
  const USD_PER_LEVEL = 100;
  $: level = Math.floor(realWon / USD_PER_LEVEL) + 1;
  $: xpCurrent = realWon % USD_PER_LEVEL;
  $: xpTotal = USD_PER_LEVEL;

  async function pickAvatar(id: string) {
    if (user) (user as any).avatar_id = id;
    await api.updateAvatar(id);
    await auth.refresh();
  }

  function pickFrame(frame: string | null) {
    if (!frame) return;
    if (user) (user as any).frame_id = frame;
  }

  function fmtMoney(n: any): string {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  function fmtChips(n: any): string {
    const num = Number(n || 0);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
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

  <!-- HERO CARD (compact) -->
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
      <!-- Avatar (click to customize) -->
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

      <!-- Info -->
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
        <div
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); box-shadow: 0 2px 6px rgba(0,0,0,0.5);"
        >
          <span class="text-[9px] font-extrabold text-black/70 uppercase tracking-wide">Level</span>
          <span class="text-[13px] font-extrabold text-black leading-none">{level}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- STATS CARD (Real / Free split) -->
  <div
    class="mx-4 rounded-3xl mb-3 overflow-hidden"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.75), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.2); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
  >
    <!-- REAL PLAY -->
    <div class="p-4" style="background: linear-gradient(180deg, rgba(30,58,138,0.15), transparent);">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">💎</span>
        <p class="text-[10px] uppercase tracking-widest font-extrabold" style="color: #60a5fa;">
          Real Play
        </p>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands</p>
          <p class="text-lg font-extrabold text-white tabular-nums leading-none">
            {realHands.toLocaleString()}
          </p>
        </div>
        <div
          class="text-center"
          style="border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);"
        >
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Won</p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #d4af37;">
            {fmtMoney(realWon)}
          </p>
        </div>
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Win %</p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #60a5fa;">
            {realWinRate}%
          </p>
        </div>
      </div>
    </div>

    <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.2), transparent);"></div>

    <!-- FREE PLAY -->
    <button
      on:click={() => (showFreeDetail = true)}
      class="w-full text-left p-4 active:bg-white/[0.02] transition"
      style="background: linear-gradient(180deg, rgba(16,185,129,0.08), transparent);"
    >
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">🎁</span>
        <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1" style="color: #6ee7b7;">
          Free Play
        </p>
        <span class="text-[10px] text-white/40 font-bold flex items-center gap-1">
          Details
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands</p>
          <p class="text-lg font-extrabold text-white tabular-nums leading-none">
            {freeHands.toLocaleString()}
          </p>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Chips</p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #6ee7b7;">
            {fmtChips(freeChipsBalance)}
          </p>
        </div>
      </div>
    </button>
  </div>

  <!-- XP PROGRESS -->
  <div
    class="mx-4 rounded-3xl p-4 mb-3"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.75), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.2);"
  >
    <div class="flex justify-between items-center mb-2">
      <span class="text-[10px] uppercase tracking-widest font-extrabold" style="color: #e8c45a;">
        XP · Real Winnings
      </span>
      <span class="text-[10px] font-extrabold text-white/60 tabular-nums">
        {fmtMoney(xpCurrent)} / ${xpTotal}
      </span>
    </div>
    <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.55);">
      <div
        class="h-full rounded-full transition-all"
        style="width: {Math.min(100, (xpCurrent / xpTotal) * 100)}%; background: linear-gradient(90deg, #f4e5a8 0%, #d4af37 50%, #a87a15 100%); box-shadow: 0 0 12px rgba(212,175,55,0.7);"
      ></div>
    </div>
    <p class="text-[9px] text-white/40 mt-1.5 text-right tabular-nums">
      Total Real Won: <span class="text-gold font-bold">{fmtMoney(realWon)}</span>
    </p>
  </div>

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
      <p class="text-base font-extrabold tabular-nums leading-tight" style="color: #a78bfa;">
        {trophies}
      </p>
    </div>
    <button
      on:click={() => onNavigate('achievements')}
      class="text-[10px] font-bold text-white/40 flex items-center gap-1 active:text-white/70"
    >
      View
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  </div>

  <!-- ACCOUNT MENU -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-extrabold mb-2 px-5 mt-5">
    Account
  </h2>
  <div
    class="mx-4 rounded-2xl overflow-hidden mb-4"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
  >
    {#each ACCOUNT_MENU as item, i}
      <button
        on:click={() => onNavigate(item.page)}
        class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition"
        style="border-bottom: {i < ACCOUNT_MENU.length - 1 ? '1px solid rgba(212,175,55,0.08)' : 'none'};"
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.15);"
        >
          {item.icon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-white/90 leading-tight">{item.label}</p>
          <p class="text-[10px] text-white/40 leading-tight mt-0.5">{item.sub}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    {/each}
  </div>

  <!-- MORE MENU -->
  <h2 class="text-[10px] uppercase tracking-widest text-white/40 font-extrabold mb-2 px-5">More</h2>
  <div
    class="mx-4 rounded-2xl overflow-hidden mb-4"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
  >
    {#each MORE_MENU as item, i}
      <button
        on:click={() => onNavigate(item.page)}
        class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition"
        style="border-bottom: {i < MORE_MENU.length - 1 ? '1px solid rgba(212,175,55,0.08)' : 'none'};"
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
          style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.15);"
        >
          {item.icon}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-white/90 leading-tight">{item.label}</p>
          <p class="text-[10px] text-white/40 leading-tight mt-0.5">{item.sub}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    {/each}
  </div>

  <!-- LOGOUT -->
  <div
    class="mx-4 rounded-2xl overflow-hidden mb-4"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(239,68,68,0.25);"
  >
    <button
      on:click={() => auth.logout()}
      class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-red-500/5 transition"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
        style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3);"
      >
        🚪
      </div>
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
  >
    Flop Club v1.0.0
  </button>
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