//! Dev tool: render a track or sound effect to a 16-bit mono WAV.
//! usage: render_wav <name> <seconds> <out.wav> [sample_rate]
//! <name> is a Track or Sfx variant, case-insensitive (`title`, `kgbtoys`, `store(samBaddy)`, `ding`, `hum`).
use mall_core::audio::{songs, sfx, Synth};
use mall_core::events::Track;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() < 4 {
        eprintln!("usage: render_wav <name> <seconds> <out.wav> [sample_rate]\ntracks:");
        for t in songs::all_tracks() {
            eprintln!("  {t:?}");
        }
        eprintln!("sfx:");
        for s in sfx::all_sfx() {
            eprintln!("  {s:?}");
        }
        return;
    }
    if a[1] == "bench" {
        // 1024-sample block cost with music + 6 sfx + hum
        let mut s = Synth::new(48000);
        s.set_track(Track::Title);
        s.set_hum(true);
        let mut buf = vec![0.0f32; 1024];
        let t0 = std::time::Instant::now();
        let blocks = 20000;
        for i in 0..blocks {
            if i % 10 == 0 {
                for x in sfx::all_sfx().into_iter().take(6) {
                    s.play_sfx(x);
                }
            }
            s.render(&mut buf);
        }
        println!("{:.1} us per 1024-sample block", t0.elapsed().as_secs_f64() * 1e6 / blocks as f64);
        return;
    }
    let name = a[1].to_lowercase();
    let secs: f32 = a[2].parse().expect("seconds");
    let sr: u32 = a.get(4).map(|s| s.parse().expect("sample rate")).unwrap_or(44100);
    let mut synth = Synth::new(sr);
    let norm = |s: String| s.to_lowercase().replace(['(', ')', ':', ' '], "");
    let want = norm(name.clone());
    if want == "hum" {
        synth.set_hum(true);
    } else if let Some(t) = songs::all_tracks().into_iter().find(|t| {
        let d = norm(format!("{t:?}"));
        d == want || d == format!("store{want}")
    }) {
        synth.set_track(t);
    } else if let Some(s) = sfx::all_sfx().into_iter().find(|s| norm(format!("{s:?}")) == want) {
        synth.play_sfx(s);
    } else {
        eprintln!("unknown name {name}");
        std::process::exit(1);
    }
    let _ = Track::Silence;
    let n = (secs * sr as f32) as usize;
    let mut buf = vec![0.0f32; n];
    for chunk in buf.chunks_mut(1024) {
        synth.render(chunk);
    }
    let rms = (buf.iter().map(|x| x * x).sum::<f32>() / n as f32).sqrt();
    let peak = buf.iter().fold(0.0f32, |m, x| m.max(x.abs()));
    println!("{n} samples @ {sr} Hz, rms {rms:.3}, peak {peak:.3}, music_finished={}", synth.music_finished());
    let mut out = Vec::with_capacity(44 + n * 2);
    let data = (n * 2) as u32;
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&sr.to_le_bytes());
    out.extend_from_slice(&(sr * 2).to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data.to_le_bytes());
    for s in &buf {
        out.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    std::fs::write(&a[3], out).expect("write wav");
}
