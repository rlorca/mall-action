//! The side-scroller mall: physics, elevators, escalators, spies, lights and NPCs.
//! Mirrors `game/mall/` of the TypeScript source.

pub mod cars;
pub mod geometry;
pub mod modules;
pub mod spies;
pub mod testutil;
pub mod types;
pub mod world;

#[cfg(test)]
mod fairness_test;
#[cfg(test)]
mod mall_test;
#[cfg(test)]
mod route_test;
#[cfg(test)]
mod spies_test;
