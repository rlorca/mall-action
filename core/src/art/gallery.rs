//! `?gallery=1`: every sprite, animated (art agent 1 owns this file).
//!
//! Sprites are packed left to right in shelves (rows); a row is as tall as its tallest sprite plus a name
//! label. When the next row would not fit, a new page starts. Sprites up to 80 px wide (storefronts) and
//! 112 px tall (the skyscraper) fit. Each sprite cycles its frames at `TICKS_PER_FRAME` and sits on a dark
//! checkerboard so transparency is visible.

use crate::pixel::{pal, text_width, Fb, FontKind, W};

/// Ticks (60 Hz frames) each animation frame is shown.
pub const TICKS_PER_FRAME: u32 = 8;

const MARGIN: i32 = 4;
const TOP: i32 = 16;
const BOTTOM: i32 = 238;
const GAP_X: i32 = 4;
const GAP_Y: i32 = 4;
const LABEL_H: i32 = 6;

/// One placed sprite.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cell {
    pub name: String,
    pub x: i32,
    pub y: i32,
}

/// Lay out all sprites of the registry into pages.
pub fn layout() -> Vec<Vec<Cell>> {
    let mut pages: Vec<Vec<Cell>> = vec![Vec::new()];
    let (mut x, mut y, mut row_h) = (MARGIN, TOP, 0);
    for (name, s) in super::registry() {
        let label_w = text_width(FontKind::Tiny, name);
        let cell_w = (s.w as i32).max(label_w).min(W as i32 - 2 * MARGIN);
        let cell_h = s.h as i32 + LABEL_H;
        if x + cell_w > W as i32 - MARGIN && x > MARGIN {
            x = MARGIN;
            y += row_h + GAP_Y;
            row_h = 0;
        }
        if y + cell_h > BOTTOM && !pages.last().map(|p| p.is_empty()).unwrap_or(true) {
            pages.push(Vec::new());
            x = MARGIN;
            y = TOP;
            row_h = 0;
        }
        // centre the sprite above its (possibly wider) label
        pages.last_mut().unwrap().push(Cell { name: name.clone(), x, y });
        x += cell_w + GAP_X;
        row_h = row_h.max(cell_h);
    }
    pages
}

/// Draw gallery page `page` (0-based, wraps). Returns the total page count so the host can wrap.
pub fn draw(fb: &mut Fb, page: usize, tick: u32) -> usize {
    let pages = layout();
    let total = pages.len().max(1);
    let page = page % total;
    fb.clear(pal::BLACK);
    fb.text(MARGIN, 4, &format!("GALLERY {}/{}", page + 1, total), pal::WHITE);
    for cell in &pages[page] {
        let s = super::get(&cell.name);
        let label_w = text_width(FontKind::Tiny, &cell.name);
        let cell_w = (s.w as i32).max(label_w);
        let sx = cell.x + (cell_w - s.w as i32) / 2;
        // checkerboard (4px squares) behind the sprite
        for yy in 0..s.h as i32 {
            for xx in 0..s.w as i32 {
                let dark = ((xx / 4) + (yy / 4)) % 2 == 0;
                fb.put(sx + xx, cell.y + yy, if dark { pal::BLACK } else { pal::CHARCOAL });
            }
        }
        fb.blit(s, s.frame_at(tick, TICKS_PER_FRAME), sx, cell.y, false);
        fb.text_tiny(cell.x, cell.y + s.h as i32 + 1, &cell.name, pal::LGRAY);
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pages_cover_every_sprite_exactly_once() {
        let pages = layout();
        let mut names: Vec<&str> = pages.iter().flatten().map(|c| c.name.as_str()).collect();
        let n = names.len();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), n, "a sprite appears twice");
        assert_eq!(n, crate::art::registry().len(), "every registered sprite must be in the gallery");
        assert!(pages.iter().all(|p| !p.is_empty()), "no empty pages");
    }

    #[test]
    fn cells_stay_on_screen() {
        for page in layout() {
            for c in page {
                let s = crate::art::get(&c.name);
                assert!(c.x >= 0 && c.y >= TOP, "{} starts off the page", c.name);
                assert!(c.y + s.h as i32 + LABEL_H <= 240, "{} runs off the bottom", c.name);
                assert!(c.x + (s.w as i32) <= W as i32 || s.w as i32 > W as i32 - 2 * MARGIN, "{} runs off the right", c.name);
            }
        }
    }

    #[test]
    fn every_page_draws_and_animates() {
        let mut fb = Fb::new();
        let total = draw(&mut fb, 0, 0);
        assert!(total >= 1);
        for p in 0..total {
            for tick in [0, 8, 16, 1000] {
                assert_eq!(draw(&mut fb, p, tick), total);
            }
        }
        // out-of-range pages wrap instead of panicking
        assert_eq!(draw(&mut fb, total + 3, 0), total);
    }

    #[test]
    fn animation_changes_the_picture() {
        // the first page holds the agent walk cycle (4 frames): ticks 0 and 8 must differ somewhere
        let (mut a, mut b) = (Fb::new(), Fb::new());
        draw(&mut a, 0, 0);
        draw(&mut b, 0, TICKS_PER_FRAME);
        assert!(a.px != b.px);
    }
}
