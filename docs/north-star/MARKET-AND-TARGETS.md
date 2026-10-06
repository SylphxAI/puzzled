# Market and targets

Who Puzzled competes with, and the numbers that say whether it is working:
D1, D7 and D30 retention, free-to-paid conversion and monthly recurring
revenue (MRR), each with the cohort size it is judged on. Metric definitions
are in [metrics.md](../metrics.md); prices and plans in
[monetization.md](../monetization.md); the growth backlog in
[growth.md](../growth.md). Sources were read on 2026-10-06 unless a row says
otherwise; re-check a competitor row before using it to change our price.

## Competitors

| Product | Owner | Price | Cadence | Share mechanic | What it means for us |
| --- | --- | --- | --- | --- | --- |
| NYT Games (Crossword, Spelling Bee, Connections, Strands, the Mini, archive) | The New York Times | Games: US$6 every 4 weeks or US$50 a year on the web (intro US$3 every 4 weeks, US$25 the first year); App Store "Games - Monthly" US$4.99 and US$5.99; Games Family US$10 a month for up to 4 people (from 2025-09) | One new puzzle per game per day; Connections and Wordle switch at local midnight; archive of 10,000+ past puzzles is paid | Per-game spoiler-free result text or grid (Wordle's emoji grid, Connections' coloured rows), copied to the clipboard and pasted into chats and social posts | The category leader and our price anchor. Free hooks (Wordle, Connections, the Mini) feed a paid suite; we copy that shape, priced a little under it ([monetization.md](../monetization.md#3-price)) |
| Wordle | The New York Times (bought 2022-01) | Free; the archive needs NYT Games | One five-letter word a day for everyone, one attempt | The emoji grid: guesses as coloured squares, no letters, so a friend sees how you did without the answer. Invented by players and adopted by the creator, it made the game spread | The proof of our loop (finish, share, land, first finish). Volume: NYT reported 4.2 billion Wordle solves in 2025 (about 11.5 million a day) |
| Puzzmo (Cross\|word, SpellTower, Typeshift, Bongo, Pile-Up Poker, Memoku, Really Bad Chess and more) | Hearst | Daily puzzles free with ads; Puzzmo Plus US$3.99 a month or US$39.99 a year (2025-05 app launch) for the archive (10,000+ puzzles), early games and no ads; also bundled into some Hearst newspaper subscriptions | A new set of puzzles on the Today page every day | Shareable score summaries, groups of friends, global and group leaderboards and personal stats; Game Center on iOS | The closest product to ours (a designer-led multi-game daily page). Its price sits just under NYT, as ours does; groups and friend boards are our backlog row 6 |
| LinkedIn Games (Queens, Tango, Zip, Pinpoint, Crossclimb, Mini Sudoku and more) | LinkedIn | Free; no paid tier: the games exist to bring members back to the feed | One puzzle per game per day, the same for everyone; reset at midnight Pacific time per most guides (unverified) | A results card to the feed or a direct message with game number and time, never the answer; streaks visible to connections; leaderboards against connections, your company and your school | The best published retention in the category: LinkedIn's games product manager reported 84% of players return the next day and 80% within a week (2025-12). It is a feed-attached free product, so it sets our upper bound, not our base case |
| Times Puzzles (UK) | The Times | £3.99, £4.99 or £6.99 a month after a 7-day trial (App Store, read 2026-09-26) | Daily crosswords and puzzles, with an archive | Little: no spoiler-free share card | Our GBP anchor; a trial before payment is normal here |

### Sources

- NYT Games prices: Nieman Lab 2025-09-08 and Axios 2025-09-08 (family plan, US$50 a year individual); an official NYT offer quoted on Slickdeals 2024-06-11 (US$6 every 4 weeks, US$50 a year, intro US$3 and US$25); App Store listing id307569751. nytimes.com/subscription/games renders in script and could not be read directly, so the web price is second-hand.
- Wordle: Wikipedia "Wordle" (share grid history); NYT's 2025 year in review as reported by Engadget (4.2 billion solves).
- Puzzmo: Hearst press release "Puzzmo Launches Mobile App Exclusively for iPhone" (2025-05-19); App Store listing id6714482734; Weekand Puzzmo guide (2025-09).
- LinkedIn Games: linkedin.com/games; Social Media Today on Zip (2025-03-18); NetInfluencer "LinkedIn Bets On Games" (2025-12, the 84% and 80% figures). Player counts from third-party sites (3.5 million a day, 2026-05) are unverified and not used.
- Times Puzzles: App Store listing id1531296302 (read 2026-09-26, carried from [monetization.md](../monetization.md#3-price)).

## Benchmarks behind the targets

| Benchmark | D1 | D7 | D30 | Source |
| --- | --- | --- | --- | --- |
| All mobile games, median (2025 data) | about 22% | just under 4% | 0.7 to 0.8% | GameAnalytics 2026 Mobile and PC Gaming Benchmarks |
| All mobile games, top 25% (2025 data) | about 27% | 6 to 7% | 1.6 to 1.8% | GameAnalytics 2026 (D1 from the 2025 report) |
| Puzzle games, median / top 25% / top 10% | 35% / 42% / 48% | 14% / 18% / 22% | 6% / 9% / 12% | GameInsights.ai retention benchmarks 2026 (third-party, method not published) |
| LinkedIn Games (daily puzzles in a feed) | 84% return next day | 80% within a week | not published | LinkedIn, 2025-12 (rolling return, not classic retention) |

| Benchmark | Value | Source |
| --- | --- | --- |
| Freemium download-to-paid by day 35, median | 2.1% (2.18% in the 2025 report) | RevenueCat State of Subscription Apps 2025 and 2026 |
| Same, North America-based developers, median / top 25% | 2.6% / above 5.6% | RevenueCat 2025 |
| Same, iOS / Android, median | 2.6% / 0.9% | RevenueCat 2025 |
| Gaming: trial-to-paid, median / top 25% | 25.0% / above 39.8% | RevenueCat State of Subscription Apps 2026, Gaming |
| Gaming: days to US$1,000 MRR, median | 32 | RevenueCat 2026, Gaming |

Mobile-game retention counts an app open; ours counts a finish
([metrics.md](../metrics.md)), which is stricter on each later day but starts
from players who already finished once, so bounces never enter the cohort.
We therefore aim at the puzzle top quartile, not the all-games median, and
treat LinkedIn as the ceiling.

## Targets

None of these is measured yet: there is no cohort report
([growth.md](../growth.md#north-star-and-inputs)) and Plus is not on sale. A
target is judged only when its cohort reaches the size in its row; a smaller
cohort is reported as "not yet judgeable", never as a pass or a fail. Below
that size the 95% confidence interval is wider than the gap between the floor
and the target.

### Retention of new completers

Cohort: players whose first qualifying finish (the day-0 completer day,
[metrics.md](../metrics.md#what-qualifies)) falls in one product week
(Asia/Hong_Kong), guests and signed-in players together, with the signed-in
split reported. Day N retention is the share who finish again on day N
exactly (classic, not rolling). D30 is day 30; the D28 in
[metrics.md](../metrics.md#supporting-metrics) is reported beside it and has
the same target.

| Metric | Floor (act below it) | Target | Stretch | Judged on |
| --- | --- | --- | --- | --- |
| D1 | 35% | 42% | 55% | At least 1,000 new completers; pool consecutive weeks (at most 4) until reached |
| D7 | 14% | 20% | 30% | At least 1,000 new completers, as D1 |
| D30 | 6% | 10% | 15% | At least 1,000 new completers whose day 30 has passed |

Why these numbers: the floor is the puzzle median, the target is the puzzle
top quartile (D7 a little above it, because the free daily, streak freezes and
reminders all aim at day 7), and the stretch is halfway to the LinkedIn
ceiling. With 1,000 players the interval is about plus or minus 3 points at
D1 and 2.5 points at D7.

### Free-to-paid

Free-to-paid is the share of a cohort's new signed-in completers who make a
first paid Plus charge (individual or family, after any trial ends) within 35
days of day 0. Day 35 matches the RevenueCat benchmark. The reverse trial grants
access but is not a payment, so it never counts as paid.

| Metric | Floor | Target | Stretch | Judged on |
| --- | --- | --- | --- | --- |
| Free-to-paid by day 35 | 2.1% | 3.0% | 5.6% | At least 2,000 new signed-in completers whose day 35 has passed, counted from the day Plus goes on sale |
| Weekly regulars to paid (7 or more completer days in the prior 14, the [metrics.md](../metrics.md#stage-targets) "Paid habit" stage) | 5% | 8% | 12% | At least 500 weekly regulars, each counted at the first day they qualify, judged 35 days later |
| Yearly-plan trial to paid | 25% | 30% | 40% | At least 200 trials that have ended |

Why: the floor is the freemium median; the target sits above it because the
offer is shown only to players who already have the habit and the yearly plan
comes first (higher-priced apps convert better: 2.7% against 1.5%, RevenueCat
2025); the stretch is the North America top quartile. The weekly-regulars and
trial rows are our own estimates, not benchmarks: no published figure exists
for daily-puzzle subscribers, so the first 90 days of sales recalibrate them.
At 2,000 players and 3%, the interval is about plus or minus 0.75 points.

### MRR

MRR is the sum of active paid Puzzled Plus subscriptions, each normalised to
one month (a yearly plan counts 1/12), excluding tax, trials and one-off
purchases, read from Sylphx Money and reported in US dollars.

Unit: with the yearly plan shown first we expect about 70% yearly (estimate),
so the blended tax-inclusive price is about US$3.83 a month (0.7 x 39.99 / 12
+ 0.3 x 4.99) and about US$3.20 excluding UK VAT; we use US$3.20.

| Milestone | Paying subscribers needed | New completers it implies at the 3.0% target | Judged |
| --- | --- | --- | --- |
| US$1,000 MRR | about 310 | about 10,400 since Plus went on sale | At day 90 after Plus goes on sale, on that cumulative cohort; not judged before the cohort reaches 10,400 |
| US$5,000 MRR | about 1,560 | about 52,000 | At day 365, on the cumulative cohort since sale |
| US$10,000 MRR | about 3,130 | about 104,000 | Stretch for day 365 |

US$1,000 at day 90 is about 115 new completers a day for 90 days; the median
gaming subscription app reaches it in 32 days (RevenueCat 2026), so day 90
allows for a web-first product with no store traffic. If the cohort is on
target but MRR is not, read the plan mix and churn before the conversion rate.

## How these are read

| Number | Where it comes from | What is missing |
| --- | --- | --- |
| D1, D7, D30 | `game_sessions` finish rows (`compute_drc` per day, first completer day per player) | The cohort report (Signal analytics, cloud#9511, or a scheduled SQL job) |
| Free-to-paid, trial to paid | Money subscriptions joined to first completer day by account | Plus on sale (Sylphx Money subscriptions, cloud#9152) |
| MRR | Sylphx Money ledger and subscription state | Plus on sale |

Review: retention weekly, conversion and MRR monthly, as in
[metrics.md](../metrics.md#review-rhythm). Change a target only with the cohort
that justifies it, and record the reason in this file.
