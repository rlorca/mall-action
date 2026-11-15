//! Hand-designed top-down store layouts. 16x11 tiles of 16 px. The room system supports any size
//! (see `Layout::w/h` and the camera in `store.rs`); today every room is one screen.
//!
//! Legend: `#` wall, `.` floor, `a`/`b` searchable fixtures, `c` counter, `d`/`e` decor,
//! `F` fitting room (searchable), `T` toy shelf (searchable), `L` listening booth (walkable),
//! `g` spy spawn, `r` security-bot spawn, `k` clerk (solid), `p` pedestal (walkable), `D` door.
use crate::stores::StoreId;

pub const TILE: i32 = 16;
/// Player start tile (just inside the door).
pub const START: (i32, i32) = (8, 9);

#[derive(Clone, Debug)]
pub struct Layout {
    pub w: i32,
    pub h: i32,
    pub tiles: Vec<Vec<u8>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FixtureDef {
    pub tx: i32,
    pub ty: i32,
    pub kind: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GuardKind {
    Spy,
    Bot,
}

fn rows(id: StoreId) -> Option<[&'static str; 9]> {
    use StoreId::*;
    // Each string is the 14 interior columns of rows 1..=9.
    Some(match id {
        Forever12 => [
            "F.F.......F.F.",
            "..............",
            "..d.b....b.d..",
            "..............",
            ".ccc......ccc.",
            "..............",
            ".a..g....g..a.",
            "..............",
            ".d..........d.",
        ],
        RadioShock => [
            "a.a.a.....a.a.",
            "..............",
            ".cccc....cccc.",
            "..............",
            "..b..r....b...",
            "..............",
            ".d..g.....b.d.",
            "..............",
            "..............",
        ],
        Crookstone => [
            "a..a..a..a..a.",
            "..............",
            "..cc......cc..",
            "..............",
            ".b...dd...b...",
            "..............",
            ".g..........g.",
            "..d........d..",
            "..............",
        ],
        GameStonk => [
            "a.a.a.a..a.a.a",
            "..d....k...d..",
            "..............",
            ".......p......",
            ".b..........b.",
            "..............",
            ".cc........cc.",
            "......g.......",
            "..............",
        ],
        KgbToys => [
            "T..T..T..T..T.",
            "..............",
            ".a....g.....a.",
            "..............",
            "..ccc....ccc..",
            "..............",
            ".b....g....b..",
            "..............",
            ".d..........d.",
        ],
        SpendersGifts => [
            "a.a....bb....a",
            "..............",
            ".d..cccccc..d.",
            "..............",
            "..a........a..",
            "......g.......",
            ".b..........b.",
            "..............",
            "..............",
        ],
        SamBaddy => [
            "a.a.a.....b.b.",
            "..............",
            ".d..........d.",
            "..cc..LL..cc..",
            "..............",
            ".a....g.....a.",
            "..............",
            ".b..........b.",
            "..............",
        ],
        SharperImagine => [
            ".a.a.a....b.b.",
            "..............",
            "..d..cccc..d..",
            "..............",
            ".b.....r....b.",
            "..............",
            ".a..........a.",
            "..............",
            "..............",
        ],
        HotSpyOnAStick => [
            "a.b.a.b.a.b.a.",
            "..............",
            ".cccccccccccc.",
            "..............",
            ".d..d.....d..d",
            "......g.......",
            ".a..........a.",
            "..............",
            "..............",
        ],
        FootLockpicker => [
            "a.a.a.....a.a.",
            "..............",
            ".b..........b.",
            "..cc......cc..",
            "..............",
            ".g..........g.",
            "..d........d..",
            "..............",
            "..............",
        ],
        _ => return None,
    })
}

impl Layout {
    pub fn tile(&self, tx: i32, ty: i32) -> u8 {
        if tx < 0 || ty < 0 || tx >= self.w || ty >= self.h {
            b'#'
        } else {
            self.tiles[ty as usize][tx as usize]
        }
    }
    pub fn is_solid(&self, tx: i32, ty: i32) -> bool {
        matches!(self.tile(tx, ty), b'#' | b'a' | b'b' | b'c' | b'd' | b'e' | b'F' | b'T' | b'k')
    }
    /// Searchable fixtures in row-major order (index = index into `StoreState::contents`).
    pub fn fixtures(&self) -> Vec<FixtureDef> {
        let mut v = Vec::new();
        for ty in 0..self.h {
            for tx in 0..self.w {
                let t = self.tile(tx, ty);
                if matches!(t, b'a' | b'b' | b'F' | b'T') {
                    v.push(FixtureDef { tx, ty, kind: t });
                }
            }
        }
        v
    }
    pub fn guards(&self) -> Vec<(i32, i32, GuardKind)> {
        let mut v = Vec::new();
        for ty in 0..self.h {
            for tx in 0..self.w {
                match self.tile(tx, ty) {
                    b'g' => v.push((tx, ty, GuardKind::Spy)),
                    b'r' => v.push((tx, ty, GuardKind::Bot)),
                    _ => {}
                }
            }
        }
        v
    }
    pub fn find(&self, ch: u8) -> Option<(i32, i32)> {
        for ty in 0..self.h {
            for tx in 0..self.w {
                if self.tile(tx, ty) == ch {
                    return Some((tx, ty));
                }
            }
        }
        None
    }
}

pub fn layout(id: StoreId) -> Option<Layout> {
    let r = rows(id)?;
    let mut tiles = Vec::new();
    tiles.push(vec![b'#'; 16]);
    for row in r {
        let mut line = vec![b'#'];
        line.extend(row.bytes());
        line.push(b'#');
        tiles.push(line);
    }
    let mut last = vec![b'#'; 16];
    last[7] = b'D';
    last[8] = b'D';
    tiles.push(last);
    Some(Layout { w: 16, h: 11, tiles })
}

pub fn fixture_count(id: StoreId) -> usize {
    layout(id).map(|l| l.fixtures().len()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stores::{info, Role, ALL_STORES};
    use std::collections::VecDeque;

    #[test]
    fn open_stores_have_valid_layouts() {
        let mut n = 0;
        for id in ALL_STORES {
            let l = layout(id);
            if info(id).role == Role::Closed {
                assert!(l.is_none());
                continue;
            }
            let l = l.unwrap();
            n += 1;
            assert_eq!((l.w, l.h), (16, 11));
            assert_eq!(l.tiles.len(), 11);
            assert!(l.tiles.iter().all(|r| r.len() == 16), "{id:?}");
            assert_eq!(l.tile(8, 10), b'D');
            assert!(!l.is_solid(START.0, START.1));
            let f = l.fixtures().len();
            assert!((5..=10).contains(&f), "{id:?} has {f} fixtures");
            assert!(!l.guards().is_empty() && l.guards().len() <= 3, "{id:?}");
        }
        assert_eq!(n, 10);
    }
    #[test]
    fn everything_is_reachable_from_the_door() {
        for id in ALL_STORES {
            let Some(l) = layout(id) else { continue };
            let mut seen = vec![vec![false; 16]; 11];
            let mut q = VecDeque::new();
            q.push_back(START);
            seen[START.1 as usize][START.0 as usize] = true;
            while let Some((x, y)) = q.pop_front() {
                for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                    let (nx, ny) = (x + dx, y + dy);
                    if nx >= 0 && ny >= 0 && nx < 16 && ny < 11 && !l.is_solid(nx, ny) && !seen[ny as usize][nx as usize] {
                        seen[ny as usize][nx as usize] = true;
                        q.push_back((nx, ny));
                    }
                }
            }
            for f in l.fixtures() {
                let adj = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    .iter()
                    .any(|(dx, dy)| seen[(f.ty + dy) as usize][(f.tx + dx) as usize]);
                assert!(adj, "{id:?}: fixture at {},{} unreachable", f.tx, f.ty);
            }
            for (x, y, _) in l.guards() {
                assert!(seen[y as usize][x as usize], "{id:?}: guard unreachable");
            }
            for ty in 1..10 {
                for tx in 1..15 {
                    if !l.is_solid(tx, ty) {
                        assert!(seen[ty as usize][tx as usize], "{id:?}: floor pocket at {tx},{ty}");
                    }
                }
            }
        }
    }
    #[test]
    fn special_tiles_exist_where_the_brief_needs_them() {
        assert!(layout(StoreId::Forever12).unwrap().find(b'F').is_some());
        assert!(layout(StoreId::KgbToys).unwrap().find(b'T').is_some());
        assert!(layout(StoreId::SamBaddy).unwrap().find(b'L').is_some());
        let g = layout(StoreId::GameStonk).unwrap();
        assert!(g.find(b'k').is_some() && g.find(b'p').is_some());
        assert!(layout(StoreId::RadioShock).unwrap().guards().iter().any(|g| g.2 == GuardKind::Bot));
        assert!(layout(StoreId::SharperImagine).unwrap().guards().iter().any(|g| g.2 == GuardKind::Bot));
        assert_eq!(layout(StoreId::KgbToys).unwrap().guards().len(), 2);
        assert_eq!(layout(StoreId::Forever12).unwrap().guards().len(), 2);
    }
    #[test]
    fn each_room_has_its_own_layout() {
        let mut seen = std::collections::HashSet::new();
        for id in ALL_STORES {
            if let Some(r) = rows(id) {
                assert!(seen.insert(r.join("")), "{id:?} duplicates a layout");
            }
        }
    }
}
