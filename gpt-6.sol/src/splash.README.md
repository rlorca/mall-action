# FLICKERSOFT splash

`drawSplash(ctx, frame)` paints the 256×240 studio bumper without any game state. `splashVisible(letterIndex, frame)` controls the alternate-frame, out-of-phase flicker for the first second. The caller handles timing and the jingle. Import these two functions in another FLICKERSOFT game to reuse it.
