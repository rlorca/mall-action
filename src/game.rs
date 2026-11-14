use crate::copy;
pub const UP: u32 = 1;
pub const DOWN: u32 = 2;
pub const LEFT: u32 = 4;
pub const RIGHT: u32 = 8;
pub const A: u32 = 16;
pub const B: u32 = 32;
pub const SELECT: u32 = 64;
pub const START: u32 = 128;
pub const FLOOR: [i32; 6] = [40, 88, 136, 184, 232, 280];
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scene {
    Splash,
    Title,
    Arrival,
    Selfie,
    Mall,
    Store,
    Clear,
    News,
    Post,
    Continue,
    Over,
}
#[derive(Clone, Copy, Debug)]
pub struct Rng(pub u32);
impl Rng {
    pub fn next(&mut self) -> u32 {
        let mut x = self.0.max(1);
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x
    }
    pub fn range(&mut self, n: u32) -> u32 {
        self.next() % n
    }
}
#[derive(Clone, Copy)]
pub struct StoreDef {
    pub name: &'static str,
    pub floor: usize,
    pub x: i32,
    pub role: u8,
    pub theme: usize,
}
pub const STORES: [StoreDef; 13] = [
    StoreDef {
        name: "FOREVER 12",
        floor: 1,
        x: 55,
        role: 0,
        theme: 0,
    },
    StoreDef {
        name: "RADIOSHOCK",
        floor: 1,
        x: 235,
        role: 0,
        theme: 1,
    },
    StoreDef {
        name: "CROOKSTONE",
        floor: 1,
        x: 450,
        role: 1,
        theme: 6,
    },
    StoreDef {
        name: "GAMESTONK",
        floor: 1,
        x: 655,
        role: 1,
        theme: 8,
    },
    StoreDef {
        name: "KGB TOYS",
        floor: 2,
        x: 75,
        role: 0,
        theme: 2,
    },
    StoreDef {
        name: "BLOCKBLUSTER VIDEO",
        floor: 2,
        x: 290,
        role: 2,
        theme: 1,
    },
    StoreDef {
        name: "SPENDER'S GIFTS",
        floor: 2,
        x: 545,
        role: 1,
        theme: 7,
    },
    StoreDef {
        name: "SAM BADDY",
        floor: 3,
        x: 60,
        role: 0,
        theme: 5,
    },
    StoreDef {
        name: "SHARPER IMAGINE",
        floor: 3,
        x: 245,
        role: 1,
        theme: 6,
    },
    StoreDef {
        name: "HOT SPY ON A STICK",
        floor: 3,
        x: 465,
        role: 0,
        theme: 3,
    },
    StoreDef {
        name: "CIRCUIT PITY",
        floor: 3,
        x: 655,
        role: 2,
        theme: 1,
    },
    StoreDef {
        name: "FOOT LOCKPICKER",
        floor: 4,
        x: 75,
        role: 0,
        theme: 4,
    },
    StoreDef {
        name: "BORDERLINE BOOKS",
        floor: 4,
        x: 490,
        role: 2,
        theme: 5,
    },
];
#[derive(Clone)]
pub struct Fixture {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub content: u8,
    pub open: bool,
    pub kind: u8,
}
#[derive(Clone)]
pub struct Room {
    pub w: i32,
    pub h: i32,
    pub fixtures: Vec<Fixture>,
    pub visited: bool,
}
impl Room {
    pub fn new(id: usize, rng: &mut Rng, black: bool) -> Self {
        // Individually composed shop plans: aisles, islands, wall bays and counters.
        const PLANS: [[(i32, i32); 8]; 10] = [
            [
                (24, 44),
                (80, 44),
                (144, 48),
                (208, 48),
                (32, 112),
                (88, 112),
                (152, 116),
                (208, 112),
            ],
            [
                (24, 44),
                (80, 44),
                (144, 44),
                (208, 44),
                (24, 112),
                (80, 112),
                (152, 112),
                (208, 112),
            ],
            [
                (24, 44),
                (80, 48),
                (144, 44),
                (208, 48),
                (24, 108),
                (88, 116),
                (152, 108),
                (208, 116),
            ],
            [
                (24, 44),
                (80, 44),
                (144, 44),
                (208, 44),
                (24, 116),
                (80, 116),
                (152, 116),
                (208, 116),
            ],
            [
                (24, 44),
                (80, 56),
                (144, 56),
                (208, 44),
                (24, 108),
                (88, 120),
                (152, 120),
                (208, 108),
            ],
            [
                (24, 44),
                (80, 44),
                (144, 44),
                (208, 44),
                (24, 116),
                (80, 116),
                (152, 116),
                (208, 116),
            ],
            [
                (24, 44),
                (88, 44),
                (152, 44),
                (208, 44),
                (24, 108),
                (88, 116),
                (152, 116),
                (208, 108),
            ],
            [
                (24, 44),
                (80, 52),
                (144, 44),
                (208, 52),
                (24, 112),
                (80, 120),
                (152, 112),
                (208, 120),
            ],
            [
                (24, 48),
                (80, 44),
                (144, 44),
                (208, 48),
                (24, 112),
                (80, 116),
                (152, 116),
                (208, 112),
            ],
            [
                (24, 44),
                (80, 44),
                (144, 44),
                (208, 44),
                (24, 112),
                (88, 116),
                (152, 116),
                (208, 112),
            ],
        ];
        let plan = match id {
            0 => 0,
            1 => 1,
            2 => 2,
            3 => 3,
            4 => 4,
            6 => 5,
            7 => 6,
            8 => 7,
            9 => 8,
            _ => 9,
        };
        let mut fixtures = Vec::new();
        let package = rng.range(8) as usize;
        for i in 0..8 {
            let content = if STORES[id].role == 0 && i == package {
                1
            } else if black || STORES[id].role == 1 {
                if black || rng.range(3) > 0 {
                    2 + rng.range(9) as u8
                } else {
                    0
                }
            } else {
                match rng.range(8) {
                    0 => 11,
                    1 | 2 => 2 + rng.range(9) as u8,
                    _ => 0,
                }
            };
            fixtures.push(Fixture {
                x: PLANS[plan][i].0,
                y: PLANS[plan][i].1,
                w: 24,
                h: 24,
                content,
                open: false,
                kind: if id == 0 && i < 2 { 1 } else { 0 },
            });
        }
        Self {
            w: 256,
            h: 176,
            fixtures,
            visited: false,
        }
    }
    pub fn solid(&self, x: i32, y: i32) -> bool {
        x < 10
            || x > self.w - 22
            || y < 26
            || y > self.h - 16
            || self
                .fixtures
                .iter()
                .any(|f| overlap(x, y, 12, 12, f.x, f.y, f.w, f.h))
    }
}
#[derive(Clone)]
pub struct Player {
    pub x: i32,
    pub y: i32,
    pub floor: usize,
    pub dir: i32,
    pub face: usize,
    pub jump: i32,
    pub vy: i32,
    pub falling: bool,
    pub origin: i32,
    pub duck: bool,
    pub inv: u32,
    pub stun: u32,
    pub armor: bool,
    pub radar: bool,
    pub weapon: u8,
    pub weapon_t: u32,
    pub speed: u8,
    pub speed_t: u32,
    pub food: u32,
    pub lift: Option<usize>,
    pub roof: Option<usize>,
    pub escalator: i32,
    pub hidden: u32,
    pub sliding: i32,
    pub safe: (i32, usize),
    pub shoot: u32,
    pub pose: u32,
    pub item: u8,
}
impl Player {
    fn new() -> Self {
        Self {
            x: 210,
            y: 40,
            floor: 0,
            dir: 1,
            face: 3,
            jump: 0,
            vy: 0,
            falling: false,
            origin: 40,
            duck: false,
            inv: 120,
            stun: 0,
            armor: false,
            radar: false,
            weapon: 0,
            weapon_t: 0,
            speed: 0,
            speed_t: 0,
            food: 0,
            lift: None,
            roof: None,
            escalator: 0,
            hidden: 0,
            sliding: 0,
            safe: (210, 0),
            shoot: 0,
            pose: 0,
            item: 0,
        }
    }
}
#[derive(Clone)]
pub struct Lift {
    pub x: i32,
    pub y: i32,
    pub min: usize,
    pub max: usize,
    pub dir: i32,
    pub target: Option<usize>,
    pub wait: u32,
    pub auto: bool,
    pub call: bool,
    pub stopped: bool,
}
#[derive(Clone)]
pub struct Enemy {
    pub x: i32,
    pub y: i32,
    pub floor: usize,
    pub age: u32,
    pub aim: u32,
    pub cooldown: u32,
    pub dir: i32,
    pub duck: bool,
    pub hp: i32,
    pub dead: u32,
    pub bot: bool,
    pub stun: u32,
    pub high: bool,
    pub volley: u32,
}
#[derive(Clone)]
pub struct Bullet {
    pub x: i32,
    pub y: i32,
    pub dx: i32,
    pub dy: i32,
    pub enemy: bool,
    pub ttl: u32,
    pub volley: u32,
}
#[derive(Clone)]
pub struct Lamp {
    pub x: i32,
    pub floor: usize,
    pub y: i32,
    pub vy: i32,
    pub roll: i32,
    pub active: bool,
    pub broken: bool,
    pub dark: u32,
}
#[derive(Clone)]
pub struct Drop {
    pub x: i32,
    pub y: i32,
    pub dx: i32,
    pub dy: i32,
    pub kind: u8,
    pub ttl: u32,
}
#[derive(Clone)]
pub struct Bubble {
    pub x: i32,
    pub y: i32,
    pub text: String,
    pub time: u32,
}
#[derive(Clone)]
pub struct Game {
    pub scene: Scene,
    pub scene_t: u32,
    pub frame: u32,
    pub level_t: u32,
    pub rng: Rng,
    pub seed: u32,
    pub p: Player,
    pub lifts: Vec<Lift>,
    pub enemies: Vec<Enemy>,
    pub bullets: Vec<Bullet>,
    pub lamps: Vec<Lamp>,
    pub drops: Vec<Drop>,
    pub bubbles: Vec<Bubble>,
    pub rooms: Vec<Room>,
    pub packages: [bool; 13],
    pub store: usize,
    pub score: i32,
    pub hi: i32,
    pub lives: i32,
    pub continues: i32,
    pub loop_n: u32,
    pub black: bool,
    pub paused: bool,
    pub map: bool,
    pub banner: String,
    pub banner_t: u32,
    pub sounds: Vec<u32>,
    pub search: Option<(usize, u32, usize)>,
    pub visited: [bool; 13],
    pub joke: Option<usize>,
    pub joke_phase: u32,
    pub photo: bool,
    pub alarm: bool,
    pub konami: usize,
    pub shot_id: u32,
    pub spawn: u32,
    pub kiosk: u32,
    pub fountains: [u32; 2],
    pub wet_t: u32,
    pub wet_x: i32,
    pub janitor: i32,
    pub cop_x: i32,
    pub cop_floor: usize,
    pub cop_dir: i32,
    pub cop_t: u32,
    pub walk: [i32; 2],
    pub call_t: u32,
    pub card: usize,
    pub pa: usize,
    pub shake: u32,
    pub clear_once: bool,
    pub toys: Vec<Drop>,
    pub first_t: u32,
    pub time_bonus: i32,
    pub bonus_track: bool,
    pub score_life_awarded: bool,
}
impl Game {
    pub fn new(seed: u32, debug: bool) -> Self {
        let mut g = Self {
            scene: if debug { Scene::Title } else { Scene::Splash },
            scene_t: 0,
            frame: 0,
            level_t: 0,
            rng: Rng(seed),
            seed,
            p: Player::new(),
            lifts: vec![],
            enemies: vec![],
            bullets: vec![],
            lamps: vec![],
            drops: vec![],
            bubbles: vec![],
            rooms: vec![],
            packages: [false; 13],
            store: 0,
            score: 0,
            hi: 0,
            lives: 3,
            continues: 3,
            loop_n: 1,
            black: false,
            paused: false,
            map: false,
            banner: String::new(),
            banner_t: 0,
            sounds: vec![],
            search: None,
            visited: [false; 13],
            joke: None,
            joke_phase: 0,
            photo: false,
            alarm: false,
            konami: 0,
            shot_id: 0,
            spawn: 300,
            kiosk: 0,
            fountains: [0; 2],
            wet_t: 0,
            wet_x: 300,
            janitor: 300,
            cop_x: 600,
            cop_floor: 2,
            cop_dir: -1,
            cop_t: 0,
            walk: [280, 580],
            call_t: 0,
            card: 0,
            pa: 0,
            shake: 0,
            clear_once: false,
            toys: vec![],
            first_t: 0,
            time_bonus: 0,
            bonus_track: false,
            score_life_awarded: false,
        };
        g.setup();
        g
    }
    pub fn setup(&mut self) {
        self.paused = false;
        self.map = false;
        self.banner_t = 0;
        self.p = Player::new();
        self.packages = [false; 13];
        self.rooms = (0..13)
            .map(|i| Room::new(i, &mut self.rng, self.black))
            .collect();
        self.lifts = vec![
            Lift {
                x: 170,
                y: FLOOR[0],
                min: 0,
                max: 3,
                dir: 0,
                target: None,
                wait: 120,
                auto: false,
                call: false,
                stopped: true,
            },
            Lift {
                x: 385,
                y: FLOOR[1],
                min: 1,
                max: 5,
                dir: 0,
                target: None,
                wait: 120,
                auto: false,
                call: false,
                stopped: true,
            },
            Lift {
                x: 725,
                y: FLOOR[0],
                min: 0,
                max: 4,
                dir: 0,
                target: None,
                wait: 120,
                auto: true,
                call: false,
                stopped: true,
            },
        ];
        self.enemies.clear();
        self.bullets.clear();
        self.drops.clear();
        self.toys.clear();
        self.lamps = (1..5)
            .flat_map(|floor| {
                [130, 340, 610].map(move |x| Lamp {
                    x,
                    floor,
                    y: FLOOR[floor] - 30,
                    vy: 0,
                    roll: 0,
                    active: false,
                    broken: false,
                    dark: 0,
                })
            })
            .collect();
        self.level_t = 0;
        self.spawn = 300;
        self.clear_once = false;
        self.alarm = false;
        self.search = None;
        self.joke_phase = 0;
        self.first_t = 0;
        self.fountains = [0; 2];
        self.cop_floor = 1 + self.rng.range(4) as usize;
        self.cop_t = 0;
        self.wet_t = 0;
        self.kiosk = 0;
        self.bonus_track = false;
    }
    pub fn count(&self) -> usize {
        self.packages.iter().filter(|&&p| p).count()
    }
    pub fn say(&mut self, s: impl Into<String>) {
        self.banner = s.into();
        self.banner_t = 150;
    }
    pub fn sound(&mut self, n: u32) {
        if self.sounds.len() < 64 {
            self.sounds.push(n);
        }
    }
    pub fn points(&mut self, n: i32) {
        self.score = (self.score + n).max(0);
        self.hi = self.hi.max(self.score);
        if !self.score_life_awarded && self.score >= 20000 {
            self.score_life_awarded = true;
            self.lives += 1;
            self.sound(8);
        }
    }
    pub fn transition(&mut self, s: Scene) {
        self.scene = s;
        self.scene_t = 0;
        self.search = None;
        self.sound(10);
    }
    pub fn damage(&mut self) {
        if self.p.inv > 0 || self.p.food > 0 || self.p.hidden > 0 {
            return;
        }
        if self.p.armor {
            self.p.armor = false;
            self.p.inv = 90;
            self.sound(7);
            return;
        }
        self.lives -= 1;
        self.sound(7);
        self.shake = 12;
        let radar = self.p.radar;
        let safe = self.p.safe;
        self.p = Player::new();
        self.p.radar = radar;
        self.p.safe = safe;
        self.p.x = safe.0;
        self.p.floor = safe.1;
        self.p.y = FLOOR[safe.1];
        self.enemies.clear();
        self.bullets.clear();
        self.search = None;
        self.cop_t = 0;
        if self.scene == Scene::Store {
            self.transition(Scene::Mall)
        }
        if self.lives <= 0 {
            self.transition(if self.continues > 0 {
                Scene::Continue
            } else {
                Scene::Over
            });
        } else {
            self.say("WATCH YOUR STEP, AGENT!");
        }
    }
    pub fn power(&mut self, k: u8) {
        self.p.pose = 45;
        self.p.item = k;
        self.points(50);
        match k {
            2 => {
                self.p.weapon = 1;
                self.p.weapon_t = 1200
            }
            3 => {
                self.p.weapon = 2;
                self.p.weapon_t = 1200
            }
            4 | 10 => self.p.armor = true,
            5 => {
                self.p.speed = 1;
                self.p.speed_t = 1200
            }
            6 => self.p.radar = true,
            7 => self.lives += 1,
            8 => self.p.food = 360,
            9 => {
                self.p.speed = 2;
                self.p.speed_t = 720
            }
            _ => (),
        };
        self.say(match k {
            2 => "RAPID FIRE",
            3 => "SPREAD SHOT",
            4 => "ARMOR VEST",
            5 => "SNEAKERS",
            6 => "RADAR",
            7 => "1-UP",
            8 => "CINNABOMB",
            9 => "ORANGE JULI-OOZE",
            _ => "SOFT PRETZEL",
        });
        self.sound(8);
    }
    pub fn tick(&mut self, held: u32, press: u32) {
        self.frame += 1;
        if press & SELECT != 0 && matches!(self.scene, Scene::Mall | Scene::Store) {
            self.map = !self.map;
            self.sound(14);
            return;
        }
        if press & START != 0 && matches!(self.scene, Scene::Mall | Scene::Store) {
            self.paused = !self.paused;
            self.sound(14);
            return;
        }
        if self.map || self.paused {
            return;
        }
        self.scene_t += 1;

        self.banner_t = self.banner_t.saturating_sub(1);
        self.shake = self.shake.saturating_sub(1);
        for b in &mut self.bubbles {
            b.time = b.time.saturating_sub(1)
        }
        self.bubbles.retain(|b| b.time > 0);
        match self.scene {
            Scene::Splash => {
                if self.scene_t == 60 {
                    self.sound(8)
                }
                if press != 0 || self.scene_t >= crate::splash::DURATION {
                    self.transition(Scene::Title)
                }
            }
            Scene::Title => {
                let code = [UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A];
                for bit in [UP, DOWN, LEFT, RIGHT, B, A] {
                    if press & bit != 0 {
                        if code[self.konami] == bit {
                            self.konami += 1
                        } else {
                            self.konami = if bit == UP {
                                if self.konami == 2 {
                                    2
                                } else {
                                    1
                                }
                            } else {
                                0
                            }
                        }
                        if self.konami == code.len() {
                            self.black = true;
                            self.konami = 0;
                            self.say("BLACK FRIDAY! 70% OFF EVERYTHING");
                            self.sound(8);
                        }
                    }
                }
                if press & START != 0 {
                    self.score = 0;
                    self.score_life_awarded = false;
                    self.lives = 3;
                    self.continues = 3;
                    self.loop_n = 1;
                    self.visited = [false; 13];
                    self.photo = false;
                    self.joke = None;
                    self.setup();
                    self.transition(Scene::Arrival);
                }
            }
            Scene::Arrival => {
                if self.scene_t == 1 {
                    self.sound(15)
                }
                if self.scene_t > 110 || press != 0 {
                    self.card = self.rng.range(10) as usize;
                    self.transition(Scene::Selfie);
                    self.sound(8);
                }
            }
            Scene::Selfie => {
                if self.scene_t > 150 || press != 0 {
                    self.transition(Scene::Mall)
                }
            }
            Scene::Continue => {
                if self.scene_t % 60 == 1 {
                    self.sound(12)
                }
                if press & START != 0 {
                    self.continues -= 1;
                    self.lives = 3;
                    self.p.armor = false;
                    self.p.radar = false;
                    self.p.inv = 120;
                    self.transition(Scene::Mall)
                } else if self.scene_t >= 600 {
                    self.transition(Scene::Over)
                }
            }
            Scene::Over => {
                if self.scene_t == 1 {
                    self.sound(16)
                }
                if self.scene_t > 420 || self.scene_t > 120 && press & START != 0 {
                    self.black = false;
                    self.transition(Scene::Title)
                }
            }
            Scene::Clear => {
                if self.scene_t == 1 {
                    self.sound(8)
                }
                if self.scene_t > 300 || press & START != 0 {
                    self.card = self.rng.range(5) as usize;
                    self.transition(Scene::News)
                }
            }
            Scene::News => {
                if self.scene_t > 300 || press & START != 0 {
                    self.card = self.rng.range(10) as usize;
                    self.transition(Scene::Post)
                }
            }
            Scene::Post => {
                if self.scene_t > 240 || press & START != 0 {
                    self.loop_n += 1;
                    self.setup();
                    self.transition(Scene::Arrival)
                }
            }
            Scene::Mall | Scene::Store => {
                self.level_t += 1;
                self.timers();
                if !self.alarm
                    && self.level_t
                        >= ((150u32.saturating_sub((self.loop_n - 1) * 20)).max(40)) * 60
                {
                    self.alarm = true;
                    self.say("ALARM! SECURITY ALERTED");
                    self.sound(13)
                }
                if self.level_t % 3600 == 0 {
                    self.pa = (self.pa + 1 + self.rng.range(6) as usize) % 7;
                    self.say(copy::PA[self.pa]);
                    self.sound(16)
                }
                if self.scene == Scene::Mall {
                    self.mall(held, press)
                } else {
                    self.room_tick(held, press)
                }
                self.projectiles();
                self.pickups();
                self.points(0);
            }
        }
    }
    fn timers(&mut self) {
        self.p.pose = self.p.pose.saturating_sub(1);
        self.p.inv = self.p.inv.saturating_sub(1);
        self.p.stun = self.p.stun.saturating_sub(1);
        self.p.shoot = self.p.shoot.saturating_sub(1);
        self.p.food = self.p.food.saturating_sub(1);
        self.p.weapon_t = self.p.weapon_t.saturating_sub(1);
        if self.p.weapon_t == 0 {
            self.p.weapon = 0
        }
        self.p.speed_t = self.p.speed_t.saturating_sub(1);
        if self.p.speed_t == 0 {
            self.p.speed = 0
        }
        self.kiosk = self.kiosk.saturating_sub(1);
        for f in &mut self.fountains {
            *f = f.saturating_sub(1)
        }
        if self.p.hidden > 0 {
            self.p.hidden -= 1;
            if self.p.hidden == 0 && !self.photo {
                self.photo = true;
                self.say("PHOTO STRIP ADDED TO INVENTORY");
                self.sound(8)
            }
        }
    }
    fn shoot(&mut self) {
        if self.p.shoot > 0 || self.p.stun > 0 || self.p.hidden > 0 {
            return;
        }
        let max = if self.p.weapon == 1 { 4 } else { 2 };
        if self.bullets.iter().filter(|b| !b.enemy).count() >= max {
            return;
        }
        self.p.shoot = if self.p.weapon == 1 { 8 } else { 18 };
        self.shot_id += 1;
        let (dx, dy, x, y) = if self.scene == Scene::Store {
            let (dx, dy) = [(0, -4), (0, 4), (-4, 0), (4, 0)][self.p.face];
            (dx, dy, self.p.x + 6, self.p.y + 6)
        } else {
            (
                self.p.dir * 4,
                0,
                self.p.x + 8,
                self.p.y - if self.p.duck { 7 } else { 15 },
            )
        };
        self.bullets.push(Bullet {
            x,
            y,
            dx,
            dy,
            enemy: false,
            ttl: 130,
            volley: self.shot_id,
        });
        if self.p.weapon == 2 {
            for s in [-1, 1] {
                self.bullets.push(Bullet {
                    x,
                    y,
                    dx: if dx == 0 { s } else { dx },
                    dy: if dy == 0 { s } else { dy },
                    enemy: false,
                    ttl: 100,
                    volley: self.shot_id,
                });
            }
        }
        self.sound(1);
        if self.scene == Scene::Mall
            && self.p.floor == self.cop_floor
            && (self.p.x - self.cop_x).abs() < 128
            && (self.p.x - self.cop_x) * self.cop_dir > 0
        {
            self.cop_t = 600;
            self.say("HEY! STOP RIGHT THERE!");
            self.sound(13)
        }
    }
    fn mall(&mut self, h: u32, e: u32) {
        self.elevators(h);
        if self.p.hidden > 0 {
            return;
        }
        if self.p.stun == 0 && self.p.pose == 0 {
            if e & A != 0 || h & A != 0 && self.p.weapon == 1 {
                self.shoot()
            }
            if self.p.lift.is_none() && self.p.escalator == 0 {
                let speed = if self.p.speed == 1 {
                    2
                } else if self.p.speed == 2 && self.frame % 2 == 0 {
                    2
                } else {
                    1
                };
                let move_x = if self.p.sliding != 0 {
                    self.p.sliding
                } else {
                    if h & LEFT != 0 {
                        -1
                    } else if h & RIGHT != 0 {
                        1
                    } else {
                        0
                    }
                };
                if move_x != 0 {
                    self.p.dir = move_x;
                    self.p.x = (self.p.x + move_x * speed).clamp(8, 744)
                }
                self.p.duck = h & DOWN != 0 && self.p.jump == 0;
                if e & B != 0 && self.p.jump == 0 && !self.p.falling {
                    self.p.vy = -4;
                    self.p.jump = 1;
                    self.sound(2)
                }
                if self.p.jump != 0 {
                    self.p.y += self.p.vy;
                    if self.frame % 3 == 0 {
                        self.p.vy += 1
                    }
                    self.p.jump += 1;
                    if self.p.y >= FLOOR[self.p.floor] {
                        self.p.y = FLOOR[self.p.floor];
                        self.p.jump = 0;
                        self.p.vy = 0;
                    }
                }
                if self.p.roof.is_none() {
                    for i in 0..self.lifts.len() {
                        let l = &self.lifts[i];
                        if self.p.floor >= l.min
                            && self.p.floor <= l.max
                            && (self.p.x + 8 - l.x).abs() < 11
                            && self.p.jump == 0
                            && !self.p.falling
                            && l.y > self.p.y + 2
                        {
                            self.p.falling = true;
                            self.p.origin = self.p.y;
                            self.p.vy = 0;
                        }
                    }
                }
                if self.p.falling {
                    self.p.vy = (self.p.vy + 1).min(6);
                    self.p.y += self.p.vy;
                    let mut land = None;
                    for (i, l) in self.lifts.iter().enumerate() {
                        if (self.p.x + 8 - l.x).abs() < 20 && self.p.y >= l.y - 16 {
                            land = Some((i, l.y - 16));
                        }
                    }
                    if let Some((i, y)) = land {
                        if y - self.p.origin > 48 {
                            self.damage()
                        } else {
                            self.p.y = y;
                            self.p.roof = Some(i);
                            self.p.falling = false;
                        }
                    } else if self.p.y > 300 {
                        self.damage()
                    }
                }
                if let Some(i) = self.p.roof {
                    let l = &self.lifts[i];
                    if (self.p.x + 8 - l.x).abs() > 20 {
                        self.p.roof = None;
                        self.p.falling = true;
                        self.p.origin = self.p.y;
                        self.p.floor = nearest_floor(self.p.y);
                    } else {
                        self.p.y = l.y - 16;
                        if l.y <= FLOOR[l.min] + 16 {
                            self.damage()
                        }
                    }
                }
                if self.p.jump == 0 && !self.p.falling && self.p.roof.is_none() {
                    self.interact(h, e)
                }
            }
        }
        if self.p.escalator != 0 {
            let dir = self.p.escalator.signum();
            self.p.y += dir;
            self.p.x += if dir < 0 { 1 } else { -1 };
            let target = FLOOR[self.p.floor];
            if self.p.y == target {
                self.p.escalator = 0;
                self.p.safe = (self.p.x, self.p.floor);
            }
        }
        self.npcs();
        self.spy_tick(false);
        self.spawn = self.spawn.saturating_sub(1);
        if self.spawn == 0 {
            self.spawn = (210u32.saturating_sub((self.loop_n - 1) * 25)).max(60)
                / if self.black { 2 } else { 1 }
                / if self.alarm { 2 } else { 1 };
            self.spawn_spy();
        }
        self.lamp_tick();
    }
    fn interact(&mut self, h: u32, e: u32) {
        let floor = self.p.floor;
        let x = self.p.x + 8;
        let mut near = false;
        for i in 0..self.lifts.len() {
            let l = &self.lifts[i];
            if floor >= l.min && floor <= l.max && (x - l.x).abs() < 27 {
                near = true;
                self.call_t += 1;
                if l.y == FLOOR[floor] && l.stopped && e & (UP | DOWN) != 0 {
                    self.p.lift = Some(i);
                    self.p.x = l.x - 8;
                    self.call_t = 0;
                    return;
                }
                if (e & (UP | DOWN) != 0 || self.call_t >= 30) && l.y != FLOOR[floor] {
                    self.lifts[i].target = Some(floor);
                    self.lifts[i].call = true;
                    self.call_t = 0;
                    self.say("ELEVATOR CALLED");
                    return;
                }
            }
        }
        if !near {
            self.call_t = 0
        }
        if e & (UP | DOWN) == 0 {
            return;
        }
        for (i, s) in STORES.iter().enumerate() {
            if s.floor == floor && (x - s.x).abs() < 20 {
                if s.role == 2 {
                    self.say("CLOSED. CAPITALISM HAPPENED.")
                } else if self.packages[i] {
                    self.say("ALL CLEAR, AGENT.")
                } else {
                    self.enter(i)
                }
                return;
            }
        }
        for (bottom, top, ex) in [(2, 1, 310), (4, 3, 580)] {
            if floor == bottom && (x - ex).abs() < 22 && h & UP != 0 {
                self.p.floor = top;
                self.p.escalator = -1;
                self.sound(10);
                return;
            }
            if floor == top && (x - (ex + 48)).abs() < 22 && h & DOWN != 0 {
                self.p.floor = bottom;
                self.p.escalator = 1;
                self.sound(10);
                return;
            }
        }
        if floor == 5 && (x - 635).abs() < 60 {
            if self.count() == 6 && !self.clear_once {
                self.clear_once = true;
                self.time_bonus = (300 - self.level_t as i32 / 60).max(0) * 10;
                self.points(1000 + self.time_bonus);
                self.transition(Scene::Clear)
            } else {
                self.say(format!("PACKAGES LEFT: {}", 6 - self.count()));
                self.sound(12)
            }
            return;
        }
        if (1..=4).contains(&floor) && (x - 530).abs() < 18 && self.kiosk == 0 {
            self.kiosk = 1200;
            let nearest = STORES
                .iter()
                .enumerate()
                .filter(|(i, s)| s.role == 0 && !self.packages[*i])
                .min_by_key(|(_, s)| (s.floor as i32 - floor as i32).abs() * 768 + (s.x - x).abs())
                .map(|(_, s)| s.name);
            self.say(format!(
                "DIRECTORY: {}",
                nearest.unwrap_or("GETAWAY CAR ON P")
            ));
            self.map = true;
        }
        if floor == 2 && (x - 450).abs() < 20 {
            self.p.hidden = 300;
            self.say("PHOTO BOOTH: INCOGNITO");
            self.sound(10)
        }
    }
    fn elevators(&mut self, h: u32) {
        for i in 0..self.lifts.len() {
            let occupied = self.p.lift == Some(i);
            let l = &mut self.lifts[i];
            if occupied && l.stopped && h & (LEFT | RIGHT) != 0 {
                self.p.lift = None;
                self.p.x = l.x + if h & LEFT != 0 { -34 } else { 20 };
                self.p.safe = (self.p.x, self.p.floor);
                continue;
            }
            if occupied && !l.auto {
                let dir = if h & UP != 0 {
                    -1
                } else if h & DOWN != 0 {
                    1
                } else {
                    0
                };
                if dir != 0 && l.target.is_none() {
                    let cur = nearest_floor(l.y);
                    let target = if dir < 0 {
                        cur.saturating_sub(1).max(l.min)
                    } else {
                        (cur + 1).min(l.max)
                    };
                    if FLOOR[target] != l.y {
                        l.target = Some(target);
                        l.dir = dir;
                    }
                }
            }
            if l.auto && l.target.is_none() && !occupied && !l.call {
                l.wait = l.wait.saturating_sub(1);
                if l.wait == 0 {
                    let cur = nearest_floor(l.y);
                    let mut t = l.min + self.rng.range((l.max - l.min + 1) as u32) as usize;
                    if t == cur {
                        t = if t == l.max { l.min } else { t + 1 }
                    }
                    l.target = Some(t);
                }
            }
            let mut ding = false;
            let mut crush = false;
            if let Some(t) = l.target {
                l.dir = (FLOOR[t] - l.y).signum();
                l.stopped = false;
                l.y += l.dir;
                if !occupied
                    && self.scene == Scene::Mall
                    && self.p.floor >= l.min
                    && self.p.floor <= l.max
                    && (self.p.x + 8 - l.x).abs() < 18
                    && l.dir > 0
                    && self.p.y >= l.y - 3
                    && self.p.y <= l.y + 3
                    && !self.p.falling
                {
                    if l.call {
                        self.p.lift = Some(i)
                    } else {
                        crush = true
                    }
                }
                for en in &mut self.enemies {
                    if en.dead == 0
                        && l.dir > 0
                        && (en.x + 8 - l.x).abs() < 20
                        && (en.y - l.y).abs() < 3
                    {
                        en.dead = 24;
                        en.hp = 0;
                        self.score += 300;
                        self.shake = 8;
                    }
                }
                if l.y == FLOOR[t] {
                    l.target = None;
                    l.stopped = true;
                    l.wait = 120;
                    ding = true;
                    if occupied || self.p.lift == Some(i) {
                        self.p.floor = t;
                        self.p.safe = (l.x + 24, t);
                    }
                    if l.call && self.p.floor == t && (self.p.x + 8 - l.x).abs() < 28 {
                        self.p.lift = Some(i);
                        self.p.x = l.x - 8;
                    }
                    l.call = false;
                }
            }
            if self.p.lift == Some(i) {
                self.p.y = l.y;
                self.p.x = l.x - 8;
                self.p.floor = nearest_floor(l.y)
            }
            if ding {
                if (self.p.x + 8 - l.x).abs() < 240 {
                    self.sound(3)
                }
                if self.p.lift == Some(i) {
                    self.say(format!(
                        "{} - {}",
                        floor_name(self.p.floor),
                        [
                            "ROOFTOP RENDEZVOUS",
                            "FASHION & GADGETS, SPIES",
                            "TOYS & QUESTIONABLE GIFTS",
                            "MUSIC, FOOD & SURVEILLANCE",
                            "SPORTS & WET FLOORS",
                            "PARKING & GETAWAYS"
                        ][self.p.floor]
                    ));
                }
            }
            if crush {
                self.damage();
            }
        }
    }
    fn spawn_spy(&mut self) {
        let cap = if self.black { 8 } else { 4 };
        if self.enemies.iter().filter(|e| e.dead == 0).count() >= cap {
            return;
        }
        let choices: Vec<_> = STORES
            .iter()
            .enumerate()
            .filter(|(i, s)| {
                s.role != 2
                    && !self.packages[*i]
                    && (s.floor as i32 - self.p.floor as i32).abs() <= 1
                    && (s.x - self.p.x).abs() >= 64
                    && (s.x - self.p.x).abs() <= 200
            })
            .map(|(_, s)| *s)
            .collect();
        if choices.is_empty() {
            return;
        }
        let s = choices[self.rng.range(choices.len() as u32) as usize];
        self.enemies.push(Enemy {
            x: s.x - 8,
            y: FLOOR[s.floor],
            floor: s.floor,
            age: 0,
            aim: 0,
            cooldown: 120,
            dir: -1,
            duck: false,
            hp: 1,
            dead: 0,
            bot: false,
            stun: 0,
            high: true,
            volley: 0,
        });
    }
    fn spy_tick(&mut self, room: bool) {
        let mut shots = Vec::new();
        let mut hurt = false;
        let frozen = room && (self.first_t > 0 || self.joke_phase > 0 && self.joke_phase < 240);
        let px = self.p.x;
        let py = self.p.y;
        for en in &mut self.enemies {
            en.age += 1;
            if en.dead > 0 {
                en.dead -= 1;
                continue;
            }
            if frozen {
                continue;
            }
            en.stun = en.stun.saturating_sub(1);
            if en.stun > 0 {
                continue;
            }
            let visible = self.p.pose == 0
                && self.p.hidden == 0
                && self.p.stun == 0
                && (room || en.floor == self.p.floor)
                && (en.x - px).abs() < 160;
            en.dir = if px < en.x { -1 } else { 1 };
            if en.bot {
                if en.age % 120 == 0 {
                    en.dir *= -1
                }
                if en.age % 2 == 0 {
                    let nx = en.x + if en.age % 240 < 120 { 1 } else { -1 };
                    if !self.rooms[self.store].solid(nx, en.y) {
                        en.x = nx
                    }
                }
            } else {
                en.cooldown = en.cooldown.saturating_sub(1);
                if visible && en.cooldown == 0 && en.aim == 0 {
                    en.aim = 30;
                    en.high = self.rng.range(2) == 0;
                }
                if en.aim > 0 {
                    en.aim -= 1;
                    if en.aim == 0 {
                        let (dx, dy, y) = if room {
                            if (en.x - px).abs() < (en.y - py).abs() {
                                (0, if py < en.y { -2 } else { 2 }, en.y + 6)
                            } else {
                                (en.dir * 2, 0, en.y + 6)
                            }
                        } else {
                            (en.dir * 2, 0, en.y - if en.high { 15 } else { 7 })
                        };
                        let clear = !room
                            || line_clear(&self.rooms[self.store], en.x + 6, y, px + 6, py + 6);
                        if clear {
                            shots.push(Bullet {
                                x: en.x + 8,
                                y,
                                dx,
                                dy,
                                enemy: true,
                                ttl: 150,
                                volley: 0,
                            });
                        }
                        en.cooldown = (150u32.saturating_sub((self.loop_n - 1) * 20)).max(60);
                    }
                } else if en.age % if self.alarm { 2 } else { 3 } == 0 && (en.x - px).abs() > 40 {
                    let nx = en.x + en.dir * (1 + ((self.loop_n - 1) / 5).min(1) as i32);
                    if room {
                        if !self.rooms[self.store].solid(nx, en.y) {
                            en.x = nx
                        }
                        if en.age % 6 == 0 {
                            let ny = en.y + (py - en.y).signum();
                            if !self.rooms[self.store].solid(en.x, ny) {
                                en.y = ny
                            }
                        }
                    } else if !self
                        .lifts
                        .iter()
                        .any(|l| (nx + 8 - l.x).abs() < 24 && l.y > en.y)
                    {
                        en.x = nx.clamp(12, 740)
                    }
                }
            }
            let (ey, ph) = if room { (en.y, 12) } else { (en.y - 22, 22) };
            let ptop = if room {
                py
            } else {
                py - if self.p.duck { 12 } else { 23 }
            };
            if overlap(px, ptop, 12, if room { 12 } else { ph }, en.x, ey, 12, ph)
                && self.p.hidden == 0
            {
                if self.p.food > 0 || !room && (self.p.jump > 0 || self.p.sliding != 0) {
                    en.dead = 24;
                    en.hp = 0;
                    self.score += if self.p.sliding != 0 { 300 } else { 100 };
                } else {
                    hurt = true
                }
            }
        }
        self.enemies.retain(|e| !(e.dead == 0 && e.hp <= 0));
        for b in shots {
            self.bullets.push(b);
            self.sound(4)
        }
        if hurt {
            self.damage()
        }
    }
    fn enter(&mut self, id: usize) {
        self.store = id;
        self.p.pose = 0;
        self.p.floor = STORES[id].floor;
        self.transition(Scene::Store);
        self.p.safe = (STORES[id].x - 8, STORES[id].floor);
        self.p.x = 122;
        self.p.y = 148;
        self.p.face = 0;
        self.p.inv = 120;
        self.bullets.clear();
        self.enemies.clear();
        self.toys.clear();
        self.bonus_track = false;
        self.first_t = if self.visited[id] { 0 } else { 150 };
        self.visited[id] = true;
        self.rooms[id].visited = true;
        self.joke_phase = if id == 3 && self.joke.is_none() { 1 } else { 0 };
        let n = 1 + self.rng.range(3);
        for i in 0..n {
            self.enemies.push(Enemy {
                x: 95 + i as i32 * 27,
                y: 85,
                floor: STORES[id].floor,
                age: 0,
                aim: 0,
                cooldown: 120,
                dir: 1,
                duck: false,
                hp: if i == 2 { 3 } else { 1 },
                dead: 0,
                bot: i == 2,
                stun: 0,
                high: true,
                volley: 0,
            });
        }
        let idx = visit_index(id);
        self.say(copy::VISITS[idx].0);
    }
    fn room_tick(&mut self, h: u32, e: u32) {
        self.first_t = self.first_t.saturating_sub(1);
        if self.first_t == 90 {
            self.say(copy::VISITS[visit_index(self.store)].1)
        }
        if self.joke_phase > 0 && self.joke_phase < 240 {
            self.joke_phase += 1;
            if self.joke_phase < 180 {
                return;
            }
            if self.joke_phase == 180 {
                self.say("TAKE THIS. NO REFUNDS.")
            }
            self.joke_phase = 240;
        }
        if self.joke_phase == 240 && overlap(self.p.x, self.p.y, 12, 12, 119, 88, 18, 18) {
            let item = self.rng.range(5) as usize;
            self.joke = Some(item);
            self.joke_phase = 241;
            self.points(1);
            self.say(format!("YOU GOT: {}", copy::ITEMS[item]));
            self.sound(8);
        }
        if self.p.stun == 0 && self.p.pose == 0 {
            let dir = if h & UP != 0 {
                Some(0)
            } else if h & DOWN != 0 {
                Some(1)
            } else if h & LEFT != 0 {
                Some(2)
            } else if h & RIGHT != 0 {
                Some(3)
            } else {
                None
            };
            if let Some((idx, t, face)) = self.search {
                let changed = e & (UP | DOWN | LEFT | RIGHT) != 0 && dir.is_some_and(|d| d != face);
                if changed || e & A != 0 {
                    self.search = None;
                } else if t <= 1 {
                    self.finish_search(idx);
                    self.search = None;
                } else {
                    self.search = Some((idx, t - 1, face));
                }
            }
            if self.search.is_none() {
                if let Some(d) = dir {
                    self.p.face = d;
                    let (dx, dy) = [(0, -1), (0, 1), (-1, 0), (1, 0)][d];
                    let speed = if self.p.speed > 0 { 2 } else { 1 };
                    for _ in 0..speed {
                        let nx = self.p.x + dx;
                        let ny = self.p.y + dy;
                        if !self.rooms[self.store].solid(nx, ny) {
                            self.p.x = nx;
                            self.p.y = ny;
                        } else {
                            for s in [-1, 1] {
                                let ax = nx + if dy != 0 { s } else { 0 };
                                let ay = ny + if dx != 0 { s } else { 0 };
                                if !self.rooms[self.store].solid(ax, ay) {
                                    self.p.x = ax;
                                    self.p.y = ay;
                                    break;
                                }
                            }
                        }
                    }
                }
                if e & B != 0 {
                    if let Some(idx) = self.touch_fixture() {
                        let f = &self.rooms[self.store].fixtures[idx];
                        self.p.face = if (self.p.x + 6 - f.x - f.w / 2).abs()
                            > (self.p.y + 6 - f.y - f.h / 2).abs()
                        {
                            if self.p.x < f.x {
                                3
                            } else {
                                2
                            }
                        } else if self.p.y < f.y {
                            1
                        } else {
                            0
                        };
                        self.search =
                            Some((idx, if self.p.speed > 0 { 24 } else { 45 }, self.p.face));
                        self.sound(6)
                    }
                }
            }
            if e & A != 0 || h & A != 0 && self.p.weapon == 1 {
                self.search = None;
                self.shoot()
            }
        }
        if self.p.y >= 155 && (self.p.x - 122).abs() < 19 && h & DOWN != 0 {
            let s = STORES[self.store];
            self.transition(Scene::Mall);
            self.p.x = s.x - 8;
            self.p.floor = s.floor;
            self.p.y = FLOOR[s.floor];
            self.p.inv = 90;
            self.bullets.clear();
            self.enemies.clear();
            self.toys.clear();
            self.bonus_track = false;
            return;
        }
        if self.store == 7
            && overlap(self.p.x, self.p.y, 12, 12, 200, 144, 28, 20)
            && !self.bonus_track
        {
            self.bonus_track = true;
            self.say("NOW PLAYING: SIDE B");
            self.sound(8)
        }
        self.spy_tick(true);
        for toy in &mut self.toys {
            toy.ttl = toy.ttl.saturating_sub(1);
            let nx = toy.x + toy.dx;
            if self.rooms[self.store].solid(nx, toy.y) {
                toy.dx *= -1
            } else {
                toy.x = nx
            }
            for en in &mut self.enemies {
                if (en.x - toy.x).abs() < 18 && (en.y - toy.y).abs() < 18 {
                    en.stun = 180
                }
            }
            for f in &mut self.rooms[self.store].fixtures {
                if f.content == 11
                    && !f.open
                    && overlap(toy.x, toy.y, 8, 8, f.x - 4, f.y - 4, f.w + 8, f.h + 8)
                {
                    f.open = true;
                    for en in &mut self.enemies {
                        if (en.x - f.x).abs() < 60 && (en.y - f.y).abs() < 60 {
                            en.stun = 180
                        }
                    }
                }
            }
        }
        self.toys.retain(|t| t.ttl > 0);
    }
    pub fn touch_fixture(&self) -> Option<usize> {
        self.rooms[self.store]
            .fixtures
            .iter()
            .enumerate()
            .filter(|(_, f)| !f.open)
            .find(|(_, f)| overlap(self.p.x - 3, self.p.y - 3, 18, 18, f.x, f.y, f.w, f.h))
            .map(|(i, _)| i)
    }
    fn finish_search(&mut self, idx: usize) {
        let f = self.rooms[self.store].fixtures[idx].clone();
        if f.kind == 1 && self.rng.range(4) == 0 {
            self.say("OCCUPIED!!");
            self.sound(13);
            self.enemies.push(Enemy {
                x: self.p.x,
                y: self.p.y - 26,
                floor: self.p.floor,
                age: 0,
                aim: 0,
                cooldown: 120,
                dir: 1,
                duck: false,
                hp: 1,
                dead: 0,
                bot: false,
                stun: 30,
                high: true,
                volley: 0,
            });
            self.bullets.push(Bullet {
                x: f.x,
                y: f.y + 10,
                dx: 0,
                dy: 2,
                enemy: true,
                ttl: 80,
                volley: 0,
            });
            return;
        }
        self.rooms[self.store].fixtures[idx].open = true;
        match f.content {
            0 => {
                self.say("NOTHING HERE");
                self.sound(6)
            }
            1 => {
                if !self.packages[self.store] {
                    self.packages[self.store] = true;
                    self.p.pose = 60;
                    self.p.item = 1;
                    self.points(500);
                    self.say(format!("PACKAGE {}/6", self.count()));
                    self.sound(8);
                    self.p.inv = 120;
                }
            }
            11 => {
                self.p.stun = 60;
                self.say("IT'S A TRAP!");
                self.sound(13)
            }
            k => self.power(k),
        }
    }
    fn projectiles(&mut self) {
        let room = self.scene == Scene::Store;
        let mut bs = std::mem::take(&mut self.bullets);
        for b in &mut bs {
            b.x += b.dx;
            b.y += b.dy;
            b.ttl = b.ttl.saturating_sub(1);
            if b.x < 0 || b.x > if room { 256 } else { 768 } || b.y < 0 || b.y > 320 {
                b.ttl = 0;
                continue;
            }
            if room && self.rooms[self.store].solid(b.x, b.y) {
                b.ttl = 0;
                if self.store == 4 && !b.enemy && self.toys.len() < 6 {
                    for d in [-1, 1, 1] {
                        self.toys.push(Drop {
                            x: b.x,
                            y: b.y + 25,
                            dx: d,
                            dy: 0,
                            kind: 0,
                            ttl: 600,
                        })
                    }
                    self.sound(15)
                }
                continue;
            }
            if b.enemy {
                let y = if room {
                    self.p.y
                } else {
                    self.p.y - if self.p.duck { 11 } else { 23 }
                };
                if overlap(
                    b.x,
                    b.y,
                    3,
                    2,
                    self.p.x,
                    y,
                    12,
                    if room || self.p.duck { 12 } else { 23 },
                ) {
                    self.damage();
                    b.ttl = 0;
                }
                continue;
            }
            for en in &mut self.enemies {
                if en.hp <= 0 || en.dead > 0 {
                    continue;
                }
                let y = if room { en.y } else { en.y - 23 };
                if !room && en.volley != b.volley && (b.x - en.x).abs() < 48 {
                    en.volley = b.volley;
                    en.duck = self.rng.range(10) == 0
                }
                if overlap(
                    b.x,
                    b.y,
                    3,
                    2,
                    en.x,
                    y + if en.duck { 12 } else { 0 },
                    14,
                    if room || en.duck { 12 } else { 24 },
                ) {
                    en.hp -= 1;
                    b.ttl = 0;
                    if en.hp <= 0 {
                        en.dead = 24;
                        self.score += 100;
                        self.hi = self.hi.max(self.score);
                        self.sounds.push(5);
                        if self.rng.range(100) < 35 {
                            self.bubbles.push(Bubble {
                                x: en.x,
                                y: y - 10,
                                text: copy::LAST[self.rng.range(8) as usize].into(),
                                time: 90,
                            });
                        }
                        if self.rng.range(20) == 0 {
                            let kind = if self.rng.range(2) == 0 {
                                8 + self.rng.range(3) as u8
                            } else {
                                2 + self.rng.range(6) as u8
                            };
                            self.drops.push(Drop {
                                x: en.x,
                                y: if room { en.y } else { en.y - 8 },
                                dx: 0,
                                dy: 0,
                                kind,
                                ttl: 600,
                            });
                        }
                    }
                    break;
                }
            }
            if !room {
                for lamp in &mut self.lamps {
                    if !lamp.broken
                        && !lamp.active
                        && (b.x - lamp.x).abs() < 8
                        && b.y >= lamp.y - 12
                        && b.y <= lamp.y + 18
                    {
                        lamp.active = true;
                        lamp.vy = 1;
                        lamp.roll = if lamp.floor == 3 {
                            b.dx.signum() * 2
                        } else {
                            0
                        };
                        b.ttl = 0;
                        self.sounds.push(5);
                    }
                }
                for (idx, (floor, x)) in [(2, 245), (4, 645)].iter().enumerate() {
                    if self.fountains[idx] == 0
                        && (b.x - x).abs() < 16
                        && (b.y - FLOOR[*floor] + 15).abs() < 12
                    {
                        self.fountains[idx] = 900;
                        b.ttl = 0;
                        for k in 0..(3 + self.rng.range(3)) {
                            let gold = self.rng.range(20) == 0 && k == 0;
                            self.drops.push(Drop {
                                x: *x,
                                y: FLOOR[*floor] - 18,
                                dx: k as i32 - 2,
                                dy: -4,
                                kind: if gold { 7 } else { 12 },
                                ttl: 500,
                            });
                        }
                        self.sounds.push(11);
                    }
                }
                if self.p.floor == 3 {
                    for x in self.walk {
                        if (b.x - x).abs() < 9 && (b.y - FLOOR[3] + 12).abs() < 13 {
                            b.ttl = 0;
                            self.points(-200);
                            self.bubbles.push(Bubble {
                                x,
                                y: FLOOR[3] - 28,
                                text: "HEY!".into(),
                                time: 90,
                            });
                        }
                    }
                }
                if (b.x - self.cop_x).abs() < 9 && (b.y - FLOOR[self.cop_floor] + 12).abs() < 13 {
                    b.ttl = 0;
                    self.sound(3)
                }
            }
        }
        bs.retain(|b| b.ttl > 0);
        self.bullets.extend(bs);
    }
    fn lamp_tick(&mut self) {
        let mut hurt = false;
        let mut points = 0;
        for l in &mut self.lamps {
            l.dark = l.dark.saturating_sub(1);
            if !l.active || l.broken {
                continue;
            }
            l.vy = (l.vy + 1).min(5);
            l.y = (l.y + l.vy).min(FLOOR[l.floor] - 5);
            if l.y == FLOOR[l.floor] - 5 {
                l.dark = 120;
                self.shake = 6;
                if l.roll == 0 {
                    l.broken = true;
                    self.sounds.push(5)
                } else {
                    l.x += l.roll;
                    if l.x < 8
                        || l.x > 756
                        || self
                            .lifts
                            .iter()
                            .any(|e| (l.x - e.x).abs() < 12 && e.y > FLOOR[l.floor])
                    {
                        l.broken = true
                    }
                }
            }
            for e in &mut self.enemies {
                if e.hp > 0
                    && e.dead == 0
                    && e.floor == l.floor
                    && (e.x - l.x).abs() < 15
                    && (e.y - l.y).abs() < 24
                {
                    e.hp = 0;
                    e.dead = 24;
                    points += 300;
                }
            }
            if self.p.floor == l.floor && (self.p.x - l.x).abs() < 14 && (self.p.y - l.y).abs() < 24
            {
                hurt = true
            }
        }
        if points > 0 {
            self.points(points);
            self.sound(5)
        }
        if hurt {
            self.damage()
        }
    }
    fn pickups(&mut self) {
        let room = self.scene == Scene::Store;
        let mut got = Vec::new();
        for d in &mut self.drops {
            d.ttl = d.ttl.saturating_sub(1);
            d.x += d.dx;
            if d.dy != 0 {
                d.y += d.dy;
                if self.frame % 3 == 0 {
                    d.dy += 1
                }
                let ground = if room {
                    160
                } else {
                    FLOOR[nearest_floor(d.y + 10)] - 6
                };
                if d.y >= ground && d.dy > 0 {
                    d.y = ground;
                    d.dy = 0;
                    d.dx = 0
                }
            }
            if (d.x - self.p.x).abs() < 16 && (d.y - self.p.y).abs() < 20 {
                got.push(d.kind);
                d.ttl = 0
            }
        }
        self.drops.retain(|d| d.ttl > 0);
        for k in got {
            if k == 12 {
                self.p.pose = 45;
                self.p.item = k;
                self.points(50);
                self.sound(11)
            } else {
                self.power(k)
            }
        }
    }
    fn npcs(&mut self) {
        self.wet_t = self.wet_t.saturating_sub(1);
        self.janitor = 300 + ((self.level_t / 3) % 160) as i32;
        if self.level_t % 600 == 1 {
            self.wet_x = self.janitor.clamp(280, 310);
            self.wet_t = 600;
        }
        if self.p.floor == 4
            && self.wet_t > 0
            && self.p.x >= self.wet_x
            && self.p.x < self.wet_x + 48
        {
            if self.p.sliding == 0 {
                self.p.sliding = self.p.dir;
                self.sound(15)
            }
        } else {
            self.p.sliding = 0
        }
        self.walk = [
            260 + ((self.level_t / 2) % 90) as i32,
            550 + ((self.level_t / 2) % 90) as i32,
        ];
        for x in self.walk {
            if self.p.floor == 3 && (self.p.x - x).abs() < 14 {
                self.p.x += 1
            }
        }
        self.cop_t = self.cop_t.saturating_sub(1);
        if self.cop_t > 0 && self.p.floor == self.cop_floor {
            self.cop_dir = (self.p.x - self.cop_x).signum();
            self.cop_x += self.cop_dir;
            if (self.p.x - self.cop_x).abs() < 14 {
                self.p.stun = 180;
                self.points(-500);
                self.cop_t = 0;
                self.say("DETAINED! -500");
                self.sound(13)
            }
        } else if self.frame % 2 == 0 {
            self.cop_x += self.cop_dir;
            if self.cop_x < 420 || self.cop_x > 680 {
                self.cop_dir *= -1
            }
        }
    }
    pub fn debug(&mut self, op: u32, a: i32, b: i32) {
        match op {
            0 => {
                self.setup();
                self.transition(Scene::Mall)
            }
            1 => {
                self.p.floor = (a as usize).min(5);
                self.p.x = b.clamp(8, 744);
                self.p.y = FLOOR[self.p.floor];
                self.p.lift = None;
                self.p.roof = None;
                self.p.falling = false;
                self.p.inv = 120
            }
            2 => self.enter((a as usize).min(12)),
            3 => {
                self.p.x = a;
                self.p.y = b;
            }
            4 => {
                self.p.inv = 0;
                self.p.food = 0;
                self.p.armor = false;
                self.damage()
            }
            5 => {
                for (i, s) in STORES.iter().enumerate() {
                    if s.role == 0 {
                        self.packages[i] = true
                    }
                }
            }
            6 => self.power(a as u8),
            7 => {
                self.lives = 1;
                self.p.inv = 0;
                self.damage()
            }
            8 => {
                self.continues = 0;
                self.lives = 1;
                self.p.inv = 0;
                self.damage()
            }
            9 => self.spawn_spy(),
            _ => (),
        }
    }
}
pub fn nearest_floor(y: i32) -> usize {
    FLOOR
        .iter()
        .enumerate()
        .min_by_key(|(_, v)| (**v - y).abs())
        .unwrap()
        .0
}
pub fn floor_name(f: usize) -> &'static str {
    ["R", "4F", "3F", "2F", "1F", "P"][f]
}
pub fn overlap(x: i32, y: i32, w: i32, h: i32, a: i32, b: i32, c: i32, d: i32) -> bool {
    x < a + c && x + w > a && y < b + d && y + h > b
}
fn line_clear(r: &Room, x: i32, y: i32, a: i32, b: i32) -> bool {
    if (x - a).abs() > 12 && (y - b).abs() > 12 {
        return false;
    }
    let steps = (x - a).abs().max((y - b).abs()).max(1);
    (1..steps).all(|i| {
        !r.fixtures.iter().any(|f| {
            overlap(
                x + (a - x) * i / steps,
                y + (b - y) * i / steps,
                1,
                1,
                f.x,
                f.y,
                f.w,
                f.h,
            )
        })
    })
}
pub fn visit_index(id: usize) -> usize {
    match id {
        0 => 0,
        1 => 1,
        2 => 2,
        3 => 3,
        4 => 4,
        6 => 5,
        7 => 6,
        8 => 7,
        9 => 8,
        _ => 9,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn playing() -> Game {
        let mut g = Game::new(123, true);
        g.transition(Scene::Mall);
        g
    }
    #[test]
    fn rng_replays() {
        let mut a = Rng(42);
        let mut b = Rng(42);
        for _ in 0..1000 {
            assert_eq!(a.next(), b.next())
        }
    }
    #[test]
    fn simulation_replays() {
        let mut a = playing();
        let mut b = playing();
        for i in 0..3000 {
            let h = if i % 200 < 100 { RIGHT } else { LEFT };
            a.tick(h, 0);
            b.tick(h, 0);
            assert_eq!((a.p.x, a.score, a.rng.0), (b.p.x, b.score, b.rng.0));
        }
    }
    #[test]
    fn layout_and_contents() {
        for black in [false, true] {
            for seed in 1..100 {
                let mut rng = Rng(seed);
                for (i, s) in STORES.iter().enumerate() {
                    let r = Room::new(i, &mut rng, black);
                    assert_eq!(
                        r.fixtures.iter().filter(|f| f.content == 1).count(),
                        if s.role == 0 { 1 } else { 0 }
                    );
                    assert!(r
                        .fixtures
                        .iter()
                        .all(|f| f.x >= 0 && f.y >= 0 && f.x + f.w <= r.w && f.y + f.h <= r.h));
                    if s.role == 1 {
                        assert!(r.fixtures.iter().all(|f| f.content != 11))
                    }
                    if black {
                        assert!(r.fixtures.iter().all(|f| f.content >= 1 && f.content <= 10))
                    }
                    assert!(!r.solid(122, 148));
                }
            }
        }
    }
    #[test]
    fn reachable_floors() {
        let g = playing();
        let mut seen = [false; 6];
        seen[0] = true;
        for _ in 0..6 {
            for l in &g.lifts {
                if (l.min..=l.max).any(|f| seen[f]) {
                    for f in l.min..=l.max {
                        seen[f] = true
                    }
                }
            }
        }
        assert!(seen.iter().all(|f| *f));
    }
    #[test]
    fn elevator_glides_and_dings_once() {
        let mut g = playing();
        g.p.lift = Some(0);
        g.tick(DOWN, DOWN);
        for _ in 0..60 {
            g.tick(0, 0)
        }
        assert_eq!(g.lifts[0].y, 88);
        assert!(g.lifts[0].stopped);
        assert_eq!(g.sounds.iter().filter(|&&n| n == 3).count(), 1);
        for _ in 0..100 {
            g.tick(0, 0)
        }
        assert_eq!(g.sounds.iter().filter(|&&n| n == 3).count(), 1)
    }
    #[test]
    fn endpoint_no_repeat_ding() {
        let mut g = playing();
        g.p.lift = Some(0);
        for _ in 0..300 {
            g.tick(UP, 0)
        }
        assert_eq!(g.lifts[0].y, 40);
        assert_eq!(g.sounds.iter().filter(|&&n| n == 3).count(), 0)
    }
    #[test]
    fn called_car_collects_rider() {
        let mut g = playing();
        g.p.floor = 2;
        g.p.y = 136;
        g.p.x = 162;
        g.p.inv = 0;
        g.tick(UP, UP);
        for _ in 0..110 {
            g.tick(0, 0)
        }
        assert_eq!(g.lives, 3);
        assert_eq!(g.p.lift, Some(0));
    }
    #[test]
    fn automatic_waits_for_rider() {
        let mut g = playing();
        g.p.lift = Some(2);
        for _ in 0..300 {
            g.tick(0, 0)
        }
        assert_eq!(g.lifts[2].y, 40)
    }
    #[test]
    fn jump_arc_lands() {
        let mut g = playing();
        g.p.x = 250;
        g.tick(B, B);
        let mut min = g.p.y;
        for _ in 0..50 {
            g.tick(0, 0);
            min = min.min(g.p.y);
        }
        assert!((16..=30).contains(&(40 - min)));
        assert_eq!(g.p.y, 40);
        assert_eq!(g.p.jump, 0)
    }
    #[test]
    fn safe_and_fatal_fall() {
        let mut g = playing();
        g.p.x = 162;
        g.p.inv = 0;
        g.lifts[0].y = 88;
        for _ in 0..20 {
            g.tick(0, 0)
        }
        assert_eq!(g.lives, 3);
        assert_eq!(g.p.roof, Some(0));
        let mut g = playing();
        g.p.x = 162;
        g.p.inv = 0;
        g.lifts[0].y = 184;
        for _ in 0..40 {
            g.tick(0, 0)
        }
        assert_eq!(g.lives, 2);
    }
    #[test]
    fn score_life_threshold() {
        let mut g = playing();
        g.points(19999);
        assert_eq!(g.lives, 3);
        g.points(1);
        assert_eq!(g.lives, 4);
        g.points(500);
        assert_eq!(g.lives, 4);
        g.points(-100000);
        assert_eq!(g.score, 0)
    }
    #[test]
    fn weapon_slots_stack_and_expire() {
        let mut g = playing();
        g.power(2);
        g.power(4);
        g.power(6);
        g.power(3);
        assert_eq!(g.p.weapon, 2);
        assert!(g.p.armor && g.p.radar);
        g.enter(0);
        g.p.weapon_t = 2;
        g.tick(0, 0);
        g.tick(0, 0);
        assert_eq!(g.p.weapon, 0)
    }
    #[test]
    fn pause_freezes_all_timers() {
        let mut g = playing();
        g.power(2);
        g.tick(START, START);
        let t = g.p.weapon_t;
        let level = g.level_t;
        for _ in 0..100 {
            g.tick(0, 0)
        }
        assert_eq!(g.p.weapon_t, t);
        assert_eq!(g.level_t, level);
        g.tick(START, START);
        g.tick(SELECT, SELECT);
        let t = g.p.weapon_t;
        for _ in 0..100 {
            g.tick(0, 0)
        }
        assert_eq!(g.p.weapon_t, t);
    }
    #[test]
    fn armor_and_death() {
        let mut g = playing();
        g.p.inv = 0;
        g.power(4);
        g.damage();
        assert_eq!(g.lives, 3);
        assert!(!g.p.armor);
        g.p.inv = 0;
        g.power(6);
        g.power(2);
        g.damage();
        assert_eq!(g.lives, 2);
        assert_eq!(g.p.weapon, 0);
        assert!(g.p.radar);
        assert!(g.p.inv > 0)
    }
    #[test]
    fn search_single_tap_and_persistence() {
        let mut g = playing();
        g.enter(1);
        let f = g.rooms[1].fixtures[0].clone();
        g.p.x = f.x + 6;
        g.p.y = f.y + f.h;
        g.tick(B, B);
        assert!(g.search.is_some());
        for _ in 0..46 {
            g.tick(0, 0)
        }
        assert!(g.rooms[1].fixtures[0].open);
        g.enter(1);
        assert!(g.rooms[1].fixtures[0].open);
    }
    #[test]
    fn search_side_and_cancel() {
        let mut g = playing();
        g.enter(1);
        let f = g.rooms[1].fixtures[0].clone();
        g.p.x = f.x - 12;
        g.p.y = f.y + 5;
        g.tick(B, B);
        assert_eq!(g.p.face, 3);
        assert!(g.search.is_some());
        g.tick(UP, UP);
        assert!(g.search.is_none());
    }
    #[test]
    fn holding_search_does_not_repeat() {
        let mut g = playing();
        g.enter(1);
        let f = g.rooms[1].fixtures[0].clone();
        g.p.x = f.x + 4;
        g.p.y = f.y + f.h;
        g.tick(B, B);
        for _ in 0..100 {
            g.tick(B, 0)
        }
        assert_eq!(g.rooms[1].fixtures.iter().filter(|f| f.open).count(), 1);
    }
    #[test]
    fn package_idempotent() {
        let mut g = playing();
        g.enter(1);
        let i = g.rooms[1]
            .fixtures
            .iter()
            .position(|f| f.content == 1)
            .unwrap();
        g.finish_search(i);
        let s = g.score;
        g.finish_search(i);
        assert_eq!(g.count(), 1);
        assert_eq!(g.score, s);
    }
    #[test]
    fn exit_requires_all_and_fires_once() {
        let mut g = playing();
        g.debug(1, 5, 630);
        g.tick(UP, UP);
        assert_eq!(g.scene, Scene::Mall);
        g.debug(5, 0, 0);
        g.tick(UP, UP);
        assert_eq!(g.scene, Scene::Clear);
        let score = g.score;
        g.tick(UP, UP);
        assert_eq!(g.score, score);
    }
    #[test]
    fn continues_keep_progress() {
        let mut g = playing();
        g.packages[0] = true;
        g.score = 1234;
        g.loop_n = 3;
        g.debug(7, 0, 0);
        assert_eq!(g.scene, Scene::Continue);
        g.tick(START, START);
        assert_eq!(g.lives, 3);
        assert_eq!(g.continues, 2);
        assert_eq!(g.count(), 1);
        assert_eq!(g.score, 1234);
        assert_eq!(g.loop_n, 3);
    }
    #[test]
    fn continue_timeout_and_game_over() {
        let mut g = playing();
        g.debug(7, 0, 0);
        for _ in 0..600 {
            g.tick(0, 0)
        }
        assert_eq!(g.scene, Scene::Over);
    }
    #[test]
    fn konami_overlapping_prefix() {
        let mut g = Game::new(1, true);
        for b in [UP, UP, UP, UP, DOWN, DOWN, LEFT, RIGHT, LEFT, RIGHT, B, A] {
            g.tick(b, b)
        }
        assert!(g.black);
    }
    #[test]
    fn spy_grace_and_telegraph() {
        let mut g = playing();
        g.debug(1, 1, 140);
        g.spawn_spy();
        if g.enemies.is_empty() {
            g.enemies.push(Enemy {
                x: 80,
                y: 88,
                floor: 1,
                age: 0,
                aim: 0,
                cooldown: 120,
                dir: 1,
                duck: false,
                hp: 1,
                dead: 0,
                bot: false,
                stun: 0,
                high: true,
                volley: 0,
            })
        }
        for _ in 0..119 {
            g.spy_tick(false);
            assert!(g.bullets.is_empty())
        }
        g.spy_tick(false);
        assert_eq!(g.enemies[0].aim, 29);
        for _ in 0..28 {
            g.spy_tick(false);
            assert!(g.bullets.is_empty())
        }
        g.spy_tick(false);
        assert!(!g.bullets.is_empty());
    }
    #[test]
    fn wet_patch_avoids_shafts() {
        let mut g = playing();
        for i in 0..1800 {
            g.level_t = i;
            g.npcs();
            assert!(g
                .lifts
                .iter()
                .all(|l| l.x < g.wet_x - 20 || l.x > g.wet_x + 68));
        }
    }
    #[test]
    fn photo_booth_inventory() {
        let mut g = playing();
        g.p.hidden = 1;
        g.timers();
        assert!(g.photo);
    }
    #[test]
    fn gamestonk_item_once() {
        let mut g = playing();
        g.enter(3);
        for _ in 0..180 {
            g.tick(0, 0)
        }
        g.p.x = 120;
        g.p.y = 90;
        g.tick(0, 0);
        assert!(g.joke.is_some());
        let score = g.score;
        g.enter(3);
        assert_eq!(g.joke_phase, 0);
        assert_eq!(g.score, score);
    }
    #[test]
    fn copy_limits() {
        for (a, b, c) in copy::ARRIVAL.into_iter().chain(copy::COMPLETE) {
            assert!(a.chars().count() <= 21, "{a}");
            assert!(b.chars().count() <= 21, "{b}");
            assert!(c.chars().count() <= 21, "{c}")
        }
        for s in copy::LAST
            .into_iter()
            .chain(copy::LIFT)
            .chain(copy::VISITS.into_iter().flat_map(|(a, b)| [a, b]))
        {
            assert!(s.len() <= 28, "{s}")
        }
        for s in copy::HEADLINES {
            assert!(s.split_whitespace().all(|w| w.len() <= 26))
        }
    }
}
