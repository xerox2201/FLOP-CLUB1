<script lang="ts">
  import Avatar from './Avatar.svelte';

  export let open: boolean = false;
  export let myUserId: number | null = null;
  export let onClose: () => void = () => {};

  interface ChatMessage {
    id: string;
    userId: number;
    displayName: string;
    avatarId: string;
    text: string;
    isEmoji: boolean;
    timestamp: number;
  }

  let messages: ChatMessage[] = [];
  let inputText = '';
  let messagesEl: HTMLDivElement | null = null;

  const QUICK_EMOJIS = ['👋', '😎', '🔥', '👍', '😂', '😱', '👏', '🤑', '🤝', '🍀'];

  const BOT_REPLIES = [
    'Nice hand!',
    'gg',
    'wow',
    'fold already 😅',
    'all in?',
    'you got lucky',
    '😎',
    '🔥',
    'one more',
    'raise!',
  ];

  function sendMessage(text: string, isEmoji = false) {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random()}`,
      userId: myUserId || 0,
      displayName: 'You',
      avatarId: 'spade',
      text: text.trim(),
      isEmoji,
      timestamp: Date.now(),
    };
    messages = [...messages, msg];
    inputText = '';
    scrollToBottom();

    // Simulate a bot reply after 1-2 sec
    setTimeout(
      () => {
        const replyText = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        messages = [
          ...messages,
          {
            id: `${Date.now()}_${Math.random()}`,
            userId: 999,
            displayName: 'Bot',
            avatarId: 'diamond',
            text: replyText,
            isEmoji: replyText.length <= 2,
            timestamp: Date.now(),
          },
        ];
        scrollToBottom();
      },
      1000 + Math.random() * 1500,
    );
  }

  function sendEmoji(emoji: string) {
    sendMessage(emoji, true);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 50);
  }

  $: if (open) {
    setTimeout(scrollToBottom, 100);
  }
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed bottom-0 left-0 right-0 z-[100] max-w-[480px] mx-auto rounded-t-3xl flex flex-col"
    style="height: 75vh; background: linear-gradient(180deg, #101a3a, #080d24); border-top: 1px solid rgba(139,92,246,0.35); box-shadow: 0 -8px 40px rgba(0,0,0,0.8);"
  >
    <!-- Handle -->
    <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mt-2 mb-1"></div>

    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 shrink-0"
      style="border-bottom: 1px solid rgba(139,92,246,0.2);"
    >
      <h2 class="text-base font-extrabold text-white flex-1">💬 Table Chat</h2>
      <span
        class="text-[9px] font-bold text-amber-300 px-2 py-0.5 rounded-full"
        style="background: rgba(245,158,11,0.2);"
      >
        LOCAL ONLY
      </span>
      <button
        on:click={onClose}
        aria-label="Close"
        class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 text-xl leading-none"
        style="background: rgba(139,92,246,0.15);"
      >
        ×
      </button>
    </div>

    <!-- Messages -->
    <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {#if messages.length === 0}
        <div class="flex items-center justify-center h-full">
          <p class="text-white/40 text-xs text-center">
            No messages yet.<br />
            Say hi to your opponents!
          </p>
        </div>
      {:else}
        {#each messages as m}
          <div class="flex items-start gap-2 {m.userId === myUserId ? 'flex-row-reverse' : ''}">
            <div class="w-7 h-7 rounded-full overflow-hidden shrink-0">
              <Avatar avatarId={m.avatarId} size="sm" />
            </div>
            <div class="max-w-[75%] {m.userId === myUserId ? 'text-right' : ''}">
              <p
                class="text-[9px] text-white/40 mb-0.5 {m.userId === myUserId ? 'text-right' : ''}"
              >
                {m.displayName}
              </p>
              <div
                class="rounded-2xl px-3 py-1.5 inline-block {m.isEmoji
                  ? 'text-3xl !p-2'
                  : 'text-sm'}"
                style="background: {m.userId === myUserId
                  ? 'linear-gradient(135deg, #6d28d9, #4c1d95)'
                  : 'rgba(16,26,58,0.9)'}; color: white; border: 1px solid {m.userId === myUserId
                  ? 'rgba(139,92,246,0.5)'
                  : 'rgba(139,92,246,0.2)'};"
              >
                {m.text}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Quick emoji -->
    <div
      class="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0"
      style="border-top: 1px solid rgba(139,92,246,0.15);"
    >
      {#each QUICK_EMOJIS as emoji}
        <button
          on:click={() => sendEmoji(emoji)}
          class="text-2xl shrink-0 w-10 h-10 rounded-xl active:scale-90 transition flex items-center justify-center"
          style="background: rgba(139,92,246,0.12);"
        >
          {emoji}
        </button>
      {/each}
    </div>

    <!-- Input -->
    <div
      class="px-3 py-2 flex gap-2 shrink-0"
      style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom)); border-top: 1px solid rgba(139,92,246,0.2);"
    >
      <input
        type="text"
        bind:value={inputText}
        on:keydown={handleKey}
        placeholder="Type a message…"
        class="flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-cyan"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
      />
      <button
        on:click={() => sendMessage(inputText)}
        disabled={!inputText.trim()}
        class="w-11 h-11 rounded-xl flex items-center justify-center text-near-black active:scale-95 disabled:opacity-40 badge-gold"
      >
        ➤
      </button>
    </div>
  </div>
{/if}
