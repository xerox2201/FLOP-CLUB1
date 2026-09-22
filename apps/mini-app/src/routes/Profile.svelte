<script lang="ts">
  import { requestAdmin } from '../stores/admin';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import AvatarFramePicker from '../components/AvatarFramePicker.svelte';
  import { AVATARS } from '../lib/avatars';

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

  $: user = $auth.user;
  $: chips = $auth.freeChips;
  $: stats = $auth.stats;
  $: selectedAvatar = (user as any)?.avatar_id || 'king';
  $: selectedFrame = (user as any)?.frame_id || 'royal';

  // Stats (real money only for win rate + level)
  $: totalHands = stats?.totalHands ?? chips?.total_hands ?? 0;
  $: handsPlayedReal = stats?.handsPlayedReal ?? 0;
  $: handsWon = stats?.handsWon ?? 0;
  $: totalWon = stats?.totalWon ?? 0;
  $: trophies = stats?.trophies ?? 0;

  // Win rate: real money only
  $: winRate = handsPlayedReal > 0
    ? Math.round((handsWon / handsPlayedReal) * 100)
    : 0;

  // Level: $100 won on real tables = 1 level
  const USD_PER_LEVEL = 100;
  $: level = Math.floor(totalWon / USD_PER_LEVEL) + 1;
  $: xpCurrent = totalWon % USD_PER_LEVEL;
  $: xpTotal = USD_PER_LEVEL;

  async function pickAvatar(id: string) {
    if (user) (user as any).avatar_id = id;
    await api.updateAvatar(id);
    await auth.refresh();
  }
