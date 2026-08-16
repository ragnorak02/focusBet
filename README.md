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
