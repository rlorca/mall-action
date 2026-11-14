# FLICKERSOFT splash

Reuse `src/splash.rs` in another Rust game. Pass the simulation frame to `letter_visible`, `settled`, and `presents`; transition after `DURATION` frames or an input edge. Rendering and the jingle belong to the host. Alternate letters flicker out of phase for the first 60 frames, then settle; PRESENTS appears at frame 100.
