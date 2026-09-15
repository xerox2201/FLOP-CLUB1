import { PokerGame } from './game.js';
import { cardsStr, parseCard } from './cards.js';
import { evaluateHand } from './hand-evaluator.js';

console.log('🎰 Testing Poker Engine\n');

const tests: { cards: string; expected: string }[] = [
  { cards: 'As Ks Qs Js Ts', expected: 'Royal Flush' },
  { cards: '9h 8h 7h 6h 5h', expected: 'Straight Flush' },
  { cards: 'Ac Ad Ah As Kd', expected: 'Four of a Kind' },
  { cards: 'Kc Kd Kh Qs Qd', expected: 'Full House' },
  { cards: 'Ah 9h 7h 4h 2h', expected: 'Flush' },
  { cards: '9c 8d 7h 6s 5c', expected: 'Straight' },
  { cards: 'Qc Qd Qh 8s 2c', expected: 'Three of a Kind' },
  { cards: 'Jc Jd 9h 9s 2c', expected: 'Two Pair' },
  { cards: 'Ac Ad 9h 6s 3c', expected: 'One Pair' },
  { cards: 'Ac Kd 9h 6s 3c', expected: 'High Card' },
  { cards: 'Ac 2d 3h 4s 5c', expected: 'Straight' },
];

let passed = 0;
for (const test of tests) {
  const cards = test.cards.split(' ').map(parseCard);
  const result = evaluateHand(cards);
  const ok = result.name === test.expected;
  console.log(`${ok ? '✅' : '❌'} ${test.cards.padEnd(20)} → ${result.name}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${tests.length} passed\n`);

console.log('--- Game Simulation ---');

const game = new PokerGame(
  { tableId: 1, variant: 'holdem', smallBlind: 5, bigBlind: 10, rakePct: 0.03 },
  [
    { userId: 1, displayName: 'Ali', stack: 1000 },
    { userId: 2, displayName: 'Sara', stack: 1000 },
  ],
);

game.startHand([]);
console.log(`Hand started. Pot: ${game.state.pot}`);

let safety = 0;
while (game.state.phase !== 'showdown' && safety < 100) {
  safety++;
  const seatIdx = game.state.currentSeat;
  const maxBet = Math.max(...game.state.seats.map((s) => s.betThisStreet));
  const toCall = maxBet - game.state.seats[seatIdx].betThisStreet;
  const res = toCall > 0 ? game.act(seatIdx, 'call') : game.act(seatIdx, 'check');
  if (!res.ok) console.log(`Error: ${res.error}`);
}

console.log(`\nCommunity: ${cardsStr(game.state.community)}`);
for (const s of game.state.seats) {
  const hand = evaluateHand([...s.hole, ...game.state.community]);
  console.log(`  ${s.displayName}: ${cardsStr(s.hole)} → ${hand.name}`);
}

const result = game.finishHand();
console.log(`\n🏆 Winners: seats ${result.winners.join(', ')}`);
console.log(`   Rake: $${result.rake}`);
console.log('\n✅ All done!');
