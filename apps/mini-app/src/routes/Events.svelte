<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'

  type EventItem = {
    id: string
    title: string
    description: string
    startsAt: string
    prize: number
    image?: string
  }

  let events: EventItem[] = []
  let loading = true
  let selected: EventItem | null = null

  onMount(async () => {
    try {
      events = await api.get('/api/events')
    } catch (e) {
      console.error('[Events] load failed', e)
      events = []
    } finally {
      loading = false
    }
  })

  function openDetail(ev: EventItem) {
    selected = ev
  }

  function closeDetail() {
    selected = null
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }
</script>

<div class="events-page">
  <header class="page-header">
    <h1>رویدادها</h1>
  </header>

  {#if loading}
    <div class="state">در حال بارگذاری…</div>
  {:else if events.length === 0}
    <div class="state">رویدادی وجود ندارد</div>
  {:else}
    <ul class="event-list">
      {#each events as ev (ev.id)}
        <li class="event-card" onclick={() => openDetail(ev)} role="button" tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && openDetail(ev)}>
          {#if ev.image}
            <img class="thumb" src={ev.image} alt={ev.title} />
          {/if}
          <div class="body">
            <span class="title">{ev.title}</span>
            <span class="date">{formatDate(ev.startsAt)}</span>
          </div>
          <div class="prize">{ev.prize.toLocaleString()} TON</div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if selected}
  <div class="modal-backdrop" onclick={closeDetail} role="presentation">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h2>{selected.title}</h2>
      <p class="modal-date">{formatDate(selected.startsAt)}</p>
      <p class="modal-desc">{selected.description}</p>
      <p class="modal-prize">جایزه: {selected.prize.toLocaleString()} TON</p>
      <button class="close-btn" onclick={closeDetail}>بستن</button>
    </div>
  </div>
{/if}

<style>
  .events-page {
    padding: 1rem;
    min-height: 100%;
    background: url('/bg-pattern.png') center/cover no-repeat, var(--color-bg, #0e0e10);
  }
  .page-header { margin-bottom: 1rem; }
  .page-header h1 {
    font-family: 'Sora', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
  }
  .state { text-align: center; padding: 3rem 1rem; opacity: 0.6; }
  .event-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .event-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .event-card:hover {
    transform: translateY(-2px);
    border-color: rgba(212,175,55,0.4);
  }
  .thumb {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .title { font-weight: 600; font-size: 0.95rem; }
  .date { font-size: 0.78rem; opacity: 0.65; }
  .prize {
    font-weight: 700;
    font-size: 0.9rem;
    color: #d4af37;
    white-space: nowrap;
  }
  .modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    display: grid; place-items: center;
    z-index: 100;
    padding: 1rem;
  }
  .modal {
    background: #1a1a1f;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 1.5rem;
    max-width: 420px;
    width: 100%;
  }
  .modal h2 { font-size: 1.15rem; margin-bottom: 0.5rem; }
  .modal-date { font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.75rem; }
  .modal-desc { font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem; opacity: 0.85; }
  .modal-prize { color: #d4af37; font-weight: 700; margin-bottom: 1.25rem; }
  .close-btn {
    width: 100%;
    padding: 0.75rem;
    border-radius: 12px;
    background: linear-gradient(135deg, #d4af37, #b8860b);
    color: #1a1a1a;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
</style>