//! Debug state summary for `?debug=1` (`window.__mall.state()`), as hand-written JSON (no serde).
use super::game::Game;

fn esc(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            c if (c as u32) < 0x20 => o.push(' '),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}
fn opt(s: Option<&str>) -> String {
    s.map_or("null".to_string(), esc)
}
fn r2(x: f64) -> String {
    format!("{}", (x * 100.0).round() / 100.0)
}

pub fn summary_json(g: &Game) -> String {
    let music = g.music().map(|m| m.as_str());
    let run = match g.run.as_ref() {
        Some(r) => format!(
            "{{\"score\":{},\"lives\":{},\"packages\":{},\"loop\":{},\"continuesLeft\":{},\"alarm\":{},\"levelFrames\":{}}}",
            r.score, r.lives, r.packages(), r.loop_, r.continues_left, r.alarm_on, r.level_frames
        ),
        None => "null".into(),
    };
    let (level, player) = match g.level.as_ref() {
        Some(lv) => {
            let m = &lv.mall;
            let cars: Vec<String> = m.cars.iter().map(|c| format!("{{\"id\":{},\"y\":{},\"dir\":{}}}", esc(c.id.as_str()), r2(c.y), c.dir)).collect();
            let level = format!(
                "{{\"inStore\":{},\"overlay\":{},\"fade\":{},\"intro\":{},\"spies\":{},\"cars\":[{}],\"banner\":{}}}",
                opt(lv.store.as_ref().map(|s| s.store_id.as_str())),
                opt(lv.overlay.map(|o| o.as_str())),
                opt(lv.fade.as_ref().map(|f| f.dir.as_str())),
                opt(m.intro.as_ref().map(|i| i.phase.as_str())),
                m.spies.len(),
                cars.join(","),
                opt(m.banner.as_ref().map(|b| b.text.as_str())),
            );
            let p = &m.player;
            let player = format!(
                "{{\"x\":{},\"y\":{},\"floor\":{},\"mode\":{},\"face\":{},\"car\":{},\"roof\":{}}}",
                r2(p.x), r2(p.y), p.floor.map_or("null".to_string(), |f| f.to_string()), esc(p.mode.as_str()), p.face,
                opt(p.car.map(|c| c.as_str())), opt(p.roof.map(|c| c.as_str()))
            );
            (level, player)
        }
        None => ("null".into(), "null".into()),
    };
    format!("{{\"scene\":{},\"frame\":{},\"music\":{},\"run\":{},\"level\":{},\"player\":{}}}", esc(g.scene.as_str()), g.frame, opt(music), run, level, player)
}
