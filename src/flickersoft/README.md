# FLICKERSOFT Splash Screen Module

A reusable, self-contained retro 8-bit studio splash screen module.

## Features
- NES scanline sprite-limit flicker emulation on alternate frames.
- Rainbow letter styling with NES palette colors.
- Solid lockup phase with underline jingle trigger and "PRESENTS" prompt.
- Skips immediately on any pad button press.

## Usage

```typescript
import { FlickersoftSplash } from "./flickersoft";

const splash = new FlickersoftSplash({
  onComplete: () => {
    // Transition to game title screen
  }
});

// In 60Hz game loop:
splash.update(inputPadState);
splash.render(canvasCtx, 256, 240);
```
