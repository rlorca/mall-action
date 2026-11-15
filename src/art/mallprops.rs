//! OWNER: mallprops art. Mall furniture, elevator parts, tiles, lamps, the getaway wagon...
//!
//! Every sprite is a char grid (see SpriteDef). Big ones are assembled with the tiny `Grid`
//! helper below (pure string/array work, deterministic, no DOM) and then handed to the
//! registry as plain rows, so the 3-colours-per-sprite rule is still enforced by parse_sprite.
//!
//! Colour scheme: 80s mall. Warm peach walls with blush grooves, teal terrazzo slabs with brass
//! trim, brass and cream elevators, neon pink and aqua accents. Wall/slab avoid colours that
//! `darken()` sends straight to black (hue nibble >= 0x0d) so lamp blackouts fade gracefully.

use super::registry::Def;
use crate::engine::num::round_i;
use crate::engine::palette::c;

struct Grid {
    cells: Vec<Vec<char>>,
    w: i32,
    h: i32,
}

impl Grid {
    fn new(w: i32, h: i32, fill: char) -> Grid {
        Grid { cells: vec![vec![fill; w as usize]; h as usize], w, h }
    }

    /// TS `px`: coordinates are rounded with Math.round (the fountain passes fractional ones).
    fn px<X: Into<f64>, Y: Into<f64>>(&mut self, x: X, y: Y, ch: char) -> &mut Self {
        let x = round_i(x.into());
        let y = round_i(y.into());
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.cells[y as usize][x as usize] = ch;
        }
        self
    }

    fn at(&self, x: i32, y: i32) -> char {
        if x < 0 || y < 0 || x >= self.w || y >= self.h {
            return '.';
        }
        self.cells[y as usize][x as usize]
    }

    fn rect(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) -> &mut Self {
        for yy in 0..h {
            for xx in 0..w {
                self.px(x + xx, y + yy, ch);
            }
        }
        self
    }

    /// 1 px border.
    fn r#box(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) -> &mut Self {
        self.hline(x, y, w, ch).hline(x, y + h - 1, w, ch).vline(x, y, h, ch).vline(x + w - 1, y, h, ch);
        self
    }

    fn hline(&mut self, x: i32, y: i32, w: i32, ch: char) -> &mut Self {
        self.rect(x, y, w, 1, ch)
    }

    fn vline(&mut self, x: i32, y: i32, h: i32, ch: char) -> &mut Self {
        self.rect(x, y, 1, h, ch)
    }

    /// Filled disc (centre may be fractional; pixel centres are at +0.5).
    fn disc(&mut self, cx: f64, cy: f64, r: f64, ch: char) -> &mut Self {
        for y in 0..self.h {
            for x in 0..self.w {
                let dx = x as f64 + 0.5 - cx;
                let dy = y as f64 + 0.5 - cy;
                if dx * dx + dy * dy <= r * r {
                    self.cells[y as usize][x as usize] = ch;
                }
            }
        }
        self
    }

    /// Overlay ASCII rows at (x, y). `.` leaves the cell alone, `_` writes a transparent cell.
    fn stamp(&mut self, x: i32, y: i32, rows: &[&str]) -> &mut Self {
        for (yy, row) in rows.iter().enumerate() {
            for (xx, ch) in row.chars().enumerate() {
                if ch == '.' {
                    continue;
                }
                self.px(x + xx as i32, y + yy as i32, if ch == '_' { '.' } else { ch });
            }
        }
        self
    }

    /// Every non-transparent cell touching transparency (4-neighbourhood) becomes `ch`.
    fn outline(&mut self, ch: char) -> &mut Self {
        let mut edge: Vec<(i32, i32)> = Vec::new();
        for y in 0..self.h {
            for x in 0..self.w {
                if self.at(x, y) == '.' {
                    continue;
                }
                if self.at(x - 1, y) == '.' || self.at(x + 1, y) == '.' || self.at(x, y - 1) == '.' || self.at(x, y + 1) == '.' {
                    edge.push((x, y));
                }
            }
        }
        for (x, y) in edge {
            self.cells[y as usize][x as usize] = ch;
        }
        self
    }

    fn rows(&self) -> Vec<String> {
        self.cells.iter().map(|r| r.iter().collect::<String>()).collect()
    }
}

/// 3x5 pixel capitals for the little neon signs.
fn glyph(letter: char) -> Option<[&'static str; 5]> {
    Some(match letter {
        'M' => ["X.X", "XXX", "XXX", "X.X", "X.X"],
        'A' => [".X.", "X.X", "XXX", "X.X", "X.X"],
        'L' => ["X..", "X..", "X..", "X..", "XXX"],
        'P' => ["XX.", "X.X", "XX.", "X..", "X.."],
        'H' => ["X.X", "X.X", "XXX", "X.X", "X.X"],
        'O' => ["XXX", "X.X", "X.X", "X.X", "XXX"],
        'T' => ["XXX", ".X.", ".X.", ".X.", ".X."],
        _ => return None,
    })
}

fn text3x5(g: &mut Grid, x: i32, y: i32, s: &str, ch: char) {
    let mut cx = x;
    for letter in s.chars() {
        let gl = glyph(letter).unwrap_or_else(|| panic!("mallprops: no glyph for {}", letter));
        for (yy, row) in gl.iter().enumerate() {
            let rb: Vec<char> = row.chars().collect();
            for xx in 0..3 {
                if rb[xx] == 'X' {
                    g.px(cx + xx as i32, y + yy as i32, ch);
                }
            }
        }
        cx += 4;
    }
}

// ------------------------------------------------------------------------------------------------
// Tiles: mall.wall, mall.slab, shaft.wall
// ------------------------------------------------------------------------------------------------

