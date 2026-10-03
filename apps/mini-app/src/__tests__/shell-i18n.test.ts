import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { loadLanguage } from '../i18n';
import BottomNav from '../components/BottomNav.svelte';
import InfoSheet from '../components/InfoSheet.svelte';
import QuickActions from '../components/QuickActions.svelte';
import SideNav from '../components/SideNav.svelte';
import Login from '../routes/Login.svelte';
import Settings from '../routes/Settings.svelte';
import Splash from '../routes/Splash.svelte';

/**
 * Wave D gate: the shell must render Persian in `fa`, with no English UI strings
 * left behind. Assertions use the visible text of the rendered DOM, which is the
 * same surface a screenshot would show.
 *
 * Latin text that is *not* a leak (brand name, language endonyms, `RTL` tag,
 * poker loanwords) is asserted explicitly instead of being blanket-forbidden.
 */
beforeEach(async () => {
  localStorage.clear();
  await loadLanguage('fa');
});

describe('shell strings in fa', () => {
  it('renders the bottom nav in Persian', () => {
    render(BottomNav, { current: 'home', onNavigate: () => {} });

    for (const label of ['خانه', 'میزها', 'تورنمنت‌ها', 'کیف', 'من']) {
      expect(screen.getByText(label), label).toBeInTheDocument();
    }
    // `nav.tournaments` used to fall back to the English `Tourneys`.
    expect(screen.queryByText('Tourneys')).toBeNull();
  });

  it('renders the side nav in Persian and keeps the brand name', () => {
    render(SideNav, { current: 'home', onNavigate: () => {} });

    expect(screen.getByText('خانه')).toBeInTheDocument();
    expect(screen.getByText('بازی‌های نقدی')).toBeInTheDocument();
    expect(screen.getByText('سیت اند گو')).toBeInTheDocument();
    expect(screen.getByText('رتبه‌بندی‌ها')).toBeInTheDocument();
    expect(screen.getByText('فروشگاه')).toBeInTheDocument();
    expect(screen.getByText('پروفایل')).toBeInTheDocument();
    // Fallback display name comes from the catalog, not a literal.
    expect(screen.getByText('بازیکن')).toBeInTheDocument();
    // The brand wordmark stays Latin on purpose.
    expect(screen.getByText('FLOP CLUB')).toBeInTheDocument();

    for (const leak of ['Cash Games', 'Sit & Go', 'Leaderboards', 'Player']) {
      expect(screen.queryByText(leak), leak).toBeNull();
    }
  });

  it('renders the quick actions in Persian', () => {
    render(QuickActions);

    expect(screen.getByText('شارژ')).toBeInTheDocument();
    expect(screen.getByText('افزودن موجودی')).toBeInTheDocument();
    expect(screen.getByText('چیپ و بسته‌ها')).toBeInTheDocument();
    expect(screen.getByText('بهترین بازیکنان')).toBeInTheDocument();

    for (const leak of ['Deposit', 'Add funds', 'Chips & packs', 'Top players']) {
      expect(screen.queryByText(leak), leak).toBeNull();
    }
  });

  it('renders the info sheet chrome in Persian', () => {
    render(InfoSheet, { open: true, title: 'عنوان', icon: 'seed', onClose: () => {} });

    expect(screen.getByText('فهمیدم')).toBeInTheDocument();
    expect(screen.getAllByLabelText('بستن').length).toBeGreaterThan(0);
    expect(screen.queryByText('Got it')).toBeNull();
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('renders the login screen in Persian', () => {
    const { container } = render(Login);

    expect(screen.getByText('ورود با تلگرام')).toBeInTheDocument();
    expect(screen.getByText('همه یا هیچ')).toBeInTheDocument();
    expect(screen.getByText('قوانین استفاده')).toBeInTheDocument();
    expect(screen.getByText('سیاست بازی منصفانه')).toBeInTheDocument();
    expect(screen.getByText('بازی · رقابت · برد')).toBeInTheDocument();

    // The hero is one <h2> split by a <br>, so match on its text content.
    const hero = container.querySelector('h2');
    expect(hero?.textContent).toContain('یک میز.');
    expect(hero?.textContent).toContain('یک تصمیم.');

    expect(container.textContent).not.toMatch(
      /Enter with Telegram|Make Or Break|One Table|One Decision|Terms of Service|Fair Play Policy/,
    );
    // The brand wordmark stays Latin on purpose.
    expect(container.textContent).toContain('FLOP CLUB');
  });

  it('renders the splash tagline in Persian', () => {
    render(Splash);

    expect(screen.getByText('بازی · رقابت · برد')).toBeInTheDocument();
    expect(screen.getByText('در حال بارگذاری…')).toBeInTheDocument();
    // The brand wordmark is intentionally not translated.
    expect(screen.getByText('FLOP CLUB')).toBeInTheDocument();
    expect(screen.queryByText('Play · Compete · Win')).toBeNull();
  });

  it('renders the settings page in Persian without English section labels', () => {
    render(Settings, { onBack: () => {} });

    // Summary tiles and section headings share the same keys, so a label can
    // legitimately appear twice on the page.
    expect(screen.getByText('تنظیمات')).toBeInTheDocument();
    expect(screen.getByText('جلوه‌های صوتی')).toBeInTheDocument();
    expect(screen.getByText('کیفیت گرافیک')).toBeInTheDocument();
    expect(screen.getByText('ترجیحات میز')).toBeInTheDocument();
    expect(screen.getByText('خروج')).toBeInTheDocument();
    for (const shared of ['زبان', 'طرح کارت‌ها', 'صدا', 'گرافیک']) {
      expect(screen.getAllByText(shared).length, shared).toBeGreaterThan(0);
    }

    for (const leak of [
      'Card Theme',
      'Sound Effects',
      'Graphics Quality',
      'Table Preferences',
      'Sign out of account',
    ]) {
      expect(screen.queryByText(leak), leak).toBeNull();
    }
  });

  it('shows every language as its endonym over the English name', () => {
    render(Settings, { onBack: () => {} });

    // Endonyms, shown in every locale. The active one (fa) also appears in the
    // Language summary tile, and `en`'s endonym equals its English name.
    for (const native of ['English', 'فارسی', 'العربية', 'Türkçe', 'Русский', '中文']) {
      expect(screen.getAllByText(native).length, native).toBeGreaterThan(0);
    }
    // English display names sit underneath as the secondary line.
    for (const label of ['Persian', 'Arabic', 'Turkish', 'Russian', 'Chinese']) {
      expect(screen.getAllByText(label).length, label).toBeGreaterThan(0);
    }
  });
});
