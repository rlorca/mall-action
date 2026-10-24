# FLICKERSOFT splash

`flickersoft.js` is the reusable studio ident. It has no game-state dependency and no assets: pass a 256×240 Canvas 2D context and a 60 Hz frame number to `drawFlickersoftSplash`. `FLICKERSOFT_SPLASH` documents the timing; `splashLetterVisible` exposes the alternate-frame flicker for tests or another renderer.

```js
import { drawFlickersoftSplash } from "./splash/flickersoft.js";
drawFlickersoftSplash(ctx, frame);
```
