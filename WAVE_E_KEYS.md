# Wave E extraction spec

`en.ts` is the source of truth. Every key below is new in Wave E and must be added to the
target catalog with the same nesting and the same `{placeholder}` names.

Constraints (enforced by `apps/mini-app/src/i18n/__tests__/i18n.test.ts`):

- Placeholders must be identical to English, character for character.
- Plural entries are stored with an `_one` / `_other` suffix (e.g. `shop.pack_one`,
  `shop.pack_other`) and requested as `t('shop.pack', { n })`. Both forms must keep `{n}`.
- No emoji anywhere.
- Persian (`fa`): use ZWNJ (`\u200C`) in compound words, never Arabic yeh `\u064A` or Arabic
  kaf `\u0643` (use `ی` and `ک`).
- Values that are pure machine tokens stay as-is: `XP`, `TON`, `LVL`, `MAX`, `USE`, `TBA`,
  `24h`, `7d`, `30d`, `SHA-256`, `SHA256(seed)`, `HMAC-SHA256`, `deck-v2`, `tx_hash`,
  `00:00 UTC`, `A-Z a-z 0-9 - _`, `EQ...`.
- A key already present in the target catalog keeps its existing value (do not rewrite it).

```
wallet.title Wallet
wallet.tagline Instant · Automatic · Provably fair
wallet.totalBalance Total Balance
wallet.realBalance Real Balance
wallet.connected Connected
wallet.freeChips Free Chips
wallet.tonBalance TON Balance
wallet.bonusLocked {amount} locked by bonus
wallet.deposit Deposit
wallet.withdraw Withdraw
wallet.history History
wallet.depositDisabled Deposits are currently disabled
wallet.minDeposit Min {amount} TON
wallet.depositAddress Deposit Address
wallet.copyAddress Copy address
wallet.copyMemo Copy memo
wallet.memoRequired Memo · Required
wallet.depositAutoLead Deposits are credited
wallet.depositAutoStrong automatically
wallet.depositAutoTail after network confirmation (~15 seconds).
wallet.addressCopied Address copied
wallet.memoCopied Memo copied
wallet.loadingWithdraw Loading withdraw status…
wallet.available Available
wallet.feeMin Fee · Min
wallet.unlockWithdrawals Unlock Withdrawals
wallet.unlockConditionsLead Complete all conditions once
wallet.unlockDeposit Lifetime deposit $5+
wallet.unlockRake Rake contributed $0.50+
wallet.unlockHands Play 20+ real hands
wallet.unlockAccountAge Account age 24h+
wallet.unlockDepositAge Deposit age 6h+
wallet.bonusConditions Bonus Conditions
wallet.condPlaythrough Playthrough
wallet.condRake Rake
wallet.condHands Hands
wallet.condWait Wait
wallet.condDays {n} days
wallet.withdrawalsDisabled Withdrawals temporarily disabled
wallet.toAddress To Address
wallet.use USE
wallet.max MAX
wallet.amountTon Amount (TON)
wallet.requested Requested
wallet.youReceive You receive
wallet.sending Sending…
wallet.withdrawInstantly Withdraw Instantly
wallet.locked Locked
wallet.flatFee Automated · Flat {amount} TON fee
wallet.withdrawSubmitted Withdraw submitted: {amount} TON
wallet.withdrawalsUnlocked Withdrawals verified & unlocked
wallet.invalidAmount Invalid amount
wallet.tonConnectMissing TON Connect not loaded
wallet.depositDirection Deposit
wallet.withdrawalDirection Withdrawal
wallet.noTxTitle No transactions yet
wallet.noTxBody Your deposits and withdrawals will appear here
wallet.noTx No transactions yet
wallet.chooseAsset Choose asset to deposit
wallet.depositNote Deposit will open in Telegram wallet
wallet.withdrawTo Withdraw to address
wallet.address Wallet Address
wallet.amount Amount (USD)
wallet.minWithdraw Min withdraw
wallet.fee Network fee
wallet.comingSoon Coming soon
money.title My Money
money.period30d 30 Days
money.period90d 90 Days
money.lifetime Lifetime
money.retry Retry
money.totalReturned Total Returned
money.ofRake of rake
money.rakePaid Rake Paid
money.platformKept Platform Kept
money.whereMoneyGoes Where Your Money Goes
money.tablePerformance Table Performance
money.cashTableWinnings Cash Table Winnings
money.tournamentPrizes Tournament Prizes
money.liveBooks Live Books
money.liveBooksSub See every dollar in and out — publicly
books.title Live Books
books.headline Every dollar in. Every dollar out. Live.
books.intro We publish our books publicly. You see exactly where the money goes. No tricks, no hidden rake, no fine print.
books.period24h 24h
books.period7d 7d
books.period30d 30d
books.periodAll All
books.periodSuffix ({period})
books.returnedToPlayers Returned to Players
books.ofRake of rake
books.rakeCollected Rake Collected
books.rewardsPaid Rewards Paid
books.deposits Deposits
books.withdrawals Withdrawals
books.playerBalances Player Balances
books.houseNet House Net
books.topEarners Top Earners
books.howToReadTitle How to read this:
books.howToReadBody Rake collected is the total fee taken from pots. Rewards paid is what we returned to players via rakeback, referrals, bonuses, and cashouts. House net is what we kept to run the platform. All numbers update live.
books.updated Updated {time} · refreshes every 60s
home.instantPlay Instant Play
home.jumpIntoGame Jump into a Game
home.quickSeat QUICK SEAT
home.games Games
home.topPlayers Top Players
home.leaderboardSoon Leaderboard coming soon
home.prizesTop30 Monthly prizes for Top 30
home.freeChips Free Chips
home.playFree Play Free
home.noRisk No risk, just fun
home.online online
home.tables tables
home.welcomeBack Welcome Back
home.heroTitleLine1 Play Poker
home.heroTitleLine2 Win Big
home.heroTagline Real players. Real action.
home.playNow Play Now
home.verified Verified
home.provablyFair Provably Fair
home.popularGames Popular Games
home.seeAll See All
events.title Events
events.subtitle Sit and Go schedule and prize pools
events.loading Loading…
events.noEvents No events scheduled
events.noEventsBody New events appear here as soon as they are scheduled
events.prize Prize
events.close Close
events.register Register
events.viewResult View Results
events.live live
events.scheduled scheduled
events.next Next
events.startTime start time
events.prizes Prizes
events.tonTotal TON total
events.tba TBA
events.scheduleTba Schedule to be announced
progress.yourProgress Your Progress
progress.level Level {level}
progress.levelPlain Level
progress.rakeback Rakeback
progress.xpLevel XP · Level {level}
progress.tierProgress Tier Progress
progress.viewDetails View details
progress.yourMoney Your Money
progress.rake Rake {amount}
progress.back Back {amount}
progress.returned returned
loyalty.title Loyalty
loyalty.subtitle XP levels, rakeback tiers and rewards
loyalty.noData No loyalty data yet
loyalty.noDataBody Play a hand to start earning XP and rakeback
loyalty.level Level
loyalty.rakeback Rakeback
loyalty.rakePaid Rake Paid
loyalty.lifetime Lifetime
loyalty.returnedToYou Returned to you
loyalty.xpLevel XP Level
loyalty.xpToLevel {xp} XP to level {level}
loyalty.lvl LVL
loyalty.toLevel to L{level}
loyalty.claimed Claimed
loyalty.available Available
loyalty.availShort {xp} avail
loyalty.cashOutXp Cash Out XP
loyalty.rakebackTier Rakeback Tier
loyalty.rakebackTierSub Lifetime rake unlocks better rates
loyalty.rakebackRate Rakeback rate
loyalty.lifetimeRake {amount} rake
loyalty.toNextTier {amount} to {tier}
shop.title Shop
shop.subtitle Level {level} · Chips, XP and vouchers in one tap
shop.offPct -{pct}% OFF
shop.ofOffer Chips on offer
shop.pack_one {n} pack
shop.pack_other {n} packs
shop.available available
shop.bonusXp Bonus XP
shop.withVouchers_one {n} pack with vouchers
shop.withVouchers_other {n} packs with vouchers
shop.bestValue Best value
shop.noPacksShort no packs
shop.from From
shop.levelDiscount {pct}% level discount active
shop.discountLocked Discount unlocks from L10
shop.info Every pack delivers chips instantly, plus XP and a rake-based voucher.
shop.chipPacks Chip packs
shop.option_one {n} option
shop.option_other {n} options
shop.noPacks No packs available
shop.noPacksBody The store restocks soon — check back later
shop.chipsLabel Chips
shop.xpLabel XP
shop.voucherLabel Voucher
shop.needRake Need rake
shop.chipsUnit {amount} chips
shop.purchased Purchased — chips, XP and voucher added to your account.
shop.processing Processing…
shop.confirmPurchase Confirm Purchase
shop.devNote In dev mode purchases confirm instantly.
shop.devNote2 In production TON Connect and tx_hash verification are enabled.
pack.starter Starter
pack.value Value
pack.premium Premium
pack.mega Mega
pack.ultra Ultra
pack.whale Whale
badBeat.title BAD BEAT JACKPOT
badBeat.subtitle Lose with quads or better and get paid
badBeat.inPool in the pool
badBeat.lastPayout Last payout
badBeat.noPayouts No payouts yet
badBeat.paidAllTime Paid all time
missions.title Daily Missions
missions.seeAll See All
missions.claimed CLAIMED
missions.claim CLAIM
missions.ready READY
missions.inProgress IN PROGRESS
missions.noMissions No missions right now
missions.noMissionsBody New missions unlock every day at 00:00 UTC
missions.claimedToast Claimed {chips} chips + {xp} XP
refill.ready Daily Bonus Ready
refill.title Daily Bonus
refill.tapToClaim Tap to claim
refill.tier {tier} tier
refill.nextIn Next in {time}
refill.claim Claim
refill.claimedToast {amount} chips!
tiers.welcome Welcome
tiers.bronze Bronze
tiers.silver Silver
tiers.gold Gold
tiers.platinum Platinum
tiers.diamond Diamond
errors.notoken Session expired, reopen the app.
errors.forbidden You are not allowed to do that.
errors.not_found Not found.
errors.invalid_id Unknown table.
errors.no_account No account found.
errors.load_failed Could not load. Try again.
errors.request_failed Request failed. Try again.
errors.failed Something went wrong. Try again.
errors.claim_failed Claim failed. Try again.
errors.purchase_failed Purchase failed. Try again.
errors.withdraw_failed Withdraw failed. Try again.
errors.insufficient_balance Insufficient balance.
errors.invalid_address Enter a valid TON address.
errors.amount_below_minimum Amount is below the minimum withdrawal.
errors.deposits_disabled Deposits are temporarily disabled.
errors.withdrawals_disabled Withdrawals are temporarily disabled.
errors.first_withdrawal_locked Complete the unlock conditions first.
errors.bonus_conditions_not_met Bonus conditions are not met yet.
errors.price_unavailable Price is unavailable right now.
errors.escrow_not_found Withdrawal was not found.
errors.already_claimed_today Already claimed today.
errors.invalid_pack This pack is unavailable.
errors.missing_pack_id No pack selected.
errors.invalid_xp Invalid XP amount.
errors.missing_type Missing conversion type.
errors.seed_too_short Too short (min 8 characters).
errors.seed_too_long Too long (max 64 characters).
errors.seed_bad_charset Only letters, digits, "-" and "_" are allowed.
errors.seed_change_cooldown You can change the seed once every 5 minutes.
errors.hand_in_progress A hand is being played. Try again between hands.
errors.invalid_table_id Unknown table.
errors.invalid_hand_id Unknown hand.
errors.missing_hand_id_or_commitment Missing hand commitment.
errors.commitment_not_found No commitment stored for this hand.
errors.no_seed_set No seed set for this table yet.
errors.seed_loaded Saved. It applies from the next hand.
errors.load_seed_failed Could not load your seed.
errors.save_seed_failed Could not save ({code}).
errors.pending_detail Hand in progress. The seed is revealed when the hand ends.
errors.local_failed_detail Local verification failed: {message}
errors.verified_local_detail Verified locally in this browser: commitment, deck and board all match.
errors.verified_server_detail Verified by the server. Local re-check was unavailable for this hand.
errors.failed_detail Verification failed. Do not trust this hand.
errors.unknown Something went wrong. Try again.
fairPanel.footer Provably Fair
fairPanel.title Provably Fair
fairPanel.close Close
fairPanel.commitmentLabel Commitment · SHA-256 of the server seed
fairPanel.seedLabel Server seed · revealed, this hand is over
fairPanel.commitmentNote This hash is the commitment. When the hand ends, the seed is revealed. SHA256(seed) must equal the hash above.
fairPanel.clientSeedLabel Client seed · nonce ({nonce})
fairPanel.mySeedLabel Your client seed · table #{table}
fairPanel.seedPlaceholder 8-64 chars: A-Z a-z 0-9 - _
fairPanel.save Save
fairPanel.verifying Verifying…
fairPanel.verify Verify locally
fairPanel.entropyNote Player-controlled entropy is mixed into the deck (deck-v2): shuffle seed = HMAC-SHA256(server seed, "combined client seed:nonce"). The check above runs in this browser, with the same code the server uses, so no trust in the server verdict is required.
fairPanel.verdictOk Verified
fairPanel.verdictPending Pending
fairPanel.verdictNotFound Not found
fairPanel.verdictFailed Failed
fairPanel.verdictError Error
fairPanel.localChecks Local checks
fairPanel.boardPositions Board positions · expected
fairPanel.serverCrossCheck Server cross-check: {state}.
fairPanel.serverVerified verified
fairPanel.serverNotVerified not verified
fairPanel.checkOk ok
fairPanel.checkFail FAIL
fairPanel.checkNa n/a
```

Sections `wallet`, `home` and `events` already exist in some catalogs — merge into them, do not
replace the existing values.
