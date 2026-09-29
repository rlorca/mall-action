# FLICKERSOFT Splash Module

A reusable studio splash screen for FLICKERSOFT games.

## Usage

```typescript
import { createSplashState, updateSplash, getSplashRenderInfo } from './splash';

// Create initial state
const splash = createSplashState();

// Each frame: update and get render info
const nextState = updateSplash(splash, skipButtonPressed);
const renderInfo = getSplashRenderInfo(nextState);

// renderInfo contains:
// - letters: array of { char, visible, color } for each letter of "FLICKERSOFT"
// - showUnderline: whether to draw the underline
// - showPresents: whether to show "PRESENTS"
// - phase: 'flicker' | 'settle' | 'presents' | 'done'
```

## Phases

1. **Flicker** (~1 second): Letters appear on alternate frames, neighbours out of phase
2. **Settle** (~0.5 seconds): All letters solid, underline appears
3. **Presents** (~1.5 seconds): "PRESENTS" text shown below
4. **Done**: Splash complete

Any button press skips directly to done.

## Design

- Pure functions, no rendering dependencies
- Framework-agnostic: you render the output however you like
- Deterministic: same frame always produces the same output
