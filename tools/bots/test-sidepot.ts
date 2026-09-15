import { PokerGame } from '../../packages/poker-engine/src/game.js';

async function main() {
  const game = new PokerGame(
    {
      tableId: 999,
      variant: 'holdem',
      speed: 'regular',
      smallBlind: 5,
      bigBlind: 10,
      ante: 0,
      rakePct: 0,
    },
    [
      { userId: 1, displayName: 'Ali', stack: 100 },
      { userId: 2, displayName: 'Sara', stack: 200 },
      { userId: 3, displayName: 'Reza', stack: 500 },
    ],
  );

  game.startHand([]);

  console.log('=== INITIAL ===');
  for (const s of game.state.seats) {
    console.log(`${s.displayName}: stack=$${s.stack}, bet=$${s.betThisStreet}`);
  }
  console.log(`Pot: $${game.state.pot}`);
  console.log(`Current seat: ${game.state.currentSeat} (should be Ali=0)`);
  console.log('');

  // ===== PREFLOP =====
  console.log('=== PREFLOP ===');

  // Ali ALL-IN $100
  console.log('> Ali RAISE to $100 (all-in)');
  let r = game.act(0, 'raise', 100);
  console.log('Result:', r);
  console.log(
    `Pot: $${game.state.pot}, phase: ${game.state.phase}, current: ${game.state.currentSeat}`,
  );

  // Sara RE-RAISE to $200 (all-in)
  console.log('> Sara RAISE to $200 (all-in)');
  r = game.act(1, 'raise', 200);
  console.log('Result:', r);
  console.log(
    `Pot: $${game.state.pot}, phase: ${game.state.phase}, current: ${game.state.currentSeat}`,
  );

  // Reza CALL $200 (has $490 left after SB)
  console.log('> Reza CALL $200');
  r = game.act(2, 'call', 0);
  console.log('Result:', r);
  console.log(
    `Pot: $${game.state.pot}, phase: ${game.state.phase}, current: ${game.state.currentSeat}`,
  );

  console.log('\n=== AFTER PREFLOP ===');
  for (const s of game.state.seats) {
    console.log(
      `${s.displayName}: stack=$${s.stack}, totalBet=$${s.totalBet}, allIn=${s.allIn}, folded=${s.folded}`,
    );
  }
  console.log(`Pot: $${game.state.pot}, phase: ${game.state.phase}`);
  console.log(`Community: ${game.state.community.length} cards`);
  console.log(`Current seat: ${game.state.currentSeat}`);

  // ===== CHECK IF AT SHOWDOWN =====
  if (game.state.phase === 'showdown') {
    console.log('\n✅ Auto-runout to showdown (both Ali & Sara all-in)');
  } else {
    console.log('\n⚠️ Not at showdown — Sara or Reza must act');

    // Sara has chips — should check/call
    // But since Ali is all-in, Sara can only call Reza or check
    // Actually — wait: Ali is all-in $100, Sara is all-in $200.
    // Sara has NO chips left. Only Reza has chips.
    // But Reza can't bet against himself.
    // So this SHOULD auto-runout.

    console.log('🔴 BUG: Both Ali and Sara are all-in. Should auto-runout.');
    console.log('But currentSeat:', game.state.currentSeat);
  }

  // ===== FINISH =====
  if (game.state.phase === 'showdown') {
    const result = game.finishHand();
    console.log('\n=== HAND RESULT ===');
    console.log('Winners:', result.winners);
    console.log('Payouts:', JSON.stringify(result.payouts));
    console.log('\nSide Pots:');
    for (const p of result.sidePots || []) {
      console.log(`  ${p.label}: amount=$${p.amount} net=$${p.netAmount}`);
      console.log(`    eligible: [${p.eligibleSeats.join(',')}]`);
      console.log(`    winners:  [${p.winnerSeats.join(',')}]`);
      console.log(`    payouts:  ${JSON.stringify(p.payouts)}`);
    }

    console.log('\n=== Showdown Players ===');
    for (const sp of result.showdownPlayers) {
      console.log(
        `  ${sp.displayName}: ${sp.handName} | isWinner=${sp.isWinner} | payout=$${sp.payout}`,
      );
    }

    console.log('\n=== Final Stacks ===');
    let total = 0;
    for (const s of game.state.seats) {
      console.log(`${s.displayName}: $${s.stack}`);
      total += s.stack;
    }
    console.log(`Total: $${total} (should be $800)`);
  }
}

main().catch((e) => {
  console.error('ERROR:', e);
  console.error(e.stack);
  process.exit(1);
});