/// Corridor back wall: fluted peach panelling with a blush groove every 16 px and sparse terrazzo
/// flecks. Only vertical structure (so any y offset looks right) and the edge rows/columns are
/// identical in both variants, so mixing them never shows a seam.
fn wall_tile(variant: i32) -> Vec<String> {
    let mut g = Grid::new(16, 16, 'P');
    g.vline(0, 0, 16, 'B'); // groove
    let mut y = 0;
    while y < 16 {
        g.px(1, y, 'B'); // soft bevel
        y += 2;
    }
    if variant == 0 {
        for (x, y) in [(5, 2), (12, 5), (7, 9), (3, 12), (10, 13), (14, 8)] {
            g.px(x, y, 'B');
        }
        for (x, y) in [(9, 4), (4, 10)] {
            g.px(x, y, 'T');
        }
    } else {
        // a dashed groove down the middle (a slot per tile; it never touches the top/bottom rows), flecks elsewhere
        g.vline(8, 3, 10, 'B');
        for (x, y) in [(4, 6), (12, 12), (3, 2)] {
            g.px(x, y, 'B');
        }
        for (x, y) in [(13, 3), (5, 13)] {
            g.px(x, y, 'T');
        }
    }
    g.rows()
}

/// Floor slab seen from the side: brass walking edge, teal terrazzo body, dark underside.
fn slab_tile() -> Vec<String> {
    let mut g = Grid::new(16, 8, 'T');
    g.hline(0, 0, 16, 'A'); // walking surface
    g.hline(0, 1, 16, 'D');
    g.hline(0, 6, 16, 'D');
    g.hline(0, 7, 16, 'D');
    g.vline(0, 2, 4, 'D'); // tile joint
    for (x, y) in [(4, 3), (9, 2), (12, 4), (6, 5), (14, 3)] {
        g.px(x, y, 'A');
    }
    for (x, y) in [(2, 4), (7, 3), (10, 5), (13, 5)] {
        g.px(x, y, 'D');
    }
    g.rows()
}

fn shaft_wall() -> Vec<String> {
    let mut g = Grid::new(24, 16, 'K');
    // guide rails
    g.rect(1, 0, 2, 16, 'D');
    g.vline(1, 0, 16, 'G');
    g.rect(21, 0, 2, 16, 'D');
    g.vline(21, 0, 16, 'G');
    // cross braces every 16 px with rivets
    g.hline(3, 7, 18, 'D');
    g.px(4, 6, 'D');
    g.px(19, 6, 'D');
    // centre cable (drawn over the braces)
    g.vline(11, 0, 16, 'D');
    g.vline(12, 0, 16, 'D');
    g.px(3, 7, 'G');
    g.px(20, 7, 'G');
    g.rows()
}

