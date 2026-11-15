//! `?gallery=1`: every sprite, animated, paged.
use super::{Renderer, SCREEN_W};
use crate::font::*;
use crate::pixel::{c, Canvas};

#[derive(Clone, Debug)]
pub struct GalleryItem {
    pub base: String,
    pub frames: usize,
    pub x: i32,
    pub y: i32,
}

impl Renderer {
    /// Group sprites into animations and lay them out on pages.
    pub fn gallery_pages(&self) -> Vec<Vec<GalleryItem>> {
        let names = self.sprites.names();
        let mut bases: Vec<(String, usize)> = vec![];
        for n in names {
            let base = match n.rsplit_once('_') {
                Some((b, tail)) if tail.chars().all(|c| c.is_ascii_digit()) && !tail.is_empty() => b.to_string(),
                _ => n.to_string(),
            };
            if bases.iter().any(|(b, _)| *b == base) {
                continue;
            }
            let frames = self.sprites.frames(&base);
            bases.push((base, frames));
        }
        let mut pages = vec![vec![]];
        let (mut x, mut y, mut row_h) = (4, 18, 0);
        for (base, frames) in bases {
            let s = self.sprites.anim(&base, 0);
            let cw = (s.w as i32).max(label_w(&base)) + 4;
            let ch = s.h as i32 + 10;
            if x + cw > SCREEN_W as i32 - 2 {
                x = 4;
                y += row_h + 2;
                row_h = 0;
            }
            if y + ch > 238 {
                pages.push(vec![]);
                x = 4;
                y = 18;
                row_h = 0;
            }
            pages.last_mut().unwrap().push(GalleryItem { base, frames, x, y });
            x += cw;
            row_h = row_h.max(ch);
        }
        pages
    }

    pub fn draw_gallery(&self, cv: &mut Canvas, t: i32, page: usize) {
        cv.reset_clip();
        cv.clear(c::GRAY_D);
        let pages = self.gallery_pages();
        let page = page % pages.len();
        draw_text(cv, 8, 5, &format!("GALLERY {}/{}  LEFT/RIGHT", page + 1, pages.len()), c::WHITE);
        for it in &pages[page] {
            let s = self.sprites.anim(&it.base, (t / 10) as usize);
            cv.rect(it.x - 1, it.y - 1, s.w as i32 + 2, s.h as i32 + 2, c::BLACK);
            cv.blit(s, it.x, it.y);
            let label: String = it.base.chars().take(((s.w as i32).max(20) / 4) as usize + 4).collect();
            draw_tiny(cv, it.x, it.y + s.h as i32 + 2, &label, c::YELLOW_L);
        }
    }
}

fn label_w(base: &str) -> i32 {
    tiny_width(&base.chars().take(14).collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_sprite_is_on_some_page() {
        let r = Renderer::new();
        let pages = r.gallery_pages();
        let total: usize = pages.iter().map(|p| p.len()).sum();
        assert!(total > 100);
        let mut cv = Canvas::new(256, 240);
        for p in 0..pages.len() {
            r.draw_gallery(&mut cv, 17, p);
        }
    }
}
