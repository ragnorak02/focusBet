# focusBet

A personal, play-money sportsbook for UFC and PFL cards. Single user, no real
money, no accounts, no other people.

**Live: https://ragnorak02.github.io/focusBet/**

It's a static site with no backend. Your bankroll, bets and cards live in your
browser's `localStorage`; results come straight from a public feed. Nothing you
do is sent to a server, because there isn't one.

<p align="center">
  <em>DraftKings-style board · American moneylines · straights &amp; parlays ·
  automatic result grading</em>
</p>

## What it does

- **Fight cards** — a UFC or PFL event with its full bout order, weight classes,
  records, title fights and card segments (main / prelims).
- **Betting board** — tap a price to add it to the slip. Place it as a straight
  bet or roll several picks into a parlay. Implied win % is shown under every line.
- **Point spread** — a handicap on the judges' total scorecard points.
- **Total rounds** — over/under on how long the fight lasts.
- **Winning method** — KO/TKO/DQ, submission or decision, the three double
  chances, and the draw.
- **Predictions** — tap a fighter's name to call the fight with no money on it,
  and change the call right up until it starts. Kept apart from your bets, and
  scored the moment the result lands.
- **Cash out** — settle an open ticket early; the offer is shown on the button.
  Every one is kept score of: how often you take it, and what the ticket went on
  to do afterwards.
- **Automatic grading** — hit **Refresh results** and finished fights are pulled
  from a live feed, then every ticket touching them settles itself.
- **Manual grading** — tap **Edit** on a card to set a result by hand (winner,
  method, round, time), and undo it just as easily if you got ahead of the
  official call. The board is read-only until you do, since results and lines
  both arrive on their own.
- **Bankroll** — deposit and cash out play money, with a full ledger of every
  stake, payout and refund.
- **Stats** — bankroll curve over time, ROI, record, straights vs parlays,
  per-event P&L, win streaks, biggest win and biggest loss.
- **Tracking periods** — reset the stats to start counting from now, so a change
  in how you bet gets judged on its own record. Nothing is deleted, and one tap
  puts the whole history back.

## Using it

Just open the link above — on a phone, add it to your home screen and it behaves
like an app. It ships seeded with **UFC 330: Makhachev vs. Machado Garry** and a
$50 bankroll, so there's something to bet on immediately.

## Running it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3777>. The dev server binds to `0.0.0.0`, so a phone
on the same network can reach it at `http://<your-ip>:3777`.

`npm run build` produces the static site in `out/`.

## Where results come from

Results come from ESPN's public MMA feed, which carries per-fight winners,
finish method, round and time, and updates within a couple of minutes of the
official call.

ESPN keys that feed by promotion, and two of them are asked for: **UFC** and
**PFL**, the second-largest organisation. Both are pulled on every refresh and
merged, so a PFL card imports, prices and grades exactly like a UFC one.
Bellator and ONE are left out because the same endpoints come back empty.

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

## Where odds come from

Odds are pulled from **BestFightOdds**, which puts every book's price for a
whole card in one server-rendered page: moneylines, totals, the draw, and
method of victory per fighter. `scripts/pull-odds.mjs` scrapes it, picks a
price per market, and writes `public/odds.json`. The app fetches that file on
load, so shipping new lines is a commit rather than an evening of typing.

```bash
npm run odds                       # rebuild public/odds.json
npm run odds -- --dry-run          # print it instead of writing
npm run odds -- --books=Kalshi,FanDuel
npm run odds -- --event=sacramento
```

`.github/workflows/odds.yml` runs it **every two hours** and commits when a
line has actually moved. That push is also what redeploys the site, so the
board on your phone tracks the market with nothing to do by hand.

### Which book you get

Books disagree, and a moneyline taken from two of them can price both corners
as the favourite. So each market is filled from the first book in the
preference order that quotes *the whole* market — both corners of a moneyline,
both sides of a total, all three ways to win. The order defaults to

```
FanDuel, Kalshi, DraftKings, BetRivers, Caesars, BetMGM, BetWay, Unibet, Polymarket
```

and is overridden with `--books=` or the `ODDS_BOOKS` env var. Books that don't
post a market are skipped rather than mixed in, so a card usually comes from
one or two books and the feed's `source` field names them.

Two BestFightOdds conventions worth knowing: **"wins inside distance"** is the
KO-or-submission double chance, and every total a book has posted is listed, so
the one that lands on the board is the one closest to a coin flip — which is
what a book means by its main line.

### Hand-entered lines

`data/odds-manual.json` is laid over the scrape, **field by field, and wins**.
It exists for the two things the scrape can't do: BestFightOdds carries no
handicap on the judges' scorecards, and it doesn't list every card. Delete a
field — or a whole event — to hand that market back to the automated feed.

Both files have the same shape:

```json
{ "espnId": "600059185",
  "lines": [
    { "fighter": "Islam Makhachev", "moneyline": -340,
      "ko": 210, "sub": 260, "dec": 105 }
  ] }
```

Every field past `fighter` is optional:

| field | market |
|---|---|
| `moneyline` | straight win |
| `spread`, `spreadOdds` | signed handicap on the judges' cards |
| `totalLine`, `over`, `under` | total rounds |
| `ko`, `sub`, `dec` | method of victory (`ko` = KO/TKO/DQ) |
| `koSub`, `koDec`, `subDec` | the book's double-chance prices |
| `draw` | draw |

