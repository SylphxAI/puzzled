# Migration Example: Wordle Game

This document shows a side-by-side comparison of before/after using `useGameSession`.

## Before (Original Code)

**State & Hooks (35 lines)**
```typescript
const { saveResult, reset: resetSave, isLoggedIn } = useSaveGameResult('wordle')
const { saveCompletion: saveGuestCompletion } = useGuestGameState('wordle')
const { incrementGuestGames, shouldShowSignupPrompt, dismissSignupPrompt } = useOnboardingState()

// Skip rules for returning users (check localStorage)
const [gamePhase, setGamePhase] = useState<'ready' | 'playing'>(() => {
  if (typeof window === 'undefined') return 'ready'
  return localStorage.getItem('played_wordle') ? 'playing' : 'ready'
})
const [showToast, setShowToast] = useState(false)
const [toastMessage, setToastMessage] = useState('')
const [startTime, setStartTime] = useState<number | null>(null)
const savedRef = useRef(false)
const [showCelebration, setShowCelebration] = useState(false)
const [showStarBurst, setShowStarBurst] = useState(false)
const [showHelpModal, setShowHelpModal] = useState(false)
const [showGuestSignupPrompt, setShowGuestSignupPrompt] = useState(false)
const [shakeRow, setShakeRow] = useState(false)
const [showResultModal, setShowResultModal] = useState(false)
```

**Start Game Handler (6 lines)**
```typescript
const handleStartGame = () => {
  localStorage.setItem('played_wordle', 'true')
  setStartTime(Date.now())
  setGamePhase('playing')
}
```

**Start Time Effect (7 lines)**
```typescript
// Set start time for returning users who skip the ready screen
useEffect(() => {
  if (gamePhase === 'playing' && startTime === null) {
    setStartTime(Date.now())
  }
}, [gamePhase, startTime])
```

**Win/Loss Celebration Effect (22 lines)**
```typescript
// Trigger celebration on win and show result modal
useEffect(() => {
  if (gameStatus === 'won') {
    // Perfect game (1 guess) gets star burst
    if (guesses.length === 1) {
      setShowStarBurst(true)
      triggerSound('perfectWin')
      triggerHaptic('win')
    } else {
      triggerSound('win')
      triggerHaptic('win')
    }
    // All wins get confetti
    setShowCelebration(true)
    // Show result modal after a brief delay for animation
    setTimeout(() => setShowResultModal(true), 1500)
  } else if (gameStatus === 'lost') {
    triggerSound('lose')
    triggerHaptic('lose')
    // Show result modal after a brief delay
    setTimeout(() => setShowResultModal(true), 1000)
  }
}, [gameStatus, guesses.length])
```

**Save Result Effect (45 lines)**
```typescript
// Save game result when game ends (daily mode only)
useEffect(() => {
  if (mode !== 'daily' || gameStatus === 'playing' || savedRef.current) return

  savedRef.current = true
  const timeSpentMs = startTime ? Date.now() - startTime : 0

  if (isLoggedIn) {
    // Save to database for logged-in users
    saveResult({
      status: gameStatus,
      attempts: guesses.length,
      timeSpentMs,
      puzzleDate: new Date().toISOString().split('T')[0],
      mode: 'daily',
      puzzleId,
    })
  } else {
    // Save to localStorage for guest users
    saveGuestCompletion({
      status: gameStatus,
      attempts: guesses.length,
    })

    // Track guest game completion for onboarding
    incrementGuestGames()

    // Show signup prompt if appropriate
    if (shouldShowSignupPrompt) {
      // Delay slightly so celebration can be seen first
      setTimeout(() => {
        setShowGuestSignupPrompt(true)
      }, 2000)
    }
  }
}, [
  gameStatus,
  mode,
  guesses.length,
  startTime,
  saveResult,
  puzzleId,
  isLoggedIn,
  saveGuestCompletion,
  incrementGuestGames,
  shouldShowSignupPrompt,
])
```

**Guest Prompt Handler (4 lines)**
```typescript
const handleCloseGuestPrompt = () => {
  setShowGuestSignupPrompt(false)
  dismissSignupPrompt()
}
```

**Total: ~119 lines of session management code**

---

## After (Using useGameSession)

**State & Hooks (12 lines)**
```typescript
const session = useGameSession({
  gameSlug: 'wordle',
  mode,
  puzzleId,
  enableStarBurst: true,
  isPerfectWin: (stats) => stats.attempts === 1,
})

const [showToast, setShowToast] = useState(false)
const [toastMessage, setToastMessage] = useState('')
const [shakeRow, setShakeRow] = useState(false)
const [showHelpModal, setShowHelpModal] = useState(false)
```

**Start Game Handler (1 line)**
```typescript
// Built into session.startGame() - no custom handler needed
```

**Start Time Effect (0 lines)**
```typescript
// Automatically handled by useGameSession
```

**Win/Loss Celebration Effect (0 lines)**
```typescript
// Automatically handled by useGameSession
```

**Save Result Effect (11 lines)**
```typescript
// Save game result when game ends
useEffect(() => {
  if (gameStatus !== 'playing') {
    session.endGame({
      status: gameStatus,
      attempts: guesses.length,
    })
  }
}, [gameStatus, guesses.length, session.endGame])
```

**Guest Prompt Handler (0 lines)**
```typescript
// Built into session.handleCloseGuestPrompt()
```

**Total: ~23 lines of session management code**

---

## Summary

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Lines of Code | 119 | 23 | **96 lines (-80%)** |
| State Variables | 9 | 3 | **6 fewer** |
| useEffect Hooks | 3 | 1 | **2 fewer** |
| Custom Handlers | 2 | 0 | **2 fewer** |
| Dependencies | 15+ | 3 | **12+ fewer** |

## Benefits

1. **Cleaner Code**: Component focuses on game logic, not session management
2. **Fewer Bugs**: Centralized logic reduces chance of mistakes
3. **Consistency**: All games behave identically
4. **Maintainability**: Changes in one place affect all games
5. **Type Safety**: Full TypeScript support with better inference
6. **Testing**: Easier to test session logic in isolation

## JSX Changes

**Before:**
```typescript
<Button onClick={handleStartGame}>Start Game</Button>
<GuestSignupPrompt
  open={showGuestSignupPrompt}
  onClose={handleCloseGuestPrompt}
/>
<Celebration show={showCelebration} />
<StarBurst show={showStarBurst} />
<GameResultModal
  open={showResultModal}
  onClose={() => setShowResultModal(false)}
  stats={{ timeSpentMs: startTime ? Date.now() - startTime : 0 }}
/>
```

**After:**
```typescript
<Button onClick={session.startGame}>Start Game</Button>
<GuestSignupPrompt
  open={session.showGuestSignupPrompt}
  onClose={session.handleCloseGuestPrompt}
/>
<Celebration show={session.showCelebration} />
<StarBurst show={session.showStarBurst} />
<GameResultModal
  open={session.showResultModal}
  onClose={() => session.setShowResultModal(false)}
  stats={{ timeSpentMs: session.timeSpentMs }}
/>
```

**Changes:** Just prefix state/handlers with `session.` - that's it!
