//! A tiny indexed canvas (0 = transparent, 1..=3 = colour slot) used to compose sprites in code.

use crate::pixel::Sprite;

#[derive(Clone)]
pub struct Cv {
    pub w: usize,
    pub h: usize,
    pub p: Vec<u8>,
}

impl Cv {
    pub fn new(w: usize, h: usize, c: u8) -> Cv {
        Cv { w, h, p: vec![c; w * h] }
    }
    pub fn blank(w: usize, h: usize) -> Cv {
        Cv::new(w, h, 0)
    }
    pub fn put(&mut self, x: i32, y: i32, c: u8) {
        if x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h {
            self.p[y as usize * self.w + x as usize] = c;
        }
    }
    pub fn get(&self, x: i32, y: i32) -> u8 {
        if x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h {
            self.p[y as usize * self.w + x as usize]
        } else {
            0
        }
    }
    pub fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        for yy in y..y + h {
            for xx in x..x + w {
                self.put(xx, yy, c);
            }
        }
    }
    pub fn frame(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        self.rect(x, y, w, 1, c);
        self.rect(x, y + h - 1, w, 1, c);
        self.rect(x, y, 1, h, c);
        self.rect(x + w - 1, y, 1, h, c);
    }
    pub fn dith(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8, phase: i32) {
        for yy in y..y + h {
            for xx in x..x + w {
                if (xx + yy + phase) & 1 == 0 {
                    self.put(xx, yy, c);
                }
            }
        }
    }
    /// Overlay ASCII art: `.`/space keeps what is there, `1`..`3` paint.
    pub fn art(&mut self, x: i32, y: i32, rows: &[&str]) {
        for (j, row) in rows.iter().enumerate() {
            for (i, ch) in row.chars().enumerate() {
                let c = match ch {
                    '1' => 1,
                    '2' => 2,
                    '3' => 3,
                    '0' => 0,
                    _ => continue,
                };
                self.put(x + i as i32, y + j as i32, c);
            }
        }
    }
    pub fn from_rows(rows: &[&str]) -> Cv {
        let mut c = Cv::blank(rows[0].chars().count(), rows.len());
        c.art(0, 0, rows);
        c
    }
    pub fn sprite(frames: &[&Cv], colors: [u8; 3]) -> Sprite {
        Sprite {
            w: frames[0].w,
            h: frames[0].h,
            frames: frames.iter().map(|c| c.p.clone()).collect(),
            colors,
        }
    }
}
