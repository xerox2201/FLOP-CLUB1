<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  let search = '';
  let expanded: string | null = null;

  const faqs = [
    {
      id: 'rules',
      icon: 'seed',
      color: '#22d3ee',
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
      icon: 'trophy',
      color: '#f4c95d',
      title: 'Hand Rankings',
      items: [
        { q: 'Royal Flush', a: 'A, K, Q, J, 10 of the same suit. The strongest hand.' },
        { q: 'Straight Flush', a: '5 consecutive cards of the same suit.' },
        { q: 'Four of a Kind', a: '4 cards of the same rank.' },
        { q: 'Full House', a: '3 of a kind + a pair.' },
        { q: 'Flush', a: '5 cards of the same suit (not consecutive).' },
        { q: 'Straight', a: '5 consecutive cards (mixed suits).' },
        { q: 'Three of a Kind', a: '3 cards of the same rank.' },
        { q: 'Two Pair', a: '2 pairs.' },
        { q: 'One Pair', a: '2 cards of the same rank.' },
        { q: 'High Card', a: 'No pairs — highest card wins.' },
      ],
    },
    {
      id: 'tournaments',
      icon: 'ticket',
      color: '#3b82f6',
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
      icon: 'coin',
      color: '#10b981',
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
      icon: 'shield',
      color: '#60a5fa',
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
      icon: 'heart',
      color: '#ef4444',
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

  let totalQuestions = 0;
  for (const c of faqs) {
    totalQuestions += c.items.length;
  }
  const totalTopics = faqs.length;

  function toggle(id: string) {
    expanded = expanded === id ? null : id;
  }
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="px-4 mt-3 mb-4">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        aria-label="Back"
        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition"
        style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
      >
        <Icon name="arrow-left" size={18} color="#93c5fd" />
      </button>

      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(34,211,238,0.35), rgba(14,116,144,0.12));
          border: 1.5px solid rgba(34,211,238,0.5);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(34,211,238,0.18);
        "
      >
        <Icon name="help" size={24} color="#22d3ee" />
      </div>

      <div class="flex-1 min-w-0">
        <h1
          class="text-[26px] font-extrabold leading-none tracking-tight"
          style="
            background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 2px 8px rgba(244,201,93,0.35));
          "
        >
          Help Center
        </h1>
        <p class="text-tiny text-white/45 mt-1 font-bold">Answers, rules and 24/7 support</p>
      </div>
    </div>
  </div>

  <!-- ============ SUMMARY ============ -->
  <div class="grid grid-cols-3 gap-2 px-4 mb-4">
    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(212,175,55,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(212,175,55,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(212,175,55,0.18); border: 1px solid rgba(212,175,55,0.4);"
        >
          <Icon name="menu" size={12} color="#f4c95d" />
        </div>
        <span class="text-[8px] font-extrabold text-gold uppercase tracking-wider"> Topics </span>
      </div>
      <p class="text-[16px] font-extrabold text-white tabular-nums leading-none">{totalTopics}</p>
    </div>

    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(37,99,235,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(37,99,235,0.2); border: 1px solid rgba(37,99,235,0.4);"
        >
          <Icon name="chat" size={12} color="#93c5fd" />
        </div>
        <span class="text-[8px] font-extrabold text-blue-300 uppercase tracking-wider">
          Answers
        </span>
      </div>
      <p class="text-[16px] font-extrabold text-white tabular-nums leading-none">
        {totalQuestions}
      </p>
    </div>

    <div
      class="rounded-2xl p-2.5 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-1.5">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="clock" size={12} color="#6ee7b7" />
        </div>
        <span class="text-[8px] font-extrabold text-emerald-300 uppercase tracking-wider">
          Support
        </span>
      </div>
      <p class="text-[16px] font-extrabold text-emerald-400 leading-none">24/7</p>
    </div>
  </div>

  <!-- ============ SEARCH ============ -->
  <div class="relative mb-4 px-4">
    <input
      type="text"
      bind:value={search}
      placeholder="Search help…"
      class="w-full rounded-2xl ps-10 pe-10 py-3 text-sm text-white outline-none focus:border-gold"
      style="
        background:
          radial-gradient(ellipse at 0% 50%, rgba(212,175,55,0.08) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(212,175,55,0.25);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    />
    <span class="absolute start-7 top-1/2 -translate-y-1/2 text-white/40 flex items-center">
      <Icon name="search" size={14} />
    </span>
    {#if search.trim()}
      <button
        type="button"
        on:click={() => (search = '')}
        aria-label="Clear search"
        class="absolute end-7 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center active:scale-95 transition"
        style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);"
      >
        <Icon name="close" size={11} color="rgba(255,255,255,0.6)" />
      </button>
    {/if}
  </div>

  <!-- ============ FAQ CONTENT ============ -->
  {#if filtered.length === 0}
    <div class="px-4">
      <div
        class="rounded-2xl p-6 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style="
            background: linear-gradient(180deg, rgba(244,201,93,0.2), rgba(168,121,34,0.08));
            border: 1px solid rgba(244,201,93,0.35);
          "
        >
          <Icon name="search" size={22} color="#f4c95d" />
        </div>
        <p class="text-sm font-extrabold text-white">No results found</p>
        <p class="text-tiny text-white/55 mt-1 font-bold">
          Nothing matches "{search}" — try another keyword
        </p>
      </div>
    </div>
  {:else}
    <div class="space-y-3 px-4">
      {#each filtered as cat}
        <div
          class="rounded-2xl overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 0% 0%, {cat.color}12 0%, transparent 60%),
              linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1px solid {cat.color}40;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          "
        >
          <div
            class="flex items-center gap-3 px-3.5 py-3"
            style="border-bottom: 1px solid {cat.color}22;"
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style="
                background: radial-gradient(circle at 30% 30%, {cat.color}30, {cat.color}10);
                border: 1px solid {cat.color}55;
              "
            >
              <Icon name={cat.icon} size={17} color={cat.color} />
            </div>
            <p class="text-[13px] font-extrabold text-white flex-1 min-w-0 truncate">
              {cat.title}
            </p>
            <span
              class="text-micro font-extrabold px-2 py-0.5 rounded-full tabular-nums shrink-0"
              style="background: {cat.color}1f; border: 1px solid {cat.color}45; color: {cat.color};"
            >
              {cat.items.length}
            </span>
          </div>

          <div>
            {#each cat.items as item, idx}
              {@const key = `${cat.id}-${idx}`}
              <button
                on:click={() => toggle(key)}
                class="w-full text-start px-4 py-3 active:bg-white/5 transition"
                style="border-bottom: {idx < cat.items.length - 1
                  ? '1px solid rgba(212,175,55,0.06)'
                  : 'none'};"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="text-[12px] font-bold text-white/90 flex-1">{item.q}</p>
                  <span
                    class="shrink-0 mt-0.5 flex items-center justify-center transition-transform"
                    style="transform: rotate({expanded === key ? '180deg' : '0deg'});"
                  >
                    <Icon
                      name="chevron-down"
                      size={12}
                      color={expanded === key ? '#f4c95d' : 'rgba(255,255,255,0.45)'}
                    />
                  </span>
                </div>

                {#if expanded === key}
                  <p class="text-tiny text-white/60 leading-relaxed mt-2 pe-6">{item.a}</p>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ============ CONTACT ============ -->
  <div class="px-4 mt-5">
    <div
      class="rounded-2xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.2) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(34,211,238,0.35);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      "
    >
      <div class="flex items-center gap-3">
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(34,211,238,0.3), rgba(14,116,144,0.1));
            border: 1px solid rgba(34,211,238,0.5);
          "
        >
          <Icon name="chat" size={20} color="#22d3ee" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-extrabold text-white leading-tight">Still need help?</p>
          <p class="text-mini text-white/55 font-bold mt-0.5 leading-tight">
            Our support team is here 24/7
          </p>
        </div>
      </div>
      <button class="btn btn-blue w-full text-sm mt-3">Contact Support</button>
    </div>
  </div>
</div>
