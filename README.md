# focusBet

A personal, play-money sportsbook for UFC cards. Single user, no real money, no
accounts, no other people.

**Live: https://ragnorak02.github.io/focusBet/**

It's a static site with no backend. Your bankroll, bets and cards live in your
browser's `localStorage`; results come straight from a public feed. Nothing you
do is sent to a server, because there isn't one.

<p align="center">
  <em>DraftKings-style board · American moneylines · straights &amp; parlays ·
  automatic result grading</em>
</p>

## What it does

- **Fight cards** — a UFC event with its full bout order, weight classes, records,
  title fights and card segments (main / prelims).
- **Betting board** — tap a price to add it to the slip. Place it as a straight
  bet or roll several picks into a parlay. Implied win % is shown under every line.
- **Point spread** — a handicap on the judges' total scorecard points.
- **Total rounds** — over/under on how long the fight lasts.
- **Winning method** — KO/TKO/DQ, submission or decision, the three double
  chances, and the draw.
- **Cash out** — settle an open ticket early; the offer is shown on the button.
- **Automatic grading** — hit **Refresh results** and finished fights are pulled
  from a live feed, then every ticket touching them settles itself.
- **Manual grading** — set any result by hand (winner, method, round, time), and
  undo it just as easily if you got ahead of the official call.
- **Bankroll** — deposit and cash out play money, with a full ledger of every
  stake, payout and refund.
- **Stats** — bankroll curve over time, ROI, record, straights vs parlays,
  per-event P&L, win streaks, biggest win and biggest loss.

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

No free feed carries moneylines, so they're committed to this repo as
`public/odds.json` and published with the site. **Refresh results** pulls that
file alongside the live results, so shipping new lines is just a commit — nothing
to re-enter on the phone.

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
accepted on whichever fighter's line carries them. You can also enter any of it
per fight in the app under **Edit lines**.

Matching is on fighter name and ignores accents, so a book's "Kaue Fernandes"
lands on "Kauê Fernandes". Fights that already have a result are skipped, and
bets keep the price they were struck at, so re-running it can't rewrite history.

You can also enter lines yourself:

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

## How cash out is valued

A ticket is worth its stake times whatever multiplier is already banked, less a
5% margin. That falls out of the maths rather than being a guess: American odds
are exactly `1/decimal` implied probability, so every still-open leg contributes
`decimal × (1/decimal) = 1` to the expected value. Only legs already won move
the number — which is why a fresh single offers back slightly under its stake,
and a parlay's offer climbs as legs land.

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
