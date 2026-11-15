use crate::content::layout::ShaftId;
use crate::content::stores::StoreId;
use crate::game::levelstate::StoreStatus;

/// One elevator car as shown on the directory: its shaft and floor y in WORLD pixels.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct MapCar {
    pub shaft: ShaftId,
    pub y: f64,
}

/// The player's world position (feet y). When `in_store` is set the current store blinks instead.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct MapPlayer {
    pub x: f64,
    pub y: f64,
    pub in_store: Option<StoreId>,
}

/// Snapshot the Game hands to the MALL DIRECTORY overlay (Select). The overlay
/// itself lives in screens/mapscreen.rs (state) + render/map_view (drawing).
#[derive(Clone, Debug)]
pub struct MapData {
    /// Sim frame (drives blinking).
    pub frame: i32,
    /// Each elevator car's floor y in WORLD pixels (its floor surface), so the map can show its position.
    pub cars: Vec<MapCar>,
    /// The player's world position (feet y). When `in_store` is set the current store blinks instead.
    pub player: MapPlayer,
    /// package (red) / cleared (grey) / powerup (blue) / closed (dark outline).
    /// TS `Record<StoreId, StoreStatus>`: indexed by `StoreId as usize` (use `status(id)`), 13 entries.
    pub statuses: [StoreStatus; 13],
    /// With the Radar power-up a "!" marks each remaining package store.
    pub radar: bool,
    /// Joke items and the photo strip, e.g. "PET ROCK, PHOTO STRIP" or "NONE YET".
    pub inventory: String,
    /// World x of the getaway station wagon.
    pub black_friday: bool,
}

impl MapData {
    /// TS `data.statuses[id]`.
    pub fn status(&self, id: StoreId) -> StoreStatus {
        self.statuses[id as usize]
    }
}
