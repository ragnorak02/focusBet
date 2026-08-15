# focusBet

A personal, play-money sportsbook for UFC cards. Single user, no real money, no
accounts, no other people — it runs on your machine and stores everything in one
JSON file.

<p align="center">
  <em>DraftKings-style board · American moneylines · straights &amp; parlays ·
  automatic result grading</em>
</p>

## What it does

- **Fight cards** — a UFC event with its full bout order, weight classes, records,
  title fights and card segments (main / prelims).
- **Betting board** — tap a price to add it to the slip. Place it as a straight
  bet or roll several picks into a parlay. Implied win % is shown under every line.
- **Automatic grading** — hit **Refresh results** and finished fights are pulled
  from a live feed, then every ticket touching them settles itself.
- **Manual grading** — set any result by hand (winner, method, round, time), and
  undo it just as easily if you got ahead of the official call.
- **Bankroll** — deposit and cash out play money, with a full ledger of every
  stake, payout and refund.
- **Stats** — bankroll curve over time, ROI, record, straights vs parlays,
  per-event P&L, win streaks, biggest win and biggest loss.

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3777>.

It ships seeded with **UFC 330: Makhachev vs. Machado Garry** and a $50 bankroll,
so there's something to bet on immediately.

To run it as a normal app rather than in dev mode:

```bash
npm run build
npm start
```

## Where results come from

The results button reads ESPN's public MMA feed, which carries UFC cards with
per-fight winners, finish method, round and time, and updates within a couple of
minutes of the official call.

**Tapology is not used, deliberately.** It sits behind Cloudflare and returns
`403 Forbidden` to any server-side request regardless of headers, so a refresh
button pointed at it would never work. The ESPN feed carries the same cards and
the same finishes.

Matching between your card and the feed is done on fighter names, accent- and
punctuation-insensitive, and it detects when the two sources list a bout's corners
in opposite order so results still land on the right fighter.

### If a card isn't found

Open **Edit card → Event details** and paste the ESPN event id. Importing a card
sets this automatically; you only need it for cards you built by hand.

## Entering odds

The feed doesn't carry moneylines, so those come from you. Two ways:

- **Paste odds** on a card — one fighter per line with the price after the name:

  ```
  Ian Machado Garry   +270
  Islam Makhachev     -285
  Gillian Robertson   +178
  Mackenzie Dern      -186
  ```

  Order doesn't matter and surnames alone usually match. This is shaped to accept
  an odds column copied straight off a book or prediction market.

- **Edit card** to set a single bout's prices by hand.

Fights without a price show *No line* and can't be bet until you add one.

## How settlement works

Bet status is never stored. It's recomputed from the fight results every time the
app reads state, which means:

- Clearing a result cleanly unwinds every bet it settled — no drift, no orphaned
  payouts.
- A draw or No Contest **voids** that leg. On a parlay the leg drops out of the
  price entirely and the rest of the ticket plays on; if every leg voids, the
  stake is refunded.
- Deleting a fight or an event voids bets on it and refunds the stake rather than
  silently losing it.

Balance is derived the same way:

```
balance = deposits − withdrawals − stakes + returns
```

## Data

Everything lives in `data/db.json`, which is gitignored — your bankroll and bet
history stay on your machine. Deleting the file resets the app to its seeded state,
as does **Bank → Reset everything**.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4. No database, no
auth, no external services beyond the results feed. The bankroll chart is
hand-rolled inline SVG, so there's no charting dependency.

---

Play money only.