function pickFrame(frame: string | null) {
  if (!frame) return;
  if (user) (user as any).frame_id = frame;
  // TODO: save to backend later
}
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center gap-3 mt-3 mb-5 px-4">
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

  <!-- PROFILE CARD -->
  <div
    class="mx-4 rounded-3xl p-5 mb-5 relative overflow-hidden"
    style="
      background:
        radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.2) 0%, transparent 60%),
        linear-gradient(180deg, rgba(30,58,138,0.4) 0%, rgba(15,31,58,0.85) 50%, rgba(7,14,27,0.95) 100%);
      border: 1.5px solid rgba(212,175,55,0.4);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.15);
    "
  >
    <div class="absolute -top-16 -left-16 w-48 h-48 rounded-full opacity-20 pointer-events-none"
         style="background: radial-gradient(circle, #3b82f6, transparent 70%);"></div>
    <div class="absolute -bottom-16 -right-16 w-48 h-48 rounded-full opacity-20 pointer-events-none"
         style="background: radial-gradient(circle, #d4af37, transparent 70%);"></div>

    <!-- Avatar centered -->
    <div class="relative flex flex-col items-center">
      <div class="relative">
        <div
          class="absolute -inset-4 rounded-full opacity-60 pointer-events-none"
          style="background: radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%); filter: blur(16px);"
        ></div>
        <Avatar avatarId={selectedAvatar} size="xl" frame={selectedFrame} />
      </div>

      <div class="mt-5 flex items-center gap-2">
        <p class="text-xl font-extrabold text-white">{user?.display_name || 'Player'}</p>
        <span
          class="w-4 h-4 rounded-full flex items-center justify-center"
          style="background: linear-gradient(180deg, #3b82f6, #1e40af); box-shadow: 0 2px 6px rgba(59,130,246,0.5);"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      </div>
      <p class="text-[11px] text-white/50 font-mono mt-1">@{user?.username || 'player'}</p>

      <!-- Level -->
      <div
        class="mt-3 px-4 py-1 rounded-full flex items-center gap-2"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); box-shadow: 0 3px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.5);"
      >
        <span class="text-[10px] font-extrabold text-black/70">Level</span>
        <span class="text-[14px] font-extrabold text-black">{level}</span>
      </div>
    </div>

    <!-- XP -->
    <div class="mt-5 pt-4" style="border-top: 1px solid rgba(212,175,55,0.2);">
      <div class="flex justify-between items-center mb-2">
        <span class="text-[10px] uppercase tracking-widest text-gold/80 font-extrabold">
          XP · Real Winnings
        </span>
        <span class="text-[10px] font-extrabold text-white/60 tabular-nums">
          ${xpCurrent.toFixed(2)} / ${xpTotal}
        </span>
      </div>
      <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.55);">
        <div
          class="h-full rounded-full transition-all"
          style="
            width: {Math.min(100, (xpCurrent / xpTotal) * 100)}%;
            background: linear-gradient(90deg, #f4e5a8 0%, #d4af37 50%, #a87a15 100%);
            box-shadow: 0 0 12px rgba(212,175,55,0.7);
          "
        ></div>
      </div>
      <p class="text-[9px] text-white/40 mt-1.5 text-right tabular-nums">
        Total won: <span class="text-gold font-bold">${totalWon.toFixed(2)}</span>
      </p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-2 mt-5">
      <div class="rounded-2xl p-3 text-center" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(96,165,250,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Win Rate</p>
        <p class="text-lg font-extrabold tabular-nums" style="color: #60a5fa;">{winRate}%</p>
      </div>
      <div class="rounded-2xl p-3 text-center" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(212,175,55,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands</p>
        <p class="text-lg font-extrabold text-gold tabular-nums">{totalHands}</p>
      </div>
      <div class="rounded-2xl p-3 text-center" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(139,92,246,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Trophies</p>
        <p class="text-lg font-extrabold tabular-nums" style="color: #a78bfa;">{trophies}</p>
      </div>
    </div>
  </div>

  <!-- AVATAR FRAME PICKER -->
  <div class="flex items-center justify-between mb-3 px-4">
    <h2 class="text-base font-extrabold text-white">Avatar Frame</h2>
    <button on:click={() => onNavigate('shop')} class="text-[10px] font-bold text-gold active:opacity-70">
      See all →
    </button>
  </div>

  <div class="mx-4 rounded-2xl p-3 mb-5" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    <AvatarFramePicker selected={selectedFrame} onSelect={pickFrame} avatarId={selectedAvatar} />
  </div>

  <!-- CHANGE AVATAR -->
  <div class="flex items-center justify-between mb-3 px-4">
    <h2 class="text-base font-extrabold text-white">Change Avatar</h2>
  </div>

  <div class="mx-4 rounded-2xl p-3 mb-5" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    <div class="grid grid-cols-6 gap-2">
      {#each AVATARS as a}
        <button
          on:click={() => pickAvatar(a.id)}
          aria-label={a.id}
          class="aspect-square rounded-2xl overflow-hidden transition-all active:scale-95 {selectedAvatar === a.id
            ? 'ring-2 ring-gold ring-offset-2 ring-offset-navy-dark scale-105'
            : 'opacity-70 hover:opacity-100'}"
          style="background: radial-gradient(circle, #1a3a5c, #05080f);"
        >
          <img src="/avatars/avatar-{a.id}.png" alt={a.id} class="w-full h-full object-cover" draggable="false" />
        </button>
      {/each}
    </div>
  </div>

  <!-- MENU -->
  <h2 class="text-base font-extrabold text-white mb-3 px-4">Menu</h2>
  <div class="mx-4 rounded-2xl overflow-hidden" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
    {#each [
      { icon: '🎫', label: 'My Tournaments', page: 'my-tournaments' },
      { icon: '🏅', label: 'Achievements', page: 'achievements' },
      { icon: '🛒', label: 'Shop', page: 'shop' },
      { icon: '🔔', label: 'Notifications', page: 'notifications' },
      { icon: '🏆', label: 'Leaderboard', page: 'leaderboard' },
      { icon: '💰', label: 'Wallet', page: 'wallet' },
      { icon: '⚙️', label: 'Settings', page: 'settings' },
      { icon: '❓', label: 'Help Center', page: 'help' },
    ] as item}
      <button
        on:click={() => onNavigate(item.page)}
        class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
        style="border-bottom: 1px solid rgba(212,175,55,0.08);"
      >
        <span class="text-lg w-7">{item.icon}</span>
        <span class="flex-1 text-sm font-bold text-white/90">{item.label}</span>
        <span class="text-gold text-sm">›</span>
      </button>
    {/each}

    <button on:click={() => auth.logout()} class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5">
      <span class="text-lg w-7">🚪</span>
      <span class="flex-1 text-sm font-bold text-red-400">Logout</span>
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