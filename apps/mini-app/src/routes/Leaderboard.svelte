<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'

  type Entry = {
    rank: number
    userId: string
    name: string
    avatar: string
    frame?: string
    points: number
  }

  let entries: Entry[] = []
  let loading = true

  onMount(async () => {
    try {
      const res = await api.get('/api/leaderboard/season')
      entries = res?.entries ?? res ?? []
    } catch (e) {
      console.error('[Leaderboard] load failed', e)
      entries = []
    } finally {
      loading = false
    }
  })

  const first  = $derived(entries[0] ?? null)
  const second = $derived(entries[1] ?? null)
  const third  = $derived(entries[2] ?? null)
  const rest   = $derived(entries.slice(3))

  function medalFor(rank: 1 | 2 | 3) {
    if (rank === 1) return 'medal-gold'
    if (rank === 2) return 'medal-silver'
    return 'medal-bronze'
  }
</script>

<div class="lb-page">
  <header class="page-header">
    <h1>لیدربورد فصل</h1>
  </header>

  {#if loading}
    <div class="state">در حال بارگذاری…</div>
  {:else if entries.length === 0}
    <div class="state">هنوز امتیازی ثبت نشده</div>
  {:else}
    <div class="podium">
      <!-- نفر دوم -->
      <div class="slot slot-2">
        {#if second}
          <span class="medal {medalFor(2)}" aria-hidden="true"></span>
          <img class="avatar" src={second.avatar} alt={second.name} />
          <span class="name">{second.name}</span>
          <span class="points">{second.points.toLocaleString()}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>

      <!-- نفر اول -->
      <div class="slot slot-1">
        {#if first}
          <img class="crown" src="/crown.png" alt="" aria-hidden="true" />
          <span class="medal {medalFor(1)}" aria-hidden="true"></span>
          <img class="avatar avatar-lg" src={first.avatar} alt={first.name} />
          <span class="name">{first.name}</span>
          <span class="points">{first.points.toLocaleString()}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>

      <!-- نفر سوم -->
      <div class="slot slot-3">
        {#if third}
          <span class="medal {medalFor(3)}" aria-hidden="true"></span>
          <img class="avatar" src={third.avatar} alt={third.name} />
          <span class="name">{third.name}</span>
          <span class="points">{third.points.toLocaleString()}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>
    </div>

    {#if rest.length > 0}
      <ul class="rest-list">
        {#each rest as e (e.userId)}
          <li class="rest-item">
            <span class="rank">{e.rank}</span>
            <img class="avatar-sm" src={e.avatar} alt={e.name} />
            <span class="name">{e.name}</span>
            <span class="points">{e.points.toLocaleString()}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .lb-page {
    padding: 1rem 1rem 5rem;
    min-height: 100%;
    background: url('/bg-pattern.png') center/cover no-repeat, var(--color-bg, #0e0e10);
  }
  .page-header { margin-bottom: 1.5rem; }
  .page-header h1 {
    font-family: 'Sora', sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
  }
  .state { text-align: center; padding: 3rem 1rem; opacity: 0.6; }

  .podium {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    align-items: end;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 0.5rem 1rem;
    border-radius: 16px 16px 0 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01));
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom: none;
    position: relative;
    min-height: 120px;
    justify-content: flex-end;
  }
  .slot-1 { min-height: 170px; }
  .slot-2 { min-height: 145px; }
  .slot-3 { min-height: 120px; }

  .empty-slot {
    opacity: 0.25;
    font-size: 1.5rem;
    align-self: center;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(212,175,55,0.5);
    object-fit: cover;
  }
  .avatar-lg {
    width: 60px;
    height: 60px;
    border-color: #d4af37;
    box-shadow: 0 0 16px rgba(212,175,55,0.35);
  }
  .name {
    font-size: 0.78rem;
    font-weight: 600;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .points {
    font-size: 0.72rem;
    color: #d4af37;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .crown {
    position: absolute;
    top: -22px;
    width: 32px;
    height: 32px;
    filter: drop-shadow(0 2px 6px rgba(212,175,55,0.6));
  }

  /* medals sprite — فرض: medals.png افقی 3x1 */
  .medal {
    width: 28px;
    height: 28px;
    background-image: url('/medals.png');
    background-size: 300% 100%;
    background-repeat: no-repeat;
    flex-shrink: 0;
  }
  .medal-gold   { background-position:   0% 0; }
  .medal-silver { background-position:  50% 0; }
  .medal-bronze { background-position: 100% 0; }

  .rest-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .rest-item {
    display: grid;
    grid-template-columns: 32px 40px 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .rank {
    font-weight: 700;
    font-size: 0.9rem;
    text-align: center;
    opacity: 0.75;
  }
  .avatar-sm {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  .rest-item .name {
    font-size: 0.9rem;
    font-weight: 500;
  }
  .rest-item .points {
    font-size: 0.85rem;
    color: #d4af37;
    font-weight: 700;
  }
</style>