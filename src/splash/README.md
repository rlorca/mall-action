# FLICKERSOFT splash

Import `splashFrame` to get the presentation state for a 60 Hz frame. During the
first 60 frames, adjacent letters are drawn on alternating frames. The logo
settles at frame 60, PRESENTS appears at 105, and the splash ends at 180.

`drawSplash(pixel, frame, label, presents, rainbow)` draws to a 256×240 target
using three drawing methods. The adapter needs `rect(x, y, w, h, color)`,
`text(text, x, y, color, scale)`, and `center(text, x, y, color, scale)`.
The caller handles input-to-skip and plays the studio jingle at `JINGLE_FRAME`.
The module has no DOM, game-state, or audio dependencies.
