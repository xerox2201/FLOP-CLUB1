import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PlayingCard from '../PlayingCard.svelte';

describe('PlayingCard', () => {
  it('renders rank and suit', () => {
    render(PlayingCard, { rank: 'A', suit: '♠' });
    // The face is an image; the rank/suit live in its alt text.
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'A♠');
  });

  it('renders different sizes', () => {
    const { container } = render(PlayingCard, { rank: 'A', suit: '♠', size: 'lg' });
    const card = container.firstChild as HTMLElement;
    expect(card).toBeTruthy();
  });
});
