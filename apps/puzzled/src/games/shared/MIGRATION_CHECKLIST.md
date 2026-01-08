# Migration Checklist

Use this checklist to migrate an existing game to use `useGameSession`.

## Step 1: Add the Hook

```typescript
import { useGameSession } from '@/games/shared/use-game-session'

// Inside your component:
const session = useGameSession({
  gameSlug: 'your-game-slug',  // e.g., 'wordle', 'sudoku'
  mode,
  puzzleId,
  // Optional: Star burst on perfect wins
  enableStarBurst: true,
  isPerfectWin: (stats) => stats.attempts === 1,
})
```

## Step 2: Remove Old State

Delete these state variables (now in session):
- [ ] `gamePhase` / `setGamePhase`
- [ ] `startTime` / `setStartTime`
- [ ] `savedRef`
- [ ] `showCelebration` / `setShowCelebration`
- [ ] `showStarBurst` / `setShowStarBurst` (if used)
- [ ] `showResultModal` / `setShowResultModal`
- [ ] `showGuestSignupPrompt` / `setShowGuestSignupPrompt`

Delete these hooks (now in session):
- [ ] `useSaveGameResult`
- [ ] `useGuestGameState`
- [ ] `useOnboardingState`

Keep these (game-specific):
- [ ] Game-specific state (e.g., `guesses`, `grid`, etc.)
- [ ] UI state (e.g., `showHelpModal`, `showToast`)

## Step 3: Replace Start Game Handler

**Before:**
```typescript
const handleStartGame = () => {
  localStorage.setItem('played_your-game', 'true')
  setStartTime(Date.now())
  setGamePhase('playing')
}
```

**After:**
```typescript
// Just use session.startGame directly in JSX
<Button onClick={session.startGame}>Start Game</Button>
```

## Step 4: Remove Start Time Effect

**Delete this entire effect:**
```typescript
useEffect(() => {
  if (gamePhase === 'playing' && startTime === null) {
    setStartTime(Date.now())
  }
}, [gamePhase, startTime])
```

## Step 5: Simplify End Game Logic

**Before (celebration + save effects - ~60+ lines):**
```typescript
// Celebration effect
useEffect(() => {
  if (gameStatus === 'won') {
    setShowCelebration(true)
    triggerSound('perfectWin')
    // ... more celebration logic
  }
}, [gameStatus])

// Save result effect
useEffect(() => {
  if (gameStatus !== 'playing' && !savedRef.current) {
    savedRef.current = true
    const timeSpentMs = startTime ? Date.now() - startTime : 0

    if (isLoggedIn) {
      saveResult({ ... })
    } else {
      saveGuestCompletion({ ... })
      incrementGuestGames()
      // ... more guest logic
    }

    setTimeout(() => setShowResultModal(true), 1500)
  }
}, [gameStatus, ...many deps])
```

**After (~10 lines):**
```typescript
// End game when complete
useEffect(() => {
  if (gameStatus !== 'playing') {
    session.endGame({
      status: gameStatus,
      attempts: guessCount,
      score: 100, // optional
    })
  }
}, [gameStatus, guessCount, session.endGame])
```

## Step 6: Remove Guest Prompt Handler

**Delete this:**
```typescript
const handleCloseGuestPrompt = () => {
  setShowGuestSignupPrompt(false)
  dismissSignupPrompt()
}
```

**Use this instead:**
```typescript
<GuestSignupPrompt
  open={session.showGuestSignupPrompt}
  onClose={session.handleCloseGuestPrompt}
/>
```

## Step 7: Update JSX

Replace state references with `session.*`:

**Before:**
```typescript
if (gamePhase === 'ready') { ... }

<Button onClick={handleStartGame}>Start</Button>
<Celebration show={showCelebration} />
<StarBurst show={showStarBurst} />
<GameResultModal
  open={showResultModal}
  onClose={() => setShowResultModal(false)}
  stats={{ timeSpentMs: startTime ? Date.now() - startTime : 0 }}
/>
<GuestSignupPrompt
  open={showGuestSignupPrompt}
  onClose={handleCloseGuestPrompt}
/>
```

**After:**
```typescript
if (session.isReady) { ... }

<Button onClick={session.startGame}>Start</Button>
<Celebration show={session.showCelebration} />
<StarBurst show={session.showStarBurst} />
<GameResultModal
  open={session.showResultModal}
  onClose={() => session.setShowResultModal(false)}
  stats={{ timeSpentMs: session.timeSpentMs }}
/>
<GuestSignupPrompt
  open={session.showGuestSignupPrompt}
  onClose={session.handleCloseGuestPrompt}
/>
```

## Step 8: Test

- [ ] Ready screen shows for first-time users
- [ ] Ready screen skipped for returning users
- [ ] Game starts and timer begins
- [ ] Celebration shows on win/loss
- [ ] Star burst shows on perfect win (if enabled)
- [ ] Result modal appears after celebration
- [ ] Guest users see signup prompt (after 3rd game)
- [ ] Logged-in users don't see signup prompt
- [ ] Time is calculated correctly
- [ ] Result is saved to database (logged-in) or localStorage (guest)

## Expected Savings

- **Lines of Code**: -80 to -120 lines per game
- **State Variables**: -6 to -9 fewer
- **useEffect Hooks**: -2 to -3 fewer
- **Custom Handlers**: -1 to -2 fewer
- **Dependencies**: -12 to -20 fewer

## Common Issues

### Issue: TypeScript error on `endGame`
**Solution:** Make sure `status` is `'won' | 'lost'`, not `'playing'`

### Issue: Celebration doesn't show
**Solution:** Check that you're calling `endGame` when game completes, not just setting status

### Issue: Time is always 0
**Solution:** Make sure game starts with `session.startGame()` or that you're in 'playing' phase

### Issue: Result not saving
**Solution:** Verify `mode === 'daily'` and `puzzleId` is provided
