use mall_core::audio::*;
fn main() {
    let t0 = std::time::Instant::now();
    for s in all_songs() {
        let t = std::time::Instant::now();
        let pcm = render_song(s);
        eprintln!("{:?}: {} samples, {:.1} ms", s, pcm.len(), t.elapsed().as_secs_f64() * 1000.0);
    }
    let t = std::time::Instant::now();
    for s in all_sfx() {
        let _ = render_sfx(s);
    }
    eprintln!("all sfx {:.1} ms; songs total {:.1} ms", t.elapsed().as_secs_f64() * 1000.0, t0.elapsed().as_secs_f64() * 1000.0);
}
