pub mod art;
pub mod copy;
pub mod game;
pub mod pixel;
pub mod render;
pub mod splash;
use game::Game;
struct Runtime {
    game: Game,
    canvas: art::Canvas,
    gallery: bool,
    debug: bool,
}
thread_local! {static RUNTIME:std::cell::RefCell<Option<Runtime>>=const {std::cell::RefCell::new(None)};}
#[no_mangle]
pub extern "C" fn init(seed: u32, debug: u32, gallery: u32) {
    RUNTIME.with(|cell| {
        *cell.borrow_mut() = Some(Runtime {
            game: Game::new(seed, debug != 0),
            canvas: art::Canvas::new(),
            gallery: gallery != 0,
            debug: debug != 0,
        });
    })
}
#[no_mangle]
pub extern "C" fn tick(held: u32, pressed: u32) {
    RUNTIME.with(|cell| {
        if let Some(r) = cell.borrow_mut().as_mut() {
            r.game.tick(held, pressed)
        }
    })
}
#[no_mangle]
pub extern "C" fn draw() -> *const u8 {
    RUNTIME.with(|cell| {
        let mut borrow = cell.borrow_mut();
        let r = borrow.as_mut().unwrap();
        render::draw(&r.game, &mut r.canvas, r.gallery);
        r.canvas.pixels.as_ptr()
    })
}
#[no_mangle]
pub extern "C" fn sound() -> u32 {
    RUNTIME.with(|cell| {
        cell.borrow_mut()
            .as_mut()
            .and_then(|r| {
                if r.game.sounds.is_empty() {
                    None
                } else {
                    Some(r.game.sounds.remove(0))
                }
            })
            .unwrap_or(0)
    })
}
#[no_mangle]
pub extern "C" fn game_read(field: u32) -> i32 {
    RUNTIME.with(|cell| {
        let borrow = cell.borrow();
        let g = &borrow.as_ref().unwrap().game;
        match field {
            0 => g.scene as i32,
            1 => g.p.x,
            2 => g.p.y,
            3 => g.p.floor as i32,
            4 => g.score,
            5 => g.lives,
            6 => g.count() as i32,
            7 => g.loop_n as i32,
            8 => g.continues,
            9 => g.p.lift.map_or(-1, |x| x as i32),
            10 => g.paused as i32,
            11 => g.map as i32,
            12 => g.level_t as i32,
            13 => g.store as i32,
            14 => g.search.map_or(-1, |x| x.0 as i32),
            15 => g.enemies.len() as i32,
            16 => g.hi,
            17 => g.alarm as i32,
            18 => g.p.inv as i32,
            19 => g.rng.0 as i32,
            20 => g.p.armor as i32,
            21 => g.p.radar as i32,
            22 => g.black as i32,
            23 => g.p.stun as i32,
            24 => g.bonus_track as i32,
            25 => g.lamps.iter().filter(|l| l.active).count() as i32,
            _ => 0,
        }
    })
}
#[no_mangle]
pub extern "C" fn debug_command(op: u32, a: i32, b: i32) {
    RUNTIME.with(|cell| {
        let mut borrow = cell.borrow_mut();
        let r = borrow.as_mut().unwrap();
        if r.debug {
            r.game.debug(op, a, b)
        }
    })
}
#[no_mangle]
pub extern "C" fn fixture_read(index: u32, field: u32) -> i32 {
    RUNTIME.with(|cell| {
        let borrow = cell.borrow();
        let r = borrow.as_ref().unwrap();
        if !r.debug {
            return -1;
        }
        let Some(f) = r.game.rooms[r.game.store].fixtures.get(index as usize) else {
            return -1;
        };
        match field {
            0 => f.x,
            1 => f.y,
            2 => f.content as i32,
            3 => f.open as i32,
            _ => -1,
        }
    })
}
