<script lang="ts">
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import { t, LANGUAGES, lang, setLang } from '../i18n';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { AVATARS } from '../lib/avatars';

  export let onNavigate: (page: any) => void = () => {};

  $: user = $auth.user;
  $: chips = $auth.freeChips;
  $: selectedAvatar = (user as any)?.avatar_id || 'spade';

  async function pickAvatar(id: string) {
    if (user) (user as any).avatar_id = id;
    await api.updateAvatar(id);
    await auth.refresh();
  }
</script>

<div class="px-4 pb-28">
  <TopBar />
  <h1 class="text-2xl font-extrabold mt-3 mb-5">Profile</h1>

  <!-- Profile card -->
  <div
    class="rounded-3xl p-4 mb-5 relative overflow-hidden"
    style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.1)); border: 1px solid rgba(139,92,246,0.35); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
  >
    <div
      class="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-25"
      style="background: radial-gradient(circle, #8b5cf6, transparent 70%);"
    ></div>

    <div class="relative flex items-center gap-4">
      <Avatar avatarId={selectedAvatar} size="xl" showOnline={true} />
      <div class="flex-1 min-w-0">
        <p class="font-extrabold text-xl truncate text-white">
          {user?.display_name || 'Player'}
        </p>
        <p class="text-sm text-white/50 truncate">
          @{user?.username || 'player'}
        </p>
        <p class="text-[10px] text-white/40 mt-1 font-mono">
          ID: {user?.id}
        </p>
      </div>
    </div>

    <div
      class="grid grid-cols-2 gap-3 mt-4 pt-4"
      style="border-top: 1px solid rgba(139,92,246,0.2);"
    >
      <div>
        <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Hands Played</p>
        <p class="text-lg font-extrabold text-white tabular-nums">
          {chips?.total_hands || 0}
        </p>
      </div>
      <div>
        <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Free Chips</p>
        <p class="text-lg font-extrabold text-emerald-400 tabular-nums">
          {Number(chips?.chips || 0).toLocaleString()}
        </p>
      </div>
    </div>
  </div>

  <!-- Extra nav grid -->
  <div class="grid grid-cols-3 gap-2 mb-4">
    <button
      on:click={() => onNavigate('achievements')}
      class="rounded-2xl p-3 text-center active:scale-[0.97] transition"
      style="background: linear-gradient(135deg, rgba(244,201,93,0.15), rgba(168,121,34,0.05)); border: 1px solid rgba(244,201,93,0.3);"
    >
      <div class="text-2xl mb-1">🏅</div>
      <p class="text-[10px] font-extrabold text-white">Achievements</p>
    </button>
    <button
      on:click={() => onNavigate('shop')}
      class="rounded-2xl p-3 text-center active:scale-[0.97] transition"
      style="background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.05)); border: 1px solid rgba(34,211,238,0.3);"
    >
      <div class="text-2xl mb-1">🛒</div>
      <p class="text-[10px] font-extrabold text-white">Shop</p>
    </button>
    <button
      on:click={() => onNavigate('notifications')}
      class="rounded-2xl p-3 text-center active:scale-[0.97] transition"
      style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.05)); border: 1px solid rgba(139,92,246,0.3);"
    >
      <div class="text-2xl mb-1">🔔</div>
      <p class="text-[10px] font-extrabold text-white">Notifications</p>
    </button>
  </div>

  <!-- Quick nav -->
  <div class="space-y-2 mb-5">
    <button
      on:click={() => onNavigate('leaderboard')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(244,201,93,0.25), rgba(168,121,34,0.15));"
      >
        🏆
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">{$t('leaderboard.title')}</p>
        <p class="text-[10px] text-white/50">{$t('home.prizesTop30')}</p>
      </div>
      <span class="text-gold">→</span>
    </button>

    <button
      on:click={() => onNavigate('tournaments')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.15));"
      >
        🎫
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">{$t('events.title')}</p>
        <p class="text-[10px] text-white/50">{$t('games.tourneySub')}</p>
      </div>
      <span class="text-gold">→</span>
    </button>

    <button
      on:click={() => onNavigate('wallet')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(34,211,238,0.25), rgba(14,116,144,0.15));"
      >
        💰
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">{$t('wallet.title')}</p>
        <p class="text-[10px] text-white/50">
          ${Number($auth.wallet?.balance_usd || 0).toFixed(2)}
        </p>
      </div>
      <span class="text-gold">→</span>
    </button>

    <button
      on:click={() => onNavigate('settings')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(34,211,238,0.25), rgba(14,116,144,0.15));"
      >
        ⚙️
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">Settings</p>
        <p class="text-[10px] text-white/50">Preferences & account</p>
      </div>
      <span class="text-gold">→</span>
    </button>

    <button
      on:click={() => onNavigate('help')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.15));"
      >
        ❓
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">Help Center</p>
        <p class="text-[10px] text-white/50">Rules & FAQ</p>
      </div>
      <span class="text-gold">→</span>
    </button>
  </div>

  <!-- Avatar picker -->
  <h2 class="text-base font-extrabold mb-3 text-white/90">Choose Avatar</h2>
  <div class="card mb-5">
    <div class="grid grid-cols-6 gap-2">
      {#each AVATARS as a}
        <button
          on:click={() => pickAvatar(a.id)}
          aria-label={a.id}
          class="aspect-square rounded-2xl bg-gradient-to-br {a.gradient} flex items-center justify-center text-2xl transition {selectedAvatar ===
          a.id
            ? 'ring-2 ring-gold scale-105'
            : 'opacity-70 hover:opacity-100'}"
        >
          {a.emoji}
        </button>
      {/each}
    </div>
  </div>

  <!-- Language -->
  <h2 class="text-base font-extrabold mb-3 text-white/90">Language</h2>
  <div class="card mb-5">
    <div class="grid grid-cols-3 gap-2">
      {#each LANGUAGES as l}
        <button
          on:click={() => setLang(l.code)}
          class="py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 {lang ===
          l.code
            ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
            : 'bg-white/5 text-white/70'}"
        >
          <span>{l.flag}</span><span>{l.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Logout -->
  <button
    on:click={() => auth.logout()}
    class="w-full py-3.5 rounded-2xl font-bold transition active:scale-[0.98]"
    style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4); color: #fca5a5;"
  >
    Logout
  </button>
</div>
