# Shared Game Utilities

This directory contains shared hooks and utilities used across all game implementations.

## `useGameSession`

A comprehensive hook that consolidates ~200 lines of duplicated code across all 17 games.

### Features

- **Phase State Machine**: Manages `ready` -> `playing` transitions
- **localStorage Management**: Tracks if user has played before (to skip tutorial)
- **Timer Tracking**: Automatic start time and time spent calculation
- **Save Result Logic**: Handles both logged-in and guest users
- **Guest State Management**: Tracks completions and shows signup prompts
- **Celebration Orchestration**: Manages confetti, star burst, and result modals

### Basic Usage

```typescript
import { useGameSession } from '@/games/shared/use-game-session'

function MyGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
  const session = useGameSession({
    gameSlug: 'my-game',
    mode,
    puzzleId,
  })

  // Ready screen
  if (session.isReady) {
    return (
      <div>
        <h1>Ready to play?</h1>
        <Button onClick={session.startGame}>Start Game</Button>
      </div>
    )
  }

  // Game complete - trigger end game
  useEffect(() => {
    if (isGameComplete && !savedRef.current) {
      session.endGame({
        status: isWon ? 'won' : 'lost',
        attempts: guessCount,
        score: 100,
      })
    }
  }, [isGameComplete, isWon])

  return (
    <div>
      <Celebration show={session.showCelebration} />
      <StarBurst show={session.showStarBurst} />

      {/* Your game UI */}

      <GameResultModal
        open={session.showResultModal}
        onClose={() => session.setShowResultModal(false)}
        status={gameStatus}
        stats={{ attempts, timeSpentMs: session.timeSpentMs }}
      />

      <GuestSignupPrompt
        open={session.showGuestSignupPrompt}
        onClose={session.handleCloseGuestPrompt}
      />
    </div>
  )
}
```

### Advanced Usage

#### Perfect Win Detection (Star Burst)

```typescript
const session = useGameSession({
  gameSlug: 'wordle',
  mode,
  puzzleId,
  enableStarBurst: true,
  isPerfectWin: (stats) => stats.attempts === 1,
})
```

#### Custom Celebration

```typescript
const session = useGameSession({
  gameSlug: 'sudoku',
  mode,
  puzzleId,
  celebrationSound: 'perfectWin',
  celebrationHaptic: 'success',
  resultModalDelay: 2000,
})
```

### API Reference

#### Options

```typescript
interface UseGameSessionOptions {
  gameSlug: string              // Required: unique game identifier
  mode?: 'daily' | 'archive'    // Game mode (default: 'daily')
  puzzleId?: string              // Puzzle ID for daily mode
  celebrationSound?: 'perfectWin' | 'win' | 'lose'
  celebrationHaptic?: 'success' | 'win' | 'lose' | 'error'
  enableStarBurst?: boolean      // Enable star burst effect (default: false)
  isPerfectWin?: (stats: GameStats) => boolean
  resultModalDelay?: number      // Delay before result modal (ms)
  guestPromptDelay?: number      // Delay before guest prompt (ms)
}
```

#### Return Values

```typescript
interface UseGameSessionReturn {
  // Phase management
  gamePhase: 'ready' | 'playing'
  setGamePhase: (phase: GamePhase) => void
  isReady: boolean
  isPlaying: boolean

  // Game lifecycle
  startGame: () => void
  endGame: (stats: GameStats) => void

  // Timer
  startTime: number | null
  timeSpentMs: number

  // Modals & UI
  showCelebration: boolean
  showStarBurst: boolean
  showResultModal: boolean
  showGuestSignupPrompt: boolean
  setShowResultModal: (show: boolean) => void
  setShowGuestSignupPrompt: (show: boolean) => void

  // Guest signup
  handleCloseGuestPrompt: () => void

  // Utilities
  resetSession: () => void
}
```

### Migration Guide

#### Before (duplicated code)

```typescript
const [gamePhase, setGamePhase] = useState<'ready' | 'playing'>(() => {
  if (typeof window === 'undefined') return 'ready'
  return localStorage.getItem('played_wordle') ? 'playing' : 'ready'
})
const [startTime, setStartTime] = useState<number | null>(null)
const savedRef = useRef(false)
const [showCelebration, setShowCelebration] = useState(false)
// ... 15+ more lines of state and effects ...

const handleStartGame = () => {
  localStorage.setItem('played_wordle', 'true')
  setStartTime(Date.now())
  setGamePhase('playing')
}

useEffect(() => {
  if (gameStatus === 'won' || gameStatus === 'lost') {
    if (savedRef.current) return
    savedRef.current = true

    const timeSpentMs = startTime ? Date.now() - startTime : 0

    if (isLoggedIn) {
      saveResult({ status: gameStatus, attempts, timeSpentMs })
    } else {
      saveGuestCompletion({ status: gameStatus, attempts })
      incrementGuestGames()
      if (shouldShowSignupPrompt) {
        setTimeout(() => setShowGuestSignupPrompt(true), 2000)
      }
    }

    setShowCelebration(true)
    setTimeout(() => {
      setShowCelebration(false)
      setShowResultModal(true)
    }, 1500)
  }
}, [gameStatus, ...]) // ... many dependencies
```

#### After (using hook)

```typescript
const session = useGameSession({
  gameSlug: 'wordle',
  mode,
  puzzleId,
  enableStarBurst: true,
  isPerfectWin: (stats) => stats.attempts === 1,
})

// Ready screen
if (session.isReady) {
  return <ReadyScreen onStart={session.startGame} />
}

// End game when complete
useEffect(() => {
  if (gameStatus !== 'playing') {
    session.endGame({
      status: gameStatus,
      attempts: guessCount,
    })
  }
}, [gameStatus])
```

### Benefits

1. **Reduced Duplication**: Eliminates 200+ lines per game × 17 games = 3400+ lines
2. **Consistent Behavior**: All games handle lifecycle the same way
3. **Single Source of Truth**: Bug fixes and improvements apply to all games
4. **Type Safety**: Full TypeScript support with comprehensive types
5. **Easy Testing**: Centralized logic is easier to unit test
6. **Better Maintenance**: Changes to game session logic in one place

### Examples

See the following games for complete examples:
- `/src/games/wordle/wordle-game.tsx` - Star burst on perfect win
- `/src/games/sudoku/sudoku-game.tsx` - Simple completion celebration
- `/src/games/killer-sudoku/killer-sudoku-game.tsx` - With keyboard handling