fn grate() -> Vec<String> {
    let mut g = Grid::new(24, 4, 'L');
    for x in 0..24 {
        let bar = x % 3 == 0;
        g.px(x, 1, if bar { 'L' } else { 'K' });
        g.px(x, 2, if bar { 'G' } else { 'K' });
        g.px(x, 3, 'G');
    }
    g.px(0, 1, 'L').px(0, 2, 'G').px(23, 1, 'L').px(23, 2, 'G');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Elevator car
// ------------------------------------------------------------------------------------------------

fn car_base() -> Grid {
    let mut g = Grid::new(24, 32, 'K');
    g.rect(0, 0, 24, 2, 'A'); // brass roof (the agent can stand on it)
    g.hline(1, 0, 22, 'C');
    g.rect(1, 3, 2, 28, 'C'); // cream pillars with a brass inner edge
    g.rect(21, 3, 2, 28, 'C');
    g.vline(2, 3, 28, 'A');
    g.vline(21, 3, 28, 'A');
    // floor indicator: up arrow (lit), three lamps, down arrow
    g.stamp(5, 4, &[".A.", "AAA"]);
    g.stamp(16, 5, &["CCC", ".C."]);
    g.px(10, 5, 'A').px(12, 5, 'C').px(14, 5, 'C');
    // sill
    g.hline(1, 30, 22, 'A');
    g.hline(0, 31, 24, 'K');
    g
}

fn car_closed() -> Vec<String> {
    let mut g = car_base();
    // two brass doors with a black seam, each with a bevelled inset panel
    for x0 in [3, 13] {
        g.rect(x0, 8, 8, 22, 'A');
        g.hline(x0 + 1, 10, 6, 'C');
        g.vline(x0 + 1, 10, 14, 'C');
        g.hline(x0 + 1, 23, 6, 'K');
        g.vline(x0 + 6, 11, 13, 'K');
        g.hline(x0 + 1, 26, 6, 'C'); // kick plate
        g.hline(x0, 29, 8, 'K');
    }
    g.vline(11, 8, 21, 'K');
    g.vline(12, 8, 21, 'K');
    g.px(10, 17, 'C').px(13, 17, 'C').px(10, 18, 'C').px(13, 18, 'C'); // pull handles
    g.rows()
}

fn car_open() -> Vec<String> {
    let mut g = car_base();
    // doors slid into their pockets
    g.rect(3, 8, 3, 22, 'A');
    g.rect(18, 8, 3, 22, 'A');
    g.vline(4, 10, 14, 'C');
    g.vline(19, 10, 14, 'C');
    g.vline(6, 8, 22, 'K');
    g.vline(17, 8, 22, 'K');
    // lit empty interior: dark ceiling with a bright lamp band, cream back wall, brass wainscot
    g.rect(7, 8, 10, 22, 'C');
    g.hline(7, 8, 10, 'K');
    g.hline(7, 9, 10, 'A');
    g.hline(8, 10, 8, 'A');
    g.vline(11, 11, 8, 'A'); // mirror panel seams
    g.vline(12, 11, 8, 'A');
    g.hline(7, 18, 10, 'A'); // brass handrail
    g.hline(7, 19, 10, 'K');
    g.rect(7, 22, 10, 6, 'A');
    g.hline(7, 22, 10, 'K');
    let mut x = 8;
    while x < 17 {
        g.vline(x, 23, 4, 'C');
        x += 3;
    }
    g.hline(7, 28, 10, 'K'); // dark floor
    g.hline(7, 29, 10, 'A');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Escalator bits
// ------------------------------------------------------------------------------------------------

/// 8x4 tread. Groove comb marches one pixel per phase; yellow safety edge, black riser shadow.
fn esc_step(phase: i32) -> Vec<String> {
    let mut g = Grid::new(8, 4, 'L');
    for x in 0..8 {
        g.px(x, 0, if (x + phase) % 4 == 0 { 'K' } else { 'L' });
        g.px(x, 1, if (x + phase) % 4 == 1 { 'K' } else { 'L' });
        g.px(x, 2, 'Y');
        g.px(x, 3, 'K');
    }
    g.px(0, 3, 'K').px(7, 3, 'K');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Lamps and disco ball
// ------------------------------------------------------------------------------------------------

fn lines(rows: &[&str]) -> Vec<String> {
    rows.iter().map(|r| r.to_string()).collect()
}

fn lamp_lit() -> Vec<String> {
    lines(&[
        ".....KK.....",
        "...KKPPKK...",
        "..KPPPPPPK..",
        ".KPYPPPPPPK.",
        ".KPPPPPPPPK.",
        "KPPPPPPPPPPK",
        "KKKKKKKKKKKK",
        "..YYYYYYYY..",
        "...Y.YY.Y...",
        "....Y..Y....",
    ])
}

fn lamp_dark() -> Vec<String> {
    lines(&[
        ".....KK.....",
        "...KKPPKK...",
        "..KPPPPKPK..",
        ".KPPPPKPKPK.",
        ".KPPPKPKPKK.",
        "KPPPKPKPKKKK",
        "KKKKKKKKKKKK",
        ".....KK.....",
        "....KPPK....",
        ".....KK.....",
    ])
}

fn lamp_broken() -> Vec<String> {
    lines(&[
        "............",
        ".....Y...Y..",
        ".K.......K..",
        ".KPK..KK.KP.",
        ".KPPK.KPK.K.",
        ".KPPPKKPPK..",
        "KKPPPPPPPPKK",
        "KPKKPPKPPPPK",
        "KKPYKKKKPKKK",
        ".KKKKYKKKKK.",
    ])
}

/// Rotating mirror ball: a checkerboard of 30 degree mirror facets wrapped around a sphere. Four
/// frames turn it by two facets (60 degrees), which is the period of the checker, so it loops.
fn disco_ball(frame: i32) -> Vec<String> {
    let mut g = Grid::new(12, 12, '.');
    let r = 5.9_f64;
    let phase = (frame as f64 * std::f64::consts::PI) / 12.0;
    let facet = std::f64::consts::PI / 6.0;
    for y in 0..12 {
        for x in 0..12 {
            let nx = (x as f64 + 0.5 - 6.0) / r;
            let ny = (y as f64 + 0.5 - 6.0) / r;
            let d2 = nx * nx + ny * ny;
            if d2 > 1.0 {
                continue;
            }
            let lat = ny.asin();
            let lon = (nx / f64::max(1e-6, 1.0 - ny * ny).sqrt()).asin() + phase;
            let i = (lon / facet).floor() as i32;
            let j = (lat / facet).floor() as i32;
            let mut ch = if (i + j) & 1 != 0 { 'L' } else { 'G' };
            if d2 > 0.82 && ch == 'L' {
                ch = 'G'; // dark rim
            }
            g.px(x, y, ch);
        }
    }
    // glints that jump between frames
    let sparkles: [[(i32, i32); 5]; 4] = [
        [(3, 2), (4, 2), (3, 3), (8, 4), (5, 8)],
        [(3, 3), (4, 3), (3, 4), (7, 2), (8, 7)],
        [(4, 2), (5, 2), (4, 3), (9, 5), (3, 7)],
        [(3, 2), (3, 3), (2, 3), (6, 8), (8, 3)],
    ];
    for (x, y) in sparkles[frame as usize] {
        if g.at(x, y) != '.' {
            g.px(x, y, 'W');
        }
    }
    g.px(5, 0, 'G').px(6, 0, 'G');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Kiosk, photo booth
// ------------------------------------------------------------------------------------------------

fn kiosk(on: bool) -> Vec<String> {
    let mut g = Grid::new(24, 32, '.');
    g.rect(2, 0, 20, 28, 'T');
    g.r#box(2, 0, 20, 28, 'K');
    // header sign "MALL"
    g.rect(4, 2, 16, 7, 'K');
    text3x5(&mut g, 5, 3, "MALL", if on { 'Q' } else { 'T' });
    // screen bezel and screen
    g.rect(4, 11, 16, 14, 'K');
    if on {
        g.rect(5, 12, 14, 12, 'Q');
        // mini mall map: shop blocks either side of a corridor, one highlighted, plus a "you are here" dot
        g.rect(6, 13, 4, 3, 'K');
        g.rect(11, 13, 3, 3, 'T');
        g.rect(15, 13, 3, 3, 'K');
        g.rect(6, 20, 3, 3, 'K');
        g.rect(10, 20, 4, 3, 'K');
        g.rect(15, 20, 3, 3, 'K');
        g.rect(7, 17, 2, 2, 'T');
        for x in [10, 12, 14, 16] {
            g.px(x, 18, 'K');
        }
    } else {
        g.rect(5, 12, 14, 12, 'K');
        // dim reflection
        g.px(6, 13, 'T').px(7, 13, 'T').px(6, 14, 'T').px(8, 12, 'T').px(9, 12, 'T');
        g.px(16, 22, 'T').px(17, 22, 'T');
    }
    // keypad
    for i in 0..4 {
        g.rect(6 + i * 3, 26, 2, 1, 'K');
    }
    // plinth
    g.rect(0, 28, 24, 4, 'T');
    g.r#box(0, 28, 24, 4, 'K');
    g.hline(1, 29, 22, 'T');
    g.rows()
}

fn booth(closed: bool) -> Vec<String> {
    let mut g = Grid::new(24, 32, '.');
    g.rect(0, 0, 24, 32, 'T');
    g.r#box(0, 0, 24, 32, 'K');
    // neon sign
    g.rect(1, 1, 22, 8, 'K');
    g.r#box(1, 1, 22, 8, 'P');
    text3x5(&mut g, 3, 3, "PHOTO", 'P');
    g.hline(0, 9, 24, 'K');
    // marquee bulbs on the pillars
    let mut y = 12;
    while y < 30 {
        g.px(1, y, 'P');
        g.px(22, y, 'P');
        y += 4;
    }
    // opening
    g.rect(4, 11, 16, 19, 'K');
    g.hline(3, 10, 18, 'P'); // curtain rod
    if !closed {
        // curtain bundled to the left, stool inside
        for y in 11..29 {
            g.px(4, y, 'P');
            g.px(5, y, if y % 2 == 0 { 'P' } else { 'K' });
            g.px(6, y, 'P');
        }
        g.px(7, 11, 'P');
        g.rect(10, 20, 8, 2, 'T');
        g.vline(11, 22, 7, 'T');
        g.vline(16, 22, 7, 'T');
        g.hline(8, 29, 12, 'T');
    } else {
        // curtain drawn, hem a little above the floor so the feet show
        g.rect(4, 11, 16, 15, 'P');
        let mut x = 5;
        while x < 20 {
            g.vline(x, 11, 15, 'K');
            x += 3;
        }
        let mut x = 4;
        while x < 20 {
            g.px(x, 25, 'K');
            x += 3;
        }
        g.rect(4, 26, 16, 4, 'T');
        // two feet in black shoes
        g.rect(8, 26, 2, 2, 'K').rect(14, 26, 2, 2, 'K');
        g.rect(7, 28, 4, 2, 'K').rect(13, 28, 4, 2, 'K');
    }
    g.hline(2, 30, 20, 'K');
    g.hline(0, 31, 24, 'K');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Fountain
// ------------------------------------------------------------------------------------------------

fn fountain(frame: i32) -> Vec<String> {
    let mut g = Grid::new(40, 24, '.');
    // tiled basin wall
    g.rect(3, 19, 34, 4, 'C');
    g.hline(3, 19, 34, 'K');
    let mut x = 3;
    while x < 37 {
        g.vline(x, 19, 4, 'K');
        x += 4;
    }
    g.hline(2, 23, 36, 'K');
    g.px(2, 22, 'K').px(37, 22, 'K');
    // rim
    g.rect(1, 15, 38, 4, 'W');
    g.hline(1, 15, 38, 'K');
    g.hline(1, 18, 38, 'K');
    g.px(1, 16, 'K').px(1, 17, 'K').px(38, 16, 'K').px(38, 17, 'K');
    // water surface behind the rim (ellipse)
    let spans: [(i32, i32); 4] = [(9, 30), (6, 33), (4, 35), (3, 36)];
    for (i, (x0, x1)) in spans.iter().enumerate() {
        let (x0, x1) = (*x0, *x1);
        let y = 11 + i as i32;
        g.hline(x0, y, x1 - x0 + 1, 'C');
        g.px(x0 - 1, y, 'K').px(x1 + 1, y, 'K');
    }
    g.hline(9, 10, 22, 'K');
    // ripples
    for k in 0..4 {
        g.px(4 + ((frame * 3 + k * 9) % 32), 13, 'W');
        g.px(6 + ((frame * 2 + k * 8 + 5) % 28), 12, 'W');
    }
    // pedestal and bowl
    g.rect(18, 9, 4, 6, 'W');
    g.vline(17, 9, 6, 'K');
    g.vline(22, 9, 6, 'K');
    g.hline(14, 6, 12, 'K');
    g.rect(15, 7, 10, 2, 'W');
    g.px(14, 7, 'K').px(25, 7, 'K').px(14, 8, 'K').px(25, 8, 'K');
    g.hline(15, 9, 10, 'K');
    // jet
    let top = 3 - (frame % 2);
    g.rect(19, top, 2, 6 - top + 0, 'C');
    g.vline(19, top, 6 - top, 'W');
    g.px(18, top - 1, 'C').px(21, top - 1, 'C').px(19, top - 1, 'C').px(20, top - 1, 'C');
    // arching droplets
    let n = 5;
    for k in 0..n {
        let t = (k as f64 + frame as f64 / 4.0) / n as f64;
        let dx = 13.0 * t;
        let dy = -6.0 * t + 15.0 * t * t;
        let y = 3.0 + dy;
        if y > 13.0 {
            continue;
        }
        g.px(19.5 - dx, y, if k % 2 == 0 { 'C' } else { 'W' });
        g.px(20.5 + dx, y, if k % 2 == 0 { 'W' } else { 'C' });
    }
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Bench, plant, pillar
// ------------------------------------------------------------------------------------------------

fn bench() -> Vec<String> {
    let mut g = Grid::new(24, 12, '.');
    // backrest slats
    g.rect(1, 0, 22, 2, 'A');
    g.rect(1, 3, 22, 2, 'A');
    g.hline(1, 2, 22, 'K');
    g.hline(1, 5, 22, 'O');
    g.hline(1, 1, 22, 'A');
    g.vline(1, 0, 5, 'K');
    g.vline(22, 0, 5, 'K');
    // seat
    g.rect(0, 6, 24, 2, 'A');
    g.hline(0, 8, 24, 'O');
    g.hline(0, 9, 24, 'K');
    g.hline(0, 6, 24, 'A');
    g.px(0, 6, 'K').px(23, 6, 'K');
    // legs
    g.rect(2, 10, 3, 2, 'K');
    g.rect(19, 10, 3, 2, 'K');
    g.vline(3, 9, 3, 'K');
    g.vline(20, 9, 3, 'K');
    g.px(12, 10, 'K');
    g.rows()
}

fn plant() -> Vec<String> {
    lines(&[
        ".....GG.........",
        "....GLLG...GG...",
        ".GG.GLLG..GLLG..",
        "GLLGGLLG.GLLLG..",
        "GLLLGLLGGLLLG.GG",
        ".GLLLGLLLLLGGGLG",
        "..GLLLGLLLGLLLLG",
        "GG.GLLLGLLGLLLG.",
        "GLGGGLLLGLGLLG..",
        ".GLLGGLLLGGLG.GG",
        "..GLLLGGLLGG.GLG",
        "...GGLLLGLGGGLG.",
        ".....GGLGGLGG...",
        "......GGLGG.....",
        ".......GLG......",
        ".......GLG......",
        "..OOOOOOOOOOOO..",
        "..OOOOOOOOOOOO..",
        "...GGGGGGGGGG...",
        "...OOOOOOOOOO...",
        "...OOOOOOOOOO...",
        "....OOOOOOOO....",
        "....OOOOOOOO....",
        "....GGGGGGGG....",
    ])
}

fn pillar() -> Vec<String> {
    let mut g = Grid::new(16, 48, 'L');
    g.vline(0, 0, 48, 'K');
    g.vline(15, 0, 48, 'K');
    // shaded right edge
    for y in 0..48 {
        g.px(14, y, if y % 2 == 0 { 'K' } else { 'L' });
        g.px(13, y, if y % 4 == 0 { 'K' } else { 'L' });
    }
    // formwork joints and pores
    g.hline(0, 0, 16, 'K');
    g.hline(1, 6, 13, 'K');
    g.hline(1, 21, 13, 'K');
    for (x, y) in [(4, 3), (9, 10), (3, 14), (11, 17), (6, 26), (2, 30), (10, 33), (5, 11), (12, 25), (8, 29)] {
        g.px(x, y, 'K');
    }
    // hazard stripes at the base (and a thin band near the top)
    let stripe = |g: &mut Grid, y0: i32, h: i32| {
        for y in y0..y0 + h {
            for x in 1..15 {
                g.px(x, y, if (x + y) % 8 < 4 { 'Y' } else { 'K' });
            }
        }
        g.hline(0, y0 - 1, 16, 'K');
        g.hline(0, y0 + h, 16, 'K');
    };
    stripe(&mut g, 36, 9);
    g.hline(0, 46, 16, 'K');
    g.hline(0, 47, 16, 'K');
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Station wagon
// ------------------------------------------------------------------------------------------------

fn wagon(lights_on: bool) -> Vec<String> {
    let mut g = Grid::new(72, 28, '.');
    const OX: i32 = -2; // body sits 2 px left of the sprite origin, leaving room for the headlight beams
    macro_rules! R {
        ($x:expr, $y:expr, $w:expr, $h:expr, $ch:expr) => {
            g.rect($x + OX, $y, $w, $h, $ch)
        };
    }
    macro_rules! H {
        ($x:expr, $y:expr, $w:expr, $ch:expr) => {
            g.hline($x + OX, $y, $w, $ch)
        };
    }
    macro_rules! V {
        ($x:expr, $y:expr, $h:expr, $ch:expr) => {
            g.vline($x + OX, $y, $h, $ch)
        };
    }
    macro_rules! P {
        ($x:expr, $y:expr, $ch:expr) => {
            g.px($x + OX, $y, $ch)
        };
    }

    // silhouette: rake of the rear pillar and windshield, then the hood and nose
    let cabin: [(i32, i32, i32); 9] = [(4, 8, 45), (5, 6, 47), (6, 5, 48), (7, 4, 50), (8, 3, 51), (9, 3, 53), (10, 3, 54), (11, 3, 56), (12, 3, 57)];
    for (y, x0, x1) in cabin {
        H!(x0, y, x1 - x0 + 1, 'C');
    }
    H!(3, 13, 57, 'C');
    H!(3, 14, 61, 'C');
    R!(3, 15, 64, 10, 'C');
    g.outline('K');

    // side windows (black glass) with raked front edge
    R!(8, 6, 8, 5, 'K');
    R!(18, 6, 15, 5, 'K');
    let front: [(i32, i32); 5] = [(6, 45), (7, 47), (8, 48), (9, 50), (10, 51)];
    for (y, x1) in front {
        H!(35, y, x1 - 35 + 1, 'K');
    }
    for (x, y) in [(10, 7), (11, 7), (21, 7), (22, 7), (23, 7), (38, 7), (39, 7)] {
        P!(x, y, 'C'); // glints
    }
    // belt line and the fake wood panelling with its trim
    H!(4, 12, 53, 'K');
    R!(6, 13, 50, 7, 'B');
    H!(5, 13, 52, 'K');
    H!(5, 20, 52, 'K');
    V!(5, 13, 8, 'K');
    V!(56, 13, 8, 'K');
    for x in [18, 31, 44] {
        V!(x, 13, 8, 'K'); // door seams
    }
    let mut x = 7;
    while x < 56 {
        P!(x, 15, 'K');
        P!(x + 1, 15, 'K');
        P!(x + 2, 18, 'K');
        P!(x + 3, 18, 'K');
        x += 5;
    }
    for x in [20, 33, 46] {
        H!(x, 16, 2, 'C'); // door handles
    }
    // headlight plate, grille, bumpers
    R!(60, 15, 4, 4, 'K');
    R!(61, 16, 2, 2, if lights_on { 'C' } else { 'K' });
    H!(60, 20, 6, 'K');
    R!(60, 21, 9, 4, 'C');
    g.r#box(60 + OX, 21, 9, 4, 'K');
    H!(61, 22, 6, 'K');
    R!(2, 21, 5, 4, 'C');
    g.r#box(2 + OX, 21, 5, 4, 'K');
    H!(3, 22, 2, 'K');
    P!(4, 15, 'K');
    P!(4, 16, 'K');
    // roof rack with strapped luggage
    H!(10, 3, 35, 'K');
    V!(10, 3, 2, 'K');
    V!(44, 3, 2, 'K');
    R!(17, 0, 17, 3, 'K');
    R!(18, 1, 15, 2, 'B');
    V!(22, 1, 2, 'C');
    V!(28, 1, 2, 'C');
    if lights_on {
        for (x, y) in [(64, 14), (66, 13), (68, 12), (64, 16), (65, 16), (66, 16), (67, 16), (68, 16), (69, 16), (70, 16), (64, 18), (66, 19), (68, 20)] {
            g.px(x, y, 'C');
        }
    }
    // wheels: arch, tyre, whitewall and hubcap
    for cx in [14.5_f64, 50.5] {
        g.disc(cx, 21.5, 6.6, 'K');
        g.disc(cx, 22.5, 5.5, 'K');
        for y in 0..28 {
            for x in 0..72 {
                let dx = x as f64 + 0.5 - cx;
                let dy = y as f64 + 0.5 - 22.5;
                let d = (dx * dx + dy * dy).sqrt();
                if d <= 1.2 {
                    g.px(x, y, 'K');
                } else if d <= 2.6 {
                    g.px(x, y, 'C');
                } else if d <= 3.6 {
                    g.px(x, y, 'K');
                } else if d <= 4.6 {
                    g.px(x, y, 'C');
                }
            }
        }
    }
    g.rows()
}

// ------------------------------------------------------------------------------------------------
// Roof props
// ------------------------------------------------------------------------------------------------

/// Zip-line anchor post: the cable clips to the eyebolt, which sits at sprite (4, 2) = ARRIVAL.postX / postTopY.
fn post() -> Vec<String> {
    lines(&[
        "........",
        "...KKK..",
        "...K.K..",
        "..KKKKK.",
        "..KLLLK.",
        "..KLLLK.",
        "..KYYYK.",
        "..KKKKK.",
        "..KLLLK.",
        "..KLLLK.",
        "..KYYYK.",
        "..KKKKK.",
        "..KLLLK.",
        ".KKLLLKK",
        "KLLLLLLK",
        "KKKKKKKK",
    ])
}

fn ac() -> Vec<String> {
    let mut g = Grid::new(24, 16, '.');
    // vent stack
    g.rect(3, 0, 5, 4, 'L');
    g.r#box(3, 0, 5, 4, 'K');
    g.hline(2, 0, 7, 'K');
    // cabinet
    g.rect(1, 4, 22, 9, 'L');
    g.r#box(1, 4, 22, 9, 'K');
    g.hline(2, 5, 20, 'G');
    // louvres
    let mut y = 6;
    while y <= 11 {
        g.hline(3, y, 9, 'K');
        y += 2;
    }
    // fan grille
    g.disc(17.0, 8.5, 3.8, 'K');
    g.disc(17.0, 8.5, 2.8, 'G');
    g.px(17, 6, 'L').px(17, 7, 'L').px(17, 9, 'L').px(17, 10, 'L').px(15, 8, 'L').px(16, 8, 'L').px(18, 8, 'L').px(19, 8, 'L');
    g.px(17, 8, 'K');
    g.vline(13, 5, 7, 'K');
    g.px(2, 6, 'G').px(2, 7, 'G');
    // feet
    g.rect(2, 13, 4, 3, 'K');
    g.rect(18, 13, 4, 3, 'K');
    g.hline(6, 14, 12, 'G');
    g.rows()
}

fn pigeon(peck: bool) -> Vec<String> {
    if !peck {
        return lines(&["........", ".....LL.", "....LKLO", "K..LLLL.", "KKLLLLL.", ".KKKKLL.", "..LLLL..", "...O.O.."]);
    }
    lines(&["........", "........", "........", "K..LLL..", "KKLLLLL.", ".KKKKLLL", "..LLLLKO", "...O.O.O"])
}

// ------------------------------------------------------------------------------------------------
// Registry
// ------------------------------------------------------------------------------------------------

pub fn defs() -> Vec<Def> {
    let p_wall = [('P', c::PEACH), ('B', c::BLUSH), ('T', c::TEAL)];
    let esc: Vec<Vec<String>> = [0, 1, 2, 3].iter().map(|&p| esc_step(p)).collect();
    let disco: Vec<Vec<String>> = [0, 1, 2, 3].iter().map(|&f| disco_ball(f)).collect();
    let fount: Vec<Vec<String>> = [0, 1, 2, 3].iter().map(|&f| fountain(f)).collect();
    vec![
        Def::frames("mall.wall", 16, 16, &p_wall, vec![wall_tile(0), wall_tile(1)]),
        Def::rows("mall.slab", 16, 8, &[('A', c::AMBER), ('T', c::TEAL), ('D', c::DKTEAL)], slab_tile()),
        Def::rows("shaft.wall", 24, 16, &[('K', c::BLACK), ('D', c::DKTEAL), ('G', c::GRAY)], shaft_wall()),
        Def::rows("grate", 24, 4, &[('L', c::LTGRAY), ('G', c::GRAY), ('K', c::BLACK)], grate()),
        Def::rows("car.closed", 24, 32, &[('K', c::BLACK), ('A', c::AMBER), ('C', c::CREAM)], car_closed()),
        Def::rows("car.open", 24, 32, &[('K', c::BLACK), ('A', c::AMBER), ('C', c::CREAM)], car_open()),
        Def::frames("esc.step", 8, 4, &[('L', c::LTGRAY), ('K', c::BLACK), ('Y', c::YELLOW)], esc),
        Def::rows("esc.rail", 4, 4, &[('K', c::BLACK), ('G', c::GRAY), ('L', c::LTGRAY)], lines(&["KKKK", "KLGK", "KGGK", "KKKK"])),
        Def::frames("lamp.shade", 12, 10, &[('K', c::BLACK), ('P', c::PINK), ('Y', c::PALEYELLOW)], vec![lamp_lit(), lamp_dark()]),
        Def::rows("lamp.broken", 12, 10, &[('K', c::BLACK), ('P', c::PINK), ('Y', c::PALEYELLOW)], lamp_broken()),
        Def::frames("disco.ball", 12, 12, &[('L', c::LTGRAY), ('G', c::GRAY), ('W', c::WHITE)], disco),
        Def::frames("kiosk", 24, 32, &[('K', c::BLACK), ('T', c::TEAL), ('Q', c::CYAN)], vec![kiosk(false), kiosk(true)]),
        Def::frames("booth", 24, 32, &[('K', c::BLACK), ('T', c::TEAL), ('P', c::PINK)], vec![booth(false), booth(true)]),
        Def::frames("fountain", 40, 24, &[('K', c::BLACK), ('W', c::WHITE), ('C', c::CYAN)], fount),
        Def::rows("bench", 24, 12, &[('K', c::BLACK), ('A', c::AMBER), ('O', c::OCHRE)], bench()),
        Def::rows("plant", 16, 24, &[('G', c::DKGREEN), ('L', c::LTGREEN), ('O', c::ORANGE)], plant()),
        Def::rows("pillar", 16, 48, &[('K', c::BLACK), ('L', c::LTGRAY), ('Y', c::YELLOW)], pillar()),
        Def::frames("wagon", 72, 28, &[('K', c::BLACK), ('B', c::OCHRE), ('C', c::CREAM)], vec![wagon(false), wagon(true)]),
        Def::rows("post", 8, 16, &[('K', c::BLACK), ('L', c::LTGRAY), ('Y', c::YELLOW)], post()),
        Def::rows("ac", 24, 16, &[('K', c::BLACK), ('L', c::LTGRAY), ('G', c::GRAY)], ac()),
        Def::frames("pigeon", 8, 8, &[('K', c::BLACK), ('L', c::LTGRAY), ('O', c::ORANGE)], vec![pigeon(false), pigeon(true)]),
    ]
}

#[cfg(test)]
mod tests {
    use crate::art::manifest::{required_sprites, Owner};
    use crate::art::registry::get_sprite;
    use crate::engine::palette::{c, TRANSPARENT};
    use crate::engine::sprite::{sprite_pixel, Sprite};

    fn frame_data(s: &Sprite, f: usize) -> &[u8] {
        &s.frames[f]
    }
    fn frame_key(s: &Sprite, f: usize) -> Vec<u8> {
        s.frames[f].clone()
    }
    fn opaque_count(s: &Sprite, f: usize) -> usize {
        frame_data(s, f).iter().filter(|&&v| v != TRANSPARENT).count()
    }
    fn column(s: &Sprite, f: i32, x: i32) -> Vec<u8> {
        (0..s.h).map(|y| sprite_pixel(s, x, y, f)).collect()
    }
    fn row(s: &Sprite, f: i32, y: i32) -> Vec<u8> {
        (0..s.w).map(|x| sprite_pixel(s, x, y, f)).collect()
    }
    fn count_color(s: &Sprite, f: usize, col: u8) -> usize {
        frame_data(s, f).iter().filter(|&&v| v == col).count()
    }
    fn expect_frames_pairwise_differ(name: &str) {
        let s = get_sprite(name);
        let keys: Vec<Vec<u8>> = (0..s.frames.len()).map(|f| frame_key(s, f)).collect();
        let mut u = keys.clone();
        u.sort();
        u.dedup();
        assert_eq!(u.len(), s.frames.len(), "{} frames must all differ", name);
    }

    #[test]
    fn defines_every_mallprops_manifest_entry_at_its_exact_size_with_enough_frames() {
        let mine: Vec<_> = required_sprites().iter().filter(|r| r.owner == Owner::Mallprops).collect();
        assert!(mine.len() > 20);
        for r in mine {
            let s = get_sprite(&r.name);
            assert_eq!((s.w, s.h), (r.w, r.h), "{}", r.name);
            assert!(s.frame_count() >= r.frames, "{}", r.name);
            assert!(s.colors.len() <= 3, "{}", r.name);
        }
    }

    // ---- tiles
    #[test]
    fn tiles_mall_wall_mall_slab_and_shaft_wall_are_fully_opaque_no_holes_when_tiled() {
        for (name, frames) in [("mall.wall", 2), ("mall.slab", 1), ("shaft.wall", 1)] {
            let s = get_sprite(name);
            for f in 0..frames {
                assert_eq!(opaque_count(s, f), (s.w * s.h) as usize, "{} frame {}", name, f);
            }
        }
    }

    #[test]
    fn tiles_mall_wall_variants_share_their_edge_rows_and_columns_so_any_mix_of_them_tiles_without_a_seam() {
        let w = get_sprite("mall.wall");
        assert!(w.frame_count() >= 2);
        assert_eq!(column(w, 0, 0), column(w, 1, 0));
        assert_eq!(column(w, 0, 15), column(w, 1, 15));
        assert_eq!(row(w, 0, 0), row(w, 1, 0));
        assert_eq!(row(w, 0, 15), row(w, 1, 15));
        assert_ne!(frame_key(w, 0), frame_key(w, 1));
    }

    #[test]
    fn tiles_mall_wall_is_vertically_periodic_in_its_structure_first_and_last_row_use_only_the_plain_colours() {
        let w = get_sprite("mall.wall");
        for f in 0..2 {
            // no accent flecks on the top/bottom rows (they would double up where tiles meet)
            for y in [0, 15] {
                for v in row(w, f, y) {
                    assert_ne!(v, c::TEAL);
                }
            }
        }
    }

    #[test]
    fn tiles_mall_slab_the_top_row_is_one_continuous_walking_surface_colour_and_wraps_without_a_step() {
        let s = get_sprite("mall.slab");
        let top = row(s, 0, 0);
        assert_eq!(top.iter().collect::<std::collections::HashSet<_>>().len(), 1);
        // underside row is dark and continuous too
        assert_eq!(row(s, 0, 7).iter().collect::<std::collections::HashSet<_>>().len(), 1);
        assert_ne!(top[0], row(s, 0, 7)[0]);
    }

    #[test]
    fn tiles_wall_and_slab_colours_fade_gracefully_with_darken_no_hue_nibble_ge_0x0d() {
        for name in ["mall.wall", "mall.slab"] {
            for &col in &get_sprite(name).colors {
                assert!((col & 0x0f) < 0x0d, "{} colour {:x}", name, col);
            }
        }
    }

    #[test]
    fn tiles_shaft_wall_is_dark_mostly_black_so_the_lit_car_pops() {
        let s = get_sprite("shaft.wall");
        let dark = count_color(s, 0, c::BLACK);
        assert!(dark as f64 / (s.w * s.h) as f64 > 0.5);
    }

    #[test]
    fn tiles_esc_step_phases_all_differ_stay_opaque_and_keep_the_same_silhouette() {
        let s = get_sprite("esc.step");
        assert_eq!(s.frames.len(), 4);
        expect_frames_pairwise_differ("esc.step");
        for f in 0..4 {
            assert_eq!(opaque_count(s, f), (s.w * s.h) as usize);
        }
    }

    // ---- elevator
    #[test]
    fn elevator_car_open_differs_from_car_closed_and_shows_a_bright_readable_interior() {
        let closed = get_sprite("car.closed");
        let open = get_sprite("car.open");
        assert_ne!(frame_key(open, 0), frame_key(closed, 0));
        // interior behind the agent (x 7..16, y 10..21) is mostly the lit cream wall
        let (mut cream, mut total) = (0, 0);
        for y in 10..22 {
            for x in 7..17 {
                total += 1;
                if sprite_pixel(open, x, y, 0) == c::CREAM {
                    cream += 1;
                }
            }
        }
        assert!(cream as f64 / total as f64 > 0.6);
        // closed car: no cream-dominated interior (it is brass doors)
        let mut amber = 0;
        for y in 10..26 {
            for x in 3..21 {
                if sprite_pixel(closed, x, y, 0) == c::AMBER {
                    amber += 1;
                }
            }
        }
        assert!(amber > 80);
    }

    #[test]
    fn elevator_both_cars_are_solid_slabs_on_top_standable_roof_and_end_in_a_floor_line() {
        for name in ["car.closed", "car.open"] {
            let s = get_sprite(name);
            assert!(row(s, 0, 0).iter().all(|&v| v != TRANSPARENT), "{} roof row", name);
            assert!(row(s, 0, s.h - 1).iter().all(|&v| v != TRANSPARENT), "{} floor row", name);
            assert_eq!(opaque_count(s, 0), (s.w * s.h) as usize);
        }
    }

    #[test]
    fn elevator_grate_is_a_solid_bar_the_agent_can_stand_on() {
        let g = get_sprite("grate");
        assert!(row(g, 0, 0).iter().all(|&v| v != TRANSPARENT));
    }

    // ---- animated props
    #[test]
    fn animated_fountain_has_4_frames_that_pairwise_differ_and_keep_their_silhouette_base() {
        let f = get_sprite("fountain");
        assert_eq!(f.frames.len(), 4);
        expect_frames_pairwise_differ("fountain");
        // the basin (bottom rows) is identical in every frame; only water and spray move
        for fr in 1..4 {
            for y in 15..24 {
                assert_eq!(row(f, fr, y), row(f, 0, y));
            }
        }
    }

    #[test]
    fn animated_disco_ball_is_round_rotates_4_distinct_frames_and_sparkles() {
        let b = get_sprite("disco.ball");
        assert_eq!(b.frames.len(), 4);
        expect_frames_pairwise_differ("disco.ball");
        for f in 0..4 {
            assert_eq!(sprite_pixel(b, 0, 0, f), TRANSPARENT);
            assert_eq!(sprite_pixel(b, 11, 11, f), TRANSPARENT);
            assert_ne!(sprite_pixel(b, 6, 6, f), TRANSPARENT);
            assert!(count_color(b, f as usize, c::WHITE) >= 3, "sparkles in frame {}", f);
        }
    }

    #[test]
    fn animated_frame_1_of_kiosk_booth_wagon_and_lamp_shade_differs_from_frame_0() {
        for name in ["kiosk", "booth", "wagon", "lamp.shade", "pigeon", "mall.wall"] {
            let s = get_sprite(name);
            assert!(s.frames.len() >= 2, "{}", name);
            assert_ne!(frame_key(s, 1), frame_key(s, 0), "{}", name);
        }
    }

    #[test]
    fn animated_kiosk_screen_glows_in_frame_1_only() {
        let k = get_sprite("kiosk");
        let glow = |f: usize| count_color(k, f, c::CYAN);
        assert!(glow(1) > glow(0) + 40);
    }

    #[test]
    fn animated_booth_frame_1_draws_the_curtain_and_shows_feet_under_it() {
        let b = get_sprite("booth");
        let pink = |f: usize| count_color(b, f, c::PINK);
        assert!(pink(1) > pink(0));
        // under the hem: black shoes against teal wall
        let mut under: Vec<u8> = Vec::new();
        for y in 26..30 {
            for x in 5..19 {
                under.push(sprite_pixel(b, x, y, 1));
            }
        }
        assert!(under.contains(&c::BLACK));
        assert!(under.contains(&c::TEAL));
    }

    #[test]
    fn animated_lamp_shade_frame_0_is_lit_pale_yellow_glow_frame_1_is_dark() {
        let l = get_sprite("lamp.shade");
        let glow = |f: usize| count_color(l, f, c::PALEYELLOW);
        assert!(glow(0) > 8);
        assert_eq!(glow(1), 0);
    }

    #[test]
    fn animated_wagon_frame_1_adds_headlight_beams_to_the_right_of_the_body() {
        let w = get_sprite("wagon");
        let right_edge = |f: i32| {
            let mut n = 0;
            for y in 0..w.h {
                for x in 67..w.w {
                    if sprite_pixel(w, x, y, f) != TRANSPARENT {
                        n += 1;
                    }
                }
            }
            n
        };
        assert!(right_edge(1) > right_edge(0));
        assert!(opaque_count(w, 1) > opaque_count(w, 0));
    }

    // ---- roof and parking props
    #[test]
    fn roof_pillar_has_hazard_stripes_yellow_near_its_base_and_plain_concrete_above() {
        let p = get_sprite("pillar");
        let mut yellow_rows: Vec<i32> = Vec::new();
        for y in 0..p.h {
            for x in 0..p.w {
                if sprite_pixel(p, x, y, 0) == c::YELLOW && !yellow_rows.contains(&y) {
                    yellow_rows.push(y);
                }
            }
        }
        assert!(*yellow_rows.iter().min().unwrap() >= 30);
        assert!(yellow_rows.len() >= 8);
    }

    #[test]
    fn roof_plant_is_green_on_top_of_an_orange_pot() {
        let p = get_sprite("plant");
        assert!(p.colors.contains(&c::ORANGE));
        assert!(p.colors.contains(&c::LTGREEN));
    }

    #[test]
    fn roof_post_carries_its_cable_eyebolt_at_sprite_4_2_like_arrival_post_x_post_top_y_expect() {
        let p = get_sprite("post");
        // ring around an empty hole: black above, left and right of (4, 2) but nothing at the hole itself
        assert_eq!(sprite_pixel(p, 4, 1, 0), c::BLACK);
        assert_eq!(sprite_pixel(p, 3, 2, 0), c::BLACK);
        assert_eq!(sprite_pixel(p, 5, 2, 0), c::BLACK);
        assert_eq!(sprite_pixel(p, 4, 2, 0), TRANSPARENT);
    }
}
