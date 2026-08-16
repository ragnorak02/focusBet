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
- **Winning method** — a fighter to win specifically by KO/TKO, submission or
  decision, plus the double chances (KO or Sub, KO or Dec, Sub or Dec).
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

`ko`/`sub`/`dec` are optional and come from a book's *Winning Method* market.
Leave them out and the fight simply offers no method lines. You can also enter
them per fight in the app, under **+ Winning method lines**.

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

## How the method markets price

Single methods are the book's own numbers. **Double chances are derived**, by
adding the implied probabilities of the two finishes and converting back to
American odds — the same way a book builds them, vig included. So KO +210 and
Sub +260 (32.3% + 27.8% = 60.1%) gives "KO or Sub" at −150.

A method leg needs the right fighter *and* the right finish. Doctor stoppages
count as TKOs. A win by disqualification fits no category, so those legs are
voided and the stake refunded rather than taken.

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
