<script lang="ts">
  import Icon from './Icon.svelte';
  import { api } from '../lib/api';

  export let open = false;
  export let tournamentId: number = 1;
  export let onClose: () => void = () => {};

  let data: any = null;
  let loading = false;
  let error = '';

  type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

  interface FieldDoc {
    key: string;
    label: string;
    desc: string;
    type: FieldType;
  }

  interface Group {
    title: string;
    icon: string;
    fields: FieldDoc[];
  }

  const GROUPS: Group[] = [
    {
      title: 'Base Info — اطلاعات پایه',
      icon: '',
      fields: [
        {
          key: 'id',
          label: 'شناسه',
          desc: 'Unique tournament ID in the database. استفاده میشه برای لینک دادن به تورنمنت.',
          type: 'string',
        },
        {
          key: 'name',
          label: 'نام',
          desc: 'Display name shown to players. اسمی که بازیکن‌ها می‌بینن.',
          type: 'string',
        },
        {
          key: 'variant',
          label: 'نوع بازی',
          desc: 'Game type: holdem / omaha4 / omaha5. نوع پوکر بازی‌شده.',
          type: 'string',
        },
        {
          key: 'mode',
          label: 'حالت',
          desc: 'free (chips play money) یا real (real USD). حالت چیپ یا پول واقعی.',
          type: 'string',
        },
        {
          key: 'format',
          label: 'فرمت',
          desc: 'sng / mtt / freeroll / satellite. فرمت برگزاری تورنمنت.',
          type: 'string',
        },
        {
          key: 'speed',
          label: 'سرعت',
          desc: 'regular / fast / turbo / hyper. سرعت تغییر بلایندها.',
          type: 'string',
        },
        {
          key: 'isPrivate',
          label: 'خصوصی',
          desc: 'If true, tournament is not listed publicly. اگه true باشه فقط با لینک مستقیم دیده میشه.',
          type: 'boolean',
        },
      ],
    },
    {
      title: 'Money & Prize Pool — جوایز و اقتصاد',
      icon: '',
      fields: [
        {
          key: 'buyIn',
          label: 'ورودی',
          desc: 'Entry cost per player in USD. مبلغی که هر بازیکن باید بده تا شرکت کنه.',
          type: 'number',
        },
        {
          key: 'fee',
          label: 'کارمزد',
          desc: 'Platform commission per player (USD). سهم پلتفرم از هر ورودی.',
          type: 'number',
        },
        {
          key: 'guaranteed',
          label: 'تضمینی',
          desc: 'Minimum prize pool the platform guarantees. اگه تعداد بازیکن کم باشه، پلتفرم این مقدار رو میده.',
          type: 'number',
        },
        {
          key: 'totalPrizePool',
          label: 'کل جایزه',
          desc: 'LIVE prize pool = max(totalBuyIn, guaranteed). بزرگ‌ترین مقدار بین مجموع buy-in و guarantee.',
          type: 'number',
        },
        {
          key: 'totalBuyIn',
          label: 'مجموع ورودی‌ها',
          desc: 'Sum of buy-ins = registeredCount × buyIn. کل پولی که بازیکن‌ها دادن.',
          type: 'number',
        },
        {
          key: 'overlay',
          label: 'مابه‌التفاوت',
          desc: 'Platform loss = max(0, guaranteed - totalBuyIn). اگه guarantee بیشتر از buy-in‌ها باشه، پلتفرم این مقدار رو از جیب میده.',
          type: 'number',
        },
        {
          key: 'rakeCollected',
          label: 'کارمزد جمع‌شده',
          desc: 'Sum of fees = registeredCount × fee. کل کارمزد جمع‌شده از بازیکن‌ها.',
          type: 'number',
        },
        {
          key: 'totalRake',
          label: 'کل Rake نهایی',
          desc: 'Final rake from DB after tournament finishes. کارمزد نهایی بعد از پایان تورنمنت.',
          type: 'number',
        },
      ],
    },
    {
      title: 'Players — بازیکن‌ها',
      icon: '',
      fields: [
        {
          key: 'minPlayers',
          label: 'حداقل بازیکن',
          desc: 'Minimum players to start the tournament. کمتر از این تعداد نشه، شروع نمیشه.',
          type: 'number',
        },
        {
          key: 'maxPlayers',
          label: 'حداکثر بازیکن',
          desc: 'Maximum seats allowed. سقف تعداد بازیکن.',
          type: 'number',
        },
        {
          key: 'registeredCount',
          label: 'ثبت‌نام‌شده‌ها',
          desc: 'Players who registered but tournament not started. فقط ثبت‌نام کردن، هنوز بازی نکردن.',
          type: 'number',
        },
        {
          key: 'activeCount',
          label: 'فعال‌ها',
          desc: 'Players currently seated and playing. در حال حاضر روی میز نشستن و بازی می‌کنن.',
          type: 'number',
        },
        {
          key: 'totalPlayers',
          label: 'کل شرکت‌کنندگان',
          desc: 'Total participants after tournament started. بعد از start پر میشه.',
          type: 'number',
        },
      ],
    },
    {
      title: 'Blind Structure & Timer — بلایندها و تایمر',
      icon: '',
      fields: [
        {
          key: 'startingStack',
          label: 'چیپ اولیه',
          desc: 'Chips each player receives at start. تعداد چیپ اولیه هر بازیکن.',
          type: 'number',
        },
        {
          key: 'blindStructureId',
          label: 'شناسه ساختار',
          desc: 'FK to blind_structures table. اشاره به جدول ساختارهای بلایند.',
          type: 'string',
        },
        {
          key: 'blindStructure',
          label: 'ساختار بلایند',
          desc: 'Array of all levels with sb/bb/ante/duration/isBreak. آرایه‌ی کامل همه لِوِل‌ها.',
          type: 'array',
        },
        {
          key: 'currentLevel',
          label: 'لِوِل فعلی',
          desc: 'Current blind level number (0 = not started). شماره لِوِل جاری.',
          type: 'number',
        },
        {
          key: 'currentLevelData',
          label: 'اطلاعات لِوِل فعلی',
          desc: '{level, sb, bb, ante, durationSec, isBreak}. جزئیات کامل لِوِل جاری برای نمایش تایمر.',
          type: 'object',
        },
        {
          key: 'nextLevelData',
          label: 'اطلاعات لِوِل بعدی',
          desc: 'Same structure for next level. برای نمایش "Next: L4 — SB/BB/Ante".',
          type: 'object',
        },
        {
          key: 'nextLevelIn',
          label: 'باقی‌مونده تا بعدی',
          desc: 'Seconds remaining until next level. برای شمارش معکوس تایمر استفاده میشه.',
          type: 'number',
        },
        {
          key: 'levelStartedAt',
          label: 'شروع لِوِل',
          desc: 'Timestamp when current level began. لحظه‌ای که لِوِل فعلی شروع شد.',
          type: 'date',
        },
      ],
    },
    {
      title: 'Registration Rules — قوانین ثبت‌نام',
      icon: '',
      fields: [
        {
          key: 'lateRegMin',
          label: 'Late Reg (دقیقه)',
          desc: 'Late registration window in minutes. مدت زمان مجاز برای ثبت‌نام دیرهنگام.',
          type: 'number',
        },
        {
          key: 'lateRegLevel',
          label: 'لِوِل Late Reg',
          desc: 'Last level allowing late reg (0 = off). آخرین لِوِلی که میشه Late Reg کرد.',
          type: 'number',
        },
        {
          key: 'allowReEntry',
          label: 'Re-entry مجاز',
          desc: 'Can busted players re-enter? اگه بازیکن باخت، می‌تونه دوباره بخره؟',
          type: 'boolean',
        },
        {
          key: 'maxReEntries',
          label: 'حداکثر Re-entry',
          desc: 'Max re-entries per player. هر بازیکن چقدر می‌تونه Re-entry کنه.',
          type: 'number',
        },
      ],
    },
    {
      title: 'Bounty & Satellite — جایزه و ساتلایت',
      icon: '',
      fields: [
        {
          key: 'isBounty',
          label: 'حالت Bounty',
          desc: 'Bounty mode: extra reward per KO. برای هر حذف، مبلغ اضافه به killer داده میشه.',
          type: 'boolean',
        },
        {
          key: 'bountyAmount',
          label: 'مبلغ Bounty',
          desc: 'USD paid per elimination. مبلغی که از fee پرداخت میشه (نه از prize pool).',
          type: 'number',
        },
        {
          key: 'satelliteTargetId',
          label: 'تورنمنت هدف',
          desc: 'Target tournament ID for tickets. تورنمنتی که برنده‌ها تیکت ورود به اون رو می‌گیرن.',
          type: 'string',
        },
        {
          key: 'seatsAwarded',
          label: 'تعداد صندلی',
          desc: 'Number of tickets to award. چند نفر به تورنمنت هدف راه پیدا می‌کنن.',
          type: 'number',
        },
      ],
    },
    {
      title: 'Status & Timeline — وضعیت و زمان',
      icon: '',
      fields: [
        {
          key: 'status',
          label: 'وضعیت',
          desc: 'scheduled / registering / running / paused / final_table / finished / cancelled. مرحله‌ی فعلی تورنمنت.',
          type: 'string',
        },
        {
          key: 'scheduledStart',
          label: 'زمان شروع برنامه',
          desc: 'Planned UTC start time. زمان برنامه‌ریزی‌شده برای شروع.',
          type: 'date',
        },
        {
          key: 'startedAt',
          label: 'زمان شروع واقعی',
          desc: 'Actual start timestamp. لحظه‌ای که واقعاً شروع شد.',
          type: 'date',
        },
        {
          key: 'finishedAt',
          label: 'زمان پایان',
          desc: 'Completion timestamp. لحظه‌ای که تمام شد.',
          type: 'date',
        },
        {
          key: 'createdAt',
          label: 'زمان ساخت',
          desc: 'When the tournament was created. لحظه‌ای که ادمین ساختش.',
          type: 'date',
        },
      ],
    },
    {
      title: 'Dynamic Arrays — آرایه‌های داده‌ای',
      icon: '',
      fields: [
        {
          key: 'players',
          label: 'بازیکن‌ها',
          desc: 'Array of {userId, displayName, avatarId, stack, seat, tableNumber, status, finalPosition, virtualTableId, rebuyCount, hasAddon}. لیست بازیکن‌ها با stack مرتب‌شده نزولی.',
          type: 'array',
        },
        {
          key: 'payouts',
          label: 'جدول پرداخت',
          desc: 'Array of {position, percentage, fixedAmount, amount}. amount = real $ per position محاسبه‌شده از totalPrizePool.',
          type: 'array',
        },
        {
          key: 'yourEntry',
          label: 'وضعیت تو',
          desc: "Current user's registration: isRegistered, entryStatus, stack, seat, tableNumber, virtualTableId, canRegister, canReEnter, canRebuy, canAddon. فقط اگه با توکن لاگین‌کرده درخواست بدی پر میشه.",
          type: 'object',
        },
      ],
    },
  ];

  async function load() {
    loading = true;
    error = '';
    data = null;
    try {
      const res = await api.getTournament(tournamentId);
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // Reload every time the panel is opened
  $: if (open) load();

  function val(key: string): string {
    if (!data) return '—';
    if (data[key] === undefined) return '—';
    const v = data[key];
    if (v === null) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
      if (v.length === 0) return '[] (empty)';
      return `Array(${v.length}) — preview: ${JSON.stringify(v[0]).slice(0, 80)}${JSON.stringify(v[0]).length > 80 ? '…' : ''}`;
    }
    if (typeof v === 'object') {
      return `Object — preview: ${JSON.stringify(v).slice(0, 100)}${JSON.stringify(v).length > 100 ? '…' : ''}`;
    }
    return String(v);
  }

  function typeColor(type: string): string {
    return (
      (
        {
          string: '#60a5fa',
          number: '#34d399',
          boolean: '#fbbf24',
          date: '#60a5fa',
          array: '#f472b6',
          object: '#22d3ee',
        } as Record<string, string>
      )[type] || '#9ca3af'
    );
  }
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(5,8,15,0.92); backdrop-filter: blur(8px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed inset-3 z-[100] flex flex-col rounded-3xl overflow-hidden"
    style="background: linear-gradient(180deg, #0a0f1e, #05080f); border: 1.5px solid rgba(212,175,55,0.4); box-shadow: 0 20px 60px rgba(0,0,0,0.95);"
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.2);"
    >
      <span class="text-base"></span>
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-extrabold text-white truncate">API Fields Reference</h2>
        <p class="text-[10px] text-white/40 font-mono truncate">
          Tournament #{tournamentId} · GET /api/tournaments/{tournamentId}
        </p>
      </div>
      <button
        on:click={onClose}
        aria-label="Close"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 active:scale-95 shrink-0"
        style="background: rgba(255,255,255,0.06);"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg
        >
      </button>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto no-scrollbar p-3">
      {#if loading}
        <p class="text-center py-12 text-white/40 text-sm">Loading…</p>
      {:else if error}
        <p class="text-center py-12 text-red-300 text-sm font-bold">{error}</p>
      {:else if data}
        {#each GROUPS as g}
          <div class="mb-4">
            <div class="flex items-center gap-2 mb-2 px-1">
              <span class="text-base">{g.icon}</span>
              <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80">
                {g.title}
              </p>
            </div>
            <div class="space-y-1.5">
              {#each g.fields as f}
                <div
                  class="rounded-xl p-2.5"
                  style="background: rgba(15,31,58,0.55); border: 1px solid rgba(255,255,255,0.06);"
                >
                  <!-- Row 1: field name + type + label -->
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="text-[11px] font-mono font-extrabold text-white">
                      {f.key}
                    </span>
                    <span
                      class="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style="background: {typeColor(f.type)}20; color: {typeColor(
                        f.type,
                      )}; border: 1px solid {typeColor(f.type)}50;"
                    >
                      {f.type}
                    </span>
                    <span class="text-[10px] text-white/50 font-bold ml-auto truncate">
                      {f.label}
                    </span>
                  </div>

                  <!-- Row 2: current value -->
                  <div
                    class="rounded-lg px-2 py-1.5 mb-1.5"
                    style="background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.04);"
                  >
                    <p class="text-[10px] font-mono text-white/90 break-all leading-relaxed">
                      {val(f.key)}
                    </p>
                  </div>

                  <!-- Row 3: description / purpose -->
                  <p class="text-[10px] text-white/55 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <!-- Footer note -->
        <div
          class="rounded-xl p-3 mt-3"
          style="background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.35);"
        >
          <p class="text-[10px] text-blue-200 leading-relaxed">
            <strong class="text-blue-100"
              ><Icon name="alert" size={12} color="#f59e0b" /> Note:</strong
            >
            Values shown are from the <strong>live</strong> API response. Empty (<code>null</code>)
            or zero fields usually mean the tournament hasn't reached that state yet — e.g.
            <code>currentLevelData</code>
            is <code>null</code> when
            <code>status</code> is <code>scheduled</code>, and <code>yourEntry</code> is
            <code>null</code> when the request has no auth token.
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}
