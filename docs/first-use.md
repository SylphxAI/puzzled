# First-use check

The journey a brand-new player takes on https://puzzled.gg, for a manual or
scripted pass after a deploy. It complements `bun run verify:live`
([reference/live-verification.md](reference/live-verification.md)), which checks
the api; this checks what a person sees. Run it at 390x844 and again at 1366x850.

1. Open `/`. Expect the date, "Puzzle #N", a "Free today" card for the featured
   game and a "Play today's ..." button. No console errors.
2. Press the play button (it goes to `/games/<slug>?start=1#play`). Expect the
   board for today's puzzle with no sign-in prompt.
3. Play the puzzle to a finish through the UI; the server grades every guess.
   Expect the result dialog: trophy, attempts, mistakes, time, Share, and a
   "Save your streak / Create Free Account" prompt. The dialog is centred on
   desktop and reachable (nothing cut off) on a phone.
4. Press Share. Expect text with the game, date, attempts and a `puzzled.gg/daily?ref=`
   link, and no answer words.
5. Open another game, for example `/games/word-guess?start=1#play`. While Plus
   is not on sale expect "This game is part of Puzzled Plus" with "Today's free
   puzzle is ..." and a link back to the free game.
6. Press "Create Free Account" (`/signup`). Fill name, email and a password of
   12 or more characters, press Sign Up. Expect to land back on the game with
   "Saved to your account" and the finished state.
7. Open `/stats`. Expect "1-day streak", played 1, and the featured game marked
   "Finished" under Today.
8. Open `/settings/account`, press "Sign out of this device". Expect the home
   page and a signed-out header ("Sign In").
9. Open `/login`, sign in with the same email and password. Open `/stats`:
   the streak and the finished game are still there.

Synthetic account: use an email like `synthetic+<tag>@sylphx.com`, register the
row in the synthetic register at mint time, and erase only that id afterwards
(`/settings/account`, "Delete my data").
