<script lang="ts">
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import { t, LANGUAGES, lang, setLang } from '../i18n';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { AVATARS } from '../lib/avatars';

  export let onNavigate: (page: any) => void = () => {};
  export let isAdmin: boolean = false;

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
  <h1 class="text-2xl font-extrabold mt-3 mb-5">{$t('profile.title')}</h1>

  <div class="card flex items-center gap-4 mb-5">
    <Avatar avatarId={selectedAvatar} size="xl" showOnline={true} />
    <div class="flex-1 min-w-0">
      <p class="font-bold text-xl truncate">{user?.display_name || 'Player'}</p>
      <p class="text-sm text-white/50 truncate">@{user?.username || 'player'}</p>
      <p class="text-xs text-white/40 mt-1">ID: {user?.id}</p>
    </div>
  </div>

  <div class="space-y-2 mb-5">
    <button on:click={() => onNavigate('leaderboard')} class="card w-full flex items-center gap-3 active:scale-[0.98] transition">
      <span class="text-2xl">🏆</span>
      <div class="flex-1 text-left"><p class="font-bold text-sm">{$t('leaderboard.title')}</p><p class="text-[10px] text-white/50">{$t('home.prizesTop30')}</p></div>
      <span class="text-gold">→</span>
    </button>
    <button on:click={() => onNavigate('events')} class="card w-full flex items-center gap-3 active:scale-[0.98] transition">
      <span class="text-2xl">🎫</span>
      <div class="flex-1 text-left"><p class="font-bold text-sm">{$t('events.title')}</p><p class="text-[10px] text-white/50">{$t('games.tourneySub')}</p></div>
      <span class="text-gold">→</span>
    </button>
    <button on:click={() => onNavigate('wallet')} class="card w-full flex items-center gap-3 active:scale-[0.98] transition">
      <span class="text-2xl">💰</span>
      <div class="flex-1 text-left"><p class="font-bold text-sm">{$t('wallet.title')}</p><p class="text-[10px] text-white/50">${Number($auth.wallet?.balance_usd || 0).toFixed(2)}</p></div>
      <span class="text-gold">→</span>
    </button>
  </div>

  <h2 class="text-lg font-bold mb-3">{$t('profile.chooseAvatar')}</h2>
  <div class="card mb-5">
    <div class="grid grid-cols-6 gap-2">
      {#each AVATARS as a}
        <button on:click={() => pickAvatar(a.id)} class="aspect-square rounded-2xl bg-gradient-to-br {a.gradient} flex items-center justify-center text-2xl transition {selectedAvatar === a.id ? 'ring-2 ring-gold scale-105' : 'opacity-70 hover:opacity-100'}">{a.emoji}</button>
      {/each}
    </div>
  </div>

  <h2 class="text-lg font-bold mb-3">{$t('profile.language')}</h2>
  <div class="card mb-5">
    <div class="grid grid-cols-3 gap-2">
      {#each LANGUAGES as l}
        <button on:click={() => setLang(l.code)} class="py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 {$lang === l.code ? 'bg-gold text-black' : 'bg-white/5 text-white/70'}">
          <span>{l.flag}</span><span>{l.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3 mb-5">
    <div class="card"><p class="text-white/40 text-[11px] mb-1 uppercase tracking-wider">{$t('profile.handsPlayed')}</p><p class="text-2xl font-bold">{chips?.total_hands || 0}</p></div>
    <div class="card"><p class="text-white/40 text-[11px] mb-1 uppercase tracking-wider">{$t('profile.language')}</p><p class="text-2xl font-bold uppercase">{$lang}</p></div>
  </div>

  <button on:click={() => auth.logout()} class="w-full mt-2 bg-red-950/60 border border-red-800/50 hover:bg-red-900/60 text-red-300 py-3.5 rounded-2xl font-semibold transition">{$t('profile.logout')}</button>
</div>