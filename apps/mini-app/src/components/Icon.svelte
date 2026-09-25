<script lang="ts">
  export let name: string;
  export let size: number = 20;
  export let color: string = 'currentColor';

  // ─── PNG (فایل‌های خودت) ────────────────────────────
  const PNG_MAP: Record<string, string> = {
    home: '/icon-home.png',
    tables: '/icon-tables.png',
    tournaments: '/icon-tournaments.png',
    sitgo: '/icon-sitgo.png',
    shop: '/icon-shop.png',
    wallet: '/icon-wallet.png',
    trophy_png: '/trophy.png',
    crown_png: '/crown.png',
    medal_gold: '/medal-gold.png',
    medal_silver: '/medal-silver.png',
    medal_bronze: '/medal-bronze.png',
    logo: '/logo-flop-club.png',
    ton: '/ton-logo.png',
  };

  // ─── Ionicons (فایل‌های دانلودشده) ────────────────
  const SVG_MAP: Record<string, string> = {
    // Nav
    user: 'person',
    users: 'people',
    settings: 'settings',
    menu: 'menu',
    // Actions
    close: 'close',
    check: 'checkmark',
    plus: 'add',
    minus: 'remove',
    search: 'search',
    refresh: 'refresh',
    'arrow-left': 'arrow-back',
    'arrow-right': 'arrow-forward',
    'chevron-down': 'chevron-down',
    'chevron-up': 'chevron-up',
    'trending-up': 'trending-up',
    'trending-down': 'trending-down',
    // Status
    lock: 'lock-closed',
    unlock: 'lock-open',
    shield: 'shield-checkmark',
    shield_alert: 'shield-checkmark',
    info: 'information-circle',
    warning: 'warning',
    alert: 'alert-circle',
    success: 'checkmark-circle',
    error: 'close-circle',
    clock: 'time',
    fire: 'flame',
    // Money
    zap: 'flash',
    gift: 'gift',
    gem: 'diamond',
    dollar: 'cash',
    bank: 'card',
    receipt: 'receipt',
    coin: 'coin',
    // Tournament
    trophy: 'trophy',
    crown: 'trophy',
    medal: 'medal',
    target: 'locate',
    calendar: 'calendar',
    play: 'play',
    pause: 'pause',
    // Misc
    bell: 'notifications',
    star: 'star',
    cart: 'cart',
    logout: 'log-out',
    trash: 'trash',
    edit: 'pencil',
    copy: 'copy',
    chat: 'chatbubble',
    send: 'send',
    chart: 'bar-chart',
    broadcast: 'megaphone',
    // خاص
    ticket: 'ticket',
    seed: 'leaf',
    help: 'help-circle',
    sparkles: 'sparkles',
    heart: 'heart',
  };

  $: pngSrc = PNG_MAP[name];
  $: svgFile = SVG_MAP[name];
</script>

{#if pngSrc}
  <img
    src={pngSrc}
    alt={name}
    width={size}
    height={size}
    style="display: inline-block; vertical-align: middle; flex-shrink: 0; object-fit: contain;"
    draggable="false"
  />
{:else if svgFile}
  <img
    src="/icons/{svgFile}.svg"
    alt={name}
    width={size}
    height={size}
    style="display: inline-block; vertical-align: middle; flex-shrink: 0; object-fit: contain;"
    draggable="false"
  />
{:else}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2">
    <circle cx="12" cy="12" r="10" />
  </svg>
{/if}
