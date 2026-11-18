# FLICKERSOFT studio ident

Load `studio.js` as a classic script. Advance an integer frame counter at 60 Hz and call `Flickersoft.draw(graphics, frame)`. Supply a 256 × 240 graphics adapter with `rect(x,y,w,h,color)` and `text(string,x,y,color,scale,alignment)`. See the named colors and bitmap text renderer in `src/art.js`. Play a studio jingle at frame 60, accept any pad press to skip, and transition at `Flickersoft.duration`. The module owns no clocks, audio or DOM nodes.
