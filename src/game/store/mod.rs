//! Top-down store rooms (TS `store/index.ts`). Re-exports mirror the TS barrel.
pub mod collision;
pub mod levelgen;
pub mod room;
pub mod testutil;
pub mod world;

pub use levelgen::generate_level;
pub use room::{fixture_count, get_room, parse_room, validate_room, FixtureSpot, GuardSpawn, Room, TileKind, ROOM_GRIDS, TILE};
pub use world::{Agent, Bullet, Dir, EggState, Guard, HeldItem, Puff, SearchState, StoreWorld, Toy};

#[cfg(test)]
mod extras_tests;
#[cfg(test)]
mod fairness_tests;
#[cfg(test)]
mod fuzz_tests;
#[cfg(test)]
mod guards_tests;
#[cfg(test)]
mod world_tests;
