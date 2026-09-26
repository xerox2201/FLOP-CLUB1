<script lang="ts">
  import { onDestroy } from 'svelte';
  import Avatar from './Avatar.svelte';
  import type { TableSocketIO, ChatMessage } from '../lib/socket';
  import Icon from './Icon.svelte';

  export let open: boolean = false;
  export let myUserId: number | null = null;
  export let myAvatarId: string = 'spade';
  export let socket: TableSocketIO | null = null;
  export let onClose: () => void = () => {};

  let messages: ChatMessage[] = [];
  let inputText = '';
  let messagesEl: HTMLDivElement | null = null;
  let sending = false;
  let errorMsg = '';
  let lastSendAt = 0;

  const QUICK_EMOJIS = ['👋', '😎', '🔥', '👍', '😂', '😱', '👏', '🤑', '🤝', '🍀'];

  const QUICK_CHAT = [
    'Nice hand!',
    'gg',
    'well played',
    'nice river',
    'ouch',
    'all in?',
    'call',
    'fold',
  ];

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 30);
  }

  async function sendMessage(text: string, isEmoji = false) {
    const trimmed = text.trim();
    if (!trimmed || sending || !socket) return;

    // client-side cooldown feedback
    const now = Date.now();
    if (now - lastSendAt < 1200) {
      errorMsg = 'Slow down…';
      setTimeout(() => (errorMsg = ''), 1500);
      return;
    }
    lastSendAt = now;

    sending = true;
    errorMsg = '';
    try {
      const res = await socket.sendChat(trimmed, isEmoji);
      if (!res.ok) {
        if (res.code === 'RATE_LIMIT') errorMsg = 'Slow down…';
        else if (res.code === 'TOO_LONG') errorMsg = 'Message too long';
        else if (res.code === 'NOT_IN_TABLE') errorMsg = 'Not seated at table';
        else errorMsg = 'Failed to send';
        setTimeout(() => (errorMsg = ''), 2000);
      } else {
        inputText = '';
      }
    } catch (e: any) {
      errorMsg = e.message;
      setTimeout(() => (errorMsg = ''), 2000);
    } finally {
      sending = false;
    }
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

  // ===== Subscribe to socket events =====
  let unsub: (() => void) | null = null;

  $: if (socket && open && !unsub) {
    unsub = socket.on((evt) => {
      if (evt.type === 'chat') {
        messages = [...messages, evt.message];
        scrollToBottom();
      }
    });

    // Load history
    socket.requestChatHistory().then((hist) => {
      if (hist.length > 0) {
        messages = hist;
        scrollToBottom();
      }
    });
  }

  $: if (!open && unsub) {
    unsub();
    unsub = null;
    // clear on close
    setTimeout(() => {
      messages = [];
    }, 200);
  }

  $: if (open) {
    setTimeout(scrollToBottom, 100);
  }

  onDestroy(() => {
    if (unsub) unsub();
  });
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(5,8,15,0.8); backdrop-filter: blur(6px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed bottom-0 left-0 right-0 z-[100] max-w-[480px] mx-auto rounded-t-3xl flex flex-col"
    style="
      height: 78vh;
      background: linear-gradient(180deg, rgba(15,31,58,0.99), rgba(7,14,27,1));
      border-top: 1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 -8px 40px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.1);
    "
  >
    <!-- Handle -->
    <div
      class="w-12 h-1 rounded-full mx-auto mt-2 mb-1"
      style="background: rgba(212,175,55,0.4);"
    ></div>

    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center"
        style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1)); border: 1px solid rgba(212,175,55,0.4);"
      >
        <Icon name="chat" size={16} color="#d4af37" />
      </div>
      <h2 class="text-base font-extrabold text-white flex-1 tracking-wide">Table Chat</h2>

      <button
        on:click={onClose}
        aria-label="Close"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 active:scale-95"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={14} color="rgba(255,255,255,0.6)" />
      </button>
    </div>

    <!-- Messages -->
    <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 no-scrollbar">
      {#if messages.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-center px-4">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
            style="background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.05)); border: 1px solid rgba(212,175,55,0.3);"
          >
            <Icon name="chat" size={26} color="#d4af37" />
          </div>
          <p class="text-white/50 text-sm font-bold">No messages yet</p>
          <p class="text-white/35 text-[11px] mt-1">Say hi to your opponents</p>
        </div>
      {:else}
        {#each messages as m (m.id)}
          {@const isMine = m.userId === myUserId}
          <div class="flex items-start gap-2.5 {isMine ? 'flex-row-reverse' : ''}">
            <div
              class="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              style="
                border: 1.5px solid rgba(212,175,55,0.4);
                background: radial-gradient(circle, #1a3a5c, #05080f);
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
              "
            >
              <Avatar avatarId={m.avatarId || myAvatarId || 'king'} size="sm" />
            </div>
            <div class="max-w-[75%] {isMine ? 'items-end' : 'items-start'} flex flex-col">
              <p
                class="text-[9px] font-bold mb-0.5 {isMine ? 'text-right' : ''}"
                style="color: {isMine ? '#f4e5a8' : 'rgba(255,255,255,0.5)'};"
              >
                {isMine ? 'You' : m.displayName}
              </p>
              <div
                class="rounded-2xl px-3 py-1.5 inline-block"
                style="
                  background: {isMine
                  ? 'linear-gradient(135deg, #d4af37, #a87a15)'
                  : 'linear-gradient(135deg, rgba(15,31,58,0.95), rgba(7,14,27,0.98))'};
                  color: {isMine ? '#0a0800' : '#ffffff'};
                  border: 1px solid {isMine ? 'rgba(255,235,170,0.4)' : 'rgba(212,175,55,0.2)'};
                  box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                  {m.isEmoji
                  ? 'font-size: 28px; line-height: 1; padding: 6px 10px;'
                  : 'font-size: 13px; font-weight: 600;'}
                "
              >
                {m.text}
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Error toast -->
    {#if errorMsg}
      <div class="px-3 pb-1">
        <div
          class="rounded-xl px-3 py-1.5 text-center text-[10px] font-bold"
          style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5;"
        >
          {errorMsg}
        </div>
      </div>
    {/if}

    <!-- Quick chat -->
    <div class="px-3 pt-2 pb-1 shrink-0">
      <div class="flex gap-1.5 overflow-x-auto no-scrollbar">
        {#each QUICK_CHAT as q}
          <button
            on:click={() => sendMessage(q)}
            disabled={sending}
            class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold active:scale-95 transition disabled:opacity-40"
            style="
              background: rgba(212,175,55,0.12);
              border: 1px solid rgba(212,175,55,0.3);
              color: #f4e5a8;
            "
          >
            {q}
          </button>
        {/each}
      </div>
    </div>

    <!-- Quick emoji -->
    <div
      class="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0"
      style="border-top: 1px solid rgba(212,175,55,0.1);"
    >
      {#each QUICK_EMOJIS as emoji}
        <button
          on:click={() => sendEmoji(emoji)}
          disabled={sending}
          class="text-2xl shrink-0 w-10 h-10 rounded-xl active:scale-90 transition flex items-center justify-center disabled:opacity-40"
          style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.2);"
        >
          {emoji}
        </button>
      {/each}
    </div>

    <!-- Input -->
    <div
      class="px-3 py-2 flex gap-2 shrink-0"
      style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom)); border-top: 1px solid rgba(212,175,55,0.15);"
    >
      <input
        type="text"
        bind:value={inputText}
        on:keydown={handleKey}
        placeholder="Type a message…"
        maxlength="200"
        class="flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.25);"
      />
      <button
        on:click={() => sendMessage(inputText)}
        disabled={!inputText.trim() || sending}
        aria-label="Send"
        class="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 disabled:opacity-40"
        style="
          background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
          box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.5);
          color: #0a0800;
        "
      >
        <Icon name="send" size={16} color="#0a0800" />
      </button>
    </div>
  </div>
{/if}
