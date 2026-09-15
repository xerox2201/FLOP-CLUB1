<script lang="ts">
  import TopBar from '../components/TopBar.svelte';

  export let onBack: () => void = () => {};

  let search = '';
  let expanded: string | null = null;

  const faqs = [
    {
      id: 'rules',
      icon: '🃏',
      title: 'Poker Rules',
      items: [
        {
          q: "What is Texas Hold'em?",
          a: "Texas Hold'em is the most popular poker variant. Each player receives 2 private hole cards, and 5 community cards are dealt face-up. Players form their best 5-card hand using any combination of hole and community cards.",
        },
        {
          q: 'How does Omaha differ?',
          a: 'In Omaha, players receive 4 hole cards (Omaha 4) or 5 (Omaha 5). You must use exactly 2 hole cards and exactly 3 community cards to form your hand.',
        },
        {
          q: 'What is the small blind / big blind?',
          a: 'The small blind and big blind are forced bets posted by the two players to the left of the dealer button before each hand. They ensure there is always money in the pot.',
        },
      ],
    },
    {
      id: 'hand-rankings',
      icon: '🏆',
      title: 'Hand Rankings',
      items: [
        { q: 'Royal Flush', a: 'A, K, Q, J, 10 of the same suit. The strongest hand.' },
        { q: 'Straight Flush', a: '5 consecutive cards of the same suit.' },
        { q: 'Four of a Kind', a: '4 cards of the same rank.' },
        { q: 'Full House', a: '3 of a kind + a pair.' },
        {
          q: 'Flush',
          a: '5 cards of the same suit (not consecutive).',
        },
        { q: 'Straight', a: '5 consecutive cards (mixed suits).' },
        { q: 'Three of a Kind', a: '3 cards of the same rank.' },
        { q: 'Two Pair', a: '2 pairs.' },
        { q: 'One Pair', a: '2 cards of the same rank.' },
        { q: 'High Card', a: 'No pairs — highest card wins.' },
      ],
    },
    {
      id: 'tournaments',
      icon: '🎫',
      title: 'Tournaments',
      items: [
        {
          q: 'How do MTT tournaments work?',
          a: 'Multi-Table Tournaments start at a scheduled time. Blinds increase every level, and players are eliminated when they run out of chips. The last player standing wins.',
        },
        {
          q: 'What is an SNG?',
          a: 'Sit & Go tournaments start as soon as enough players register. They typically have a fixed number of players and start immediately when full.',
        },
        {
          q: 'What happens if I finish in the money?',
          a: 'Your prize is automatically credited to your balance. Check the tournament payout structure for exact amounts.',
        },
      ],
    },
    {
      id: 'wallet',
      icon: '💰',
      title: 'Wallet & Payments',
      items: [
        {
          q: 'How do I deposit TON?',
          a: 'Go to Wallet → Deposit. Send TON to the displayed address with the required memo. Your balance updates after network confirmation.',
        },
        {
          q: 'How long do withdrawals take?',
          a: 'Withdrawals are processed within a few minutes. Network congestion may occasionally cause delays.',
        },
        {
          q: 'Are there fees?',
          a: 'Deposits are free (only network fee applies). Withdrawals have a small platform fee plus the TON network fee.',
        },
      ],
    },
    {
      id: 'security',
      icon: '🔒',
      title: 'Security',
      items: [
        {
          q: 'How is my account secured?',
          a: 'Your account is protected via Telegram authentication. Never share your login or seed phrase with anyone.',
        },
        {
          q: 'What is provably fair?',
          a: 'Every card shuffle uses a cryptographic seed that is committed before the hand and revealed afterward. You can verify the shuffle at any time.',
        },
      ],
    },
    {
      id: 'responsible',
      icon: '💙',
      title: 'Responsible Play',
      items: [
        {
          q: 'How do I set limits?',
          a: 'Visit Profile → Responsible Play to set deposit limits, session time limits, and self-exclusion options.',
        },
        {
          q: 'Who can I contact for help?',
          a: 'If you feel you may have a gambling problem, please contact support or a local helpline.',
        },
      ],
    },
  ];

  $: filtered = search.trim()
    ? faqs
        .map((cat) => ({
          ...cat,
          items: cat.items.filter(
            (i) =>
              i.q.toLowerCase().includes(search.toLowerCase()) ||
              i.a.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((cat) => cat.items.length > 0)
    : faqs;

  function toggle(id: string) {
    expanded = expanded === id ? null : id;
  }
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      ←
    </button>
    <h1 class="text-xl font-extrabold flex-1">❓ Help Center</h1>
  </div>

  <!-- Search -->
  <div class="relative mb-4">
    <input
      type="text"
      bind:value={search}
      placeholder="Search help…"
      class="w-full rounded-2xl pl-10 pr-3 py-3 text-sm text-white border outline-none focus:border-cyan"
      style="background: rgba(16,26,58,0.6); border-color: rgba(139,92,246,0.25);"
    />
    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
  </div>

  <!-- Categories -->
  {#if filtered.length === 0}
    <div class="card p-8 text-center">
      <p class="text-3xl mb-2">🔎</p>
      <p class="text-white/50 text-sm">No results for "{search}"</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each filtered as cat}
        <div class="card !p-0 overflow-hidden">
          <div
            class="flex items-center gap-3 px-4 py-3"
            style="border-bottom: 1px solid rgba(139,92,246,0.15);"
          >
            <span class="text-xl">{cat.icon}</span>
            <p class="text-sm font-extrabold text-white flex-1">{cat.title}</p>
            <span class="text-[10px] text-white/40 font-bold">
              {cat.items.length}
            </span>
          </div>

          <div>
            {#each cat.items as item, idx}
              <button
                on:click={() => toggle(`${cat.id}-${idx}`)}
                class="w-full text-left px-4 py-3 active:bg-white/5 transition"
                style="border-bottom: {idx < cat.items.length - 1
                  ? '1px solid rgba(139,92,246,0.08)'
                  : 'none'};"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="text-[12px] font-bold text-white/90 flex-1">
                    {item.q}
                  </p>
                  <span
                    class="text-gold text-[14px] leading-none shrink-0 mt-0.5 transition-transform"
                    style="transform: rotate({expanded === `${cat.id}-${idx}` ? '45deg' : '0deg'});"
                  >
                    +
                  </span>
                </div>

                {#if expanded === `${cat.id}-${idx}`}
                  <p class="text-[11px] text-white/60 leading-relaxed mt-2 pr-6">
                    {item.a}
                  </p>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Contact -->
  <div
    class="rounded-2xl p-4 mt-5 text-center"
    style="background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,116,144,0.05)); border: 1px solid rgba(34,211,238,0.3);"
  >
    <p class="text-3xl mb-2">💬</p>
    <p class="text-sm font-extrabold text-white mb-1">Still need help?</p>
    <p class="text-[11px] text-white/60 mb-3">Our support team is here 24/7</p>
    <button class="btn-cyan w-full text-sm">Contact Support</button>
  </div>
</div>
