use super::mapdata::{MapCar, MapData, MapPlayer};
use crate::content::stores::STORE_IDS;
use crate::game::levelstate::{store_status, StoreStatus};
use crate::game::run::Run;

/// The MALL DIRECTORY overlay needs no state of its own (the Game decides when Select opens and closes it,
/// and `MapData.frame` drives the blinking), so this file only offers a helper that fills a MapData from
/// the Run and the mall world. The drawing lives in `render/map_view.rs` (`draw_map_view(fb, data)`).
pub fn build_map_data(run: &Run, frame: i32, cars: &[MapCar], player: MapPlayer) -> MapData {
    let mut statuses = [StoreStatus::Closed; 13];
    for id in STORE_IDS {
        statuses[id as usize] = store_status(&run.level, id);
    }
    MapData {
        frame,
        cars: cars.iter().map(|c| MapCar { shaft: c.shaft, y: c.y }).collect(),
        player,
        statuses,
        radar: run.power.radar,
        inventory: run.inventory_line(),
        black_friday: run.black_friday,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::layout::ShaftId;
    use crate::content::stores::{StoreId, StoreRole, STORES};
    use crate::game::levelstate::{LevelState, StoreState};
    use crate::game::run::RunOpts;

    fn level_with(taken: &[&str]) -> LevelState {
        let mut level = LevelState::new(1, 1, false);
        for s in STORES.iter() {
            if s.role == StoreRole::Closed {
                continue;
            }
            level.set_store(s.id, StoreState { id: s.id, fixtures: vec![], package_taken: taken.contains(&s.id.as_str()) });
        }
        level
    }

    #[test]
    fn maps_store_roles_and_package_state_to_the_four_directory_colours() {
        let mut run = Run::new(1, RunOpts::default());
        run.level = level_with(&["forever12"]);
        let d = build_map_data(&run, 77, &[MapCar { shaft: ShaftId::A, y: 160.0 }], MapPlayer { x: 100.0, y: 208.0, in_store: None });
        assert_eq!(d.statuses.len(), STORE_IDS.len());
        assert_eq!(d.status(StoreId::Forever12), StoreStatus::Cleared);
        assert_eq!(d.status(StoreId::Radioshock), StoreStatus::Package);
        assert_eq!(d.status(StoreId::Crookstone), StoreStatus::Powerup);
        assert_eq!(d.status(StoreId::Blockbluster), StoreStatus::Closed);
        assert_eq!(d.frame, 77);
        assert_eq!(d.cars, vec![MapCar { shaft: ShaftId::A, y: 160.0 }]);
    }

    #[test]
    fn reflects_radar_inventory_and_black_friday() {
        let mut run = Run::new(1, RunOpts { black_friday: true, ..Default::default() });
        run.level = level_with(&[]);
        run.power.radar = true;
        run.add_joke("PET ROCK");
        let d = build_map_data(&run, 0, &[], MapPlayer { x: 0.0, y: 112.0, in_store: Some(StoreId::Hotspy) });
        assert!(d.radar);
        assert_eq!(d.inventory, "PET ROCK");
        assert!(d.black_friday);
        assert_eq!(d.player.in_store, Some(StoreId::Hotspy));
    }
}