`draw` and the totals belong to the fight rather than a corner, so they're
accepted on whichever fighter's line carries them — but enter a total on *both*
corners, since the two sources can list a bout's corners in opposite order.

Matching is on fighter name and ignores accents, so a book's "Kaue Fernandes"
lands on "Kauê Fernandes". Fights that already have a result are skipped, and
bets keep the price they were struck at, so re-running it can't rewrite history.

### Entering odds in the app

- **Paste odds** on a card — one fighter per line with the price after the name:

  ```
  Ian Machado Garry   +270
  Islam Makhachev     -285
  Gillian Robertson   +178
  Mackenzie Dern      -186
  ```

  Order doesn't matter and surnames alone usually match. This is shaped to accept
  an odds column copied straight off a book or prediction market.

- **Edit** on a card, then **Edit lines** on a bout, to set its prices by hand.

Fights without a price show *No line* and can't be bet until you add one.

## How each market settles

**Method of victory** needs the right fighter *and* the right finish. `KO`
is the book's **KO/TKO/DQ** bucket, so a disqualification cashes a KO ticket;
doctor stoppages and corner retirements count there too. Double chance is any
two of the three. Books price these as their own market, so a book price is
always used when present — the derived fallback (adding the two implied
probabilities) is only a stand-in, and the board marks it with a dot.

**Total rounds** settles on elapsed fight time, regardless of who won. A line of
1.5 is 7:30, so a finish at R2 3:20 (8:20) goes over. A decision is the full
scheduled distance.

**Point spread** is a handicap on the judges' total points, added across all
three cards. It therefore needs a decision *and* the scorecards: enter them when
you set the result. Bets stay open until you do, and **void on any finish**,
since there are no cards to settle against.

**Draw** cashes on a draw, and voids nothing else — a draw still voids the
moneyline and method markets as usual.

A no contest voids every market on the fight.

## Predictions

Tap a fighter's name on a card and you've called the fight. No stake, no slip —
just a record of how you read it, kept deliberately apart from your bets so the
money doesn't colour the call.

- **One per fight.** Tapping the other corner switches the call; tapping your
  own pick again takes it back.
- **Changeable until the fight starts.** Once a bout is live or final the call
  locks, because after that a changed pick would mean nothing.
- **Scored automatically.** When the result lands the pick shows ✓ or ✗ beside
  the fighter's record. A draw or no contest voids it rather than counting
  against you.

The card header keeps that event's running record, and **Stats → Predictions**
keeps the whole picture: accuracy, favourites against underdogs, and how many
of your right calls you had no money on.

## How cash out is valued

A ticket is worth its stake times whatever multiplier is already banked, less a
5% margin. That falls out of the maths rather than being a guess: American odds
are exactly `1/decimal` implied probability, so every still-open leg contributes
`decimal × (1/decimal) = 1` to the expected value. Only legs already won move
the number — which is why a fresh single offers back slightly under its stake,
and a parlay's offer climbs as legs land.

### Keeping score of it

Cashing out hides how the ticket would have gone, and that's exactly what makes
the habit hard to judge. So every cashed ticket is *also* graded as if it had
been left alone. The ticket itself says which way it went — "would have returned
$14.44, cashing out cost $2.04", or "went on to lose, cashing out saved $5.20" —
and **Stats → Cash out** adds them up: how many, what share of your settled
tickets, and whether the offers you took have beaten riding them out. Tickets
whose fights haven't happened yet are counted but left out of the comparison.

## Resetting the stats

**Stats → Reset stats** starts a tracking period. Record, ROI, streaks, the
bankroll curve, per-event P&L and the cash-out numbers all begin counting from
that moment, and the header keeps the all-time figure alongside so you can see
both at once.

Nothing is deleted — it moves a line the page measures from, stored as one
timestamp. **Show all time** clears it and the full record is back. The curve
picks up at the balance the period opened at rather than restarting from zero,
so break-even means "up on this period", not "up on everything you deposited".

For the destructive version — wiping every bet, event and cash entry back to the
seeded state — there's still **Bank → Reset everything**.

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
- There is no way to delete a placed bet. Cash out is the way out of one.

Balance is derived the same way:

```
balance = deposits − withdrawals − stakes + returns
```

## Data

Everything is stored under one `localStorage` key in whichever browser you use.
That has two consequences worth knowing:

- **It's per-browser.** Betting on your phone and on your laptop gives you two
  separate bankrolls; they don't sync.
- **Clearing site data wipes it.** So **Bank → Backup** can download a JSON file
  and restore from one. Worth doing occasionally if you care about the history.

**Bank → Reset everything** returns to the seeded state.

## Stack

Next.js 15 (App Router, static export) · React 19 · TypeScript · Tailwind v4.
No database, no auth, no server. The bankroll chart is hand-rolled inline SVG, so
there's no charting dependency either.

Deployed by GitHub Actions to Pages on every push to `main`.

The results feed sends `access-control-allow-origin: *`, which is what makes a
backend unnecessary — the browser can call it directly.

---

Play money only.
