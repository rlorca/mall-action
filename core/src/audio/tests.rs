use super::score::Song;
use super::*;
use crate::events::{Event, Sfx, Track};
use crate::types::StoreId;

fn render(s: &mut Synth, n: usize) -> Vec<f32> {
    let mut v = vec![0.0; n];
    s.render(&mut v);
    v
}
fn rms(v: &[f32]) -> f32 {
    (v.iter().map(|x| x * x).sum::<f32>() / v.len().max(1) as f32).sqrt()
}
fn peak(v: &[f32]) -> f32 {
    v.iter().fold(0.0, |a, x| a.max(x.abs()))
}
const SR: u32 = 44100;
fn track_synth(t: Track) -> Synth {
    let mut s = Synth::new(SR);
    s.set_track(t);
    s
}
fn hash(v: &[f32]) -> u64 {
    v.iter().fold(1469598103934665603u64, |h, x| (h ^ x.to_bits() as u64).wrapping_mul(1099511628211))
}

#[test]
fn songs_consistent() {
    for t in songs::all_tracks() {
        if let Some(s) = songs::song(t) {
            assert!(s.consistent(), "{:?}: channel ticks {:?} bar {}", t, s.ch.iter().map(|c| c.ticks()).collect::<Vec<_>>(), s.bar_ticks());
        }
    }
}

#[test]
fn every_track_is_audible_and_bounded() {
    for t in songs::all_tracks() {
        if t == Track::Silence {
            assert_eq!(rms(&render(&mut track_synth(t), 20000)), 0.0);
            continue;
        }
        let mut s = track_synth(t);
        let v = render(&mut s, SR as usize * 2);
        assert!(rms(&v) > 0.01, "{:?} too quiet: {}", t, rms(&v));
        assert!(peak(&v) <= 1.0, "{:?} clips", t);
    }
}

#[test]
fn every_sfx_is_audible_bounded_and_finishes() {
    for sfx in sfx::all_sfx() {
        let mut s = Synth::new(SR);
        s.play_sfx(sfx);
        let v = render(&mut s, SR as usize * 3);
        assert!(rms(&v[..SR as usize / 2]) > 0.01, "{:?} silent", sfx);
        assert!(peak(&v) <= 1.0);
        assert_eq!(s.sfx_voices_active(), 0, "{:?} never ends", sfx);
        assert!(rms(&v[SR as usize * 5 / 2..]) < 1e-4, "{:?} tail not silent", sfx);
    }
    assert_eq!(sfx::all_sfx().len(), 35);
}

#[test]
fn deterministic_and_block_size_independent() {
    let script = |block: usize| {
        let mut s = Synth::new(SR);
        s.set_track(Track::Store(StoreId::SamBaddy));
        let mut out = Vec::new();
        let total = SR as usize * 4;
        let mut buf = vec![0.0; block];
        let mut done = 0;
        while done < total {
            let n = block.min(total - done);
            if done == 22050 {
                s.play_sfx(Sfx::Shot);
                s.set_hum(true);
            }
            if done == 66150 {
                s.apply(&Event::MusicVolume(0.3));
            }
            s.render(&mut buf[..n]);
            out.extend_from_slice(&buf[..n]);
            done += n;
        }
        out
    };
    // block sizes that divide the event positions
    let a = script(1);
    let b = script(450);
    let c = script(2205);
    assert_eq!(hash(&a), hash(&b));
    assert_eq!(hash(&a), hash(&c));
    assert_eq!(hash(&a), hash(&script(1)));
}

#[test]
fn render_in_odd_block_sizes_matches() {
    let mut a = track_synth(Track::Title);
    let mut b = track_synth(Track::Title);
    let va = render(&mut a, 30000);
    let mut vb = Vec::new();
    for n in [256, 1024, 333, 2048, 77, 4096, 1000, 5, 1] .iter().cycle() {
        if vb.len() >= 30000 {
            break;
        }
        let n = (*n).min(30000 - vb.len());
        vb.extend(render(&mut b, n));
    }
    assert_eq!(va, vb);
}

#[test]
fn works_at_all_sample_rates() {
    for sr in [22050, 32000, 44100, 48000] {
        let mut s = Synth::new(sr);
        s.set_track(Track::Title);
        s.play_sfx(Sfx::Ding);
        let v = render(&mut s, sr as usize);
        assert!(rms(&v) > 0.01 && peak(&v) <= 1.0, "sr {sr}");
        // tempo should be sample-rate independent: bar 1 of title lasts the same wall time
    }
}

#[test]
fn loops_keep_sounding_for_three_minutes() {
    for t in [Track::Title, Track::MallAmbient, Track::Alarm, Track::Elevator, Track::Booth, Track::Continue, Track::Store(StoreId::KgbToys), Track::Store(StoreId::GameStonk)] {
        let sr = 22050;
        let mut s = Synth::new(sr);
        s.set_track(t);
        let mut buf = vec![0.0; 2048];
        let mut early = 0.0;
        let mut late = 0.0;
        let total = sr as usize * 180;
        let mut done = 0;
        let mut win = Vec::new();
        while done < total {
            s.render(&mut buf);
            done += buf.len();
            if done < sr as usize * 20 {
                early += buf.iter().map(|x| x * x).sum::<f32>();
            }
            if done > total - sr as usize * 20 {
                late += buf.iter().map(|x| x * x).sum::<f32>();
            }
            if done > total - 4096 {
                win.extend_from_slice(&buf);
            }
        }
        assert!(!s.music_finished(), "{:?}", t);
        assert!(late > early * 0.5, "{:?} drifts to silence ({early} -> {late})", t);
        assert!(peak(&win) <= 1.0);
    }
}

#[test]
fn jingles_finish_in_window_then_silent() {
    // (track, min s, max s)
    let cases = [(Track::Splash, 1.8, 2.6), (Track::LevelClear, 5.5, 6.8), (Track::GameOver, 3.6, 4.8), (Track::ItemGet, 1.8, 2.6)];
    for (t, lo, hi) in cases {
        assert!(t.is_jingle());
        let mut s = track_synth(t);
        let mut at = None;
        let mut buf = vec![0.0; 441];
        for i in 0..(SR as usize * 10 / 441) {
            assert!(!s.music_finished() || at.is_some());
            s.render(&mut buf);
            if at.is_none() && s.music_finished() {
                at = Some((i + 1) as f32 * 441.0 / SR as f32);
            }
        }
        let at = at.unwrap_or_else(|| panic!("{:?} never finished", t));
        assert!(at >= lo && at <= hi, "{:?} finished at {at}s", t);
        // silent afterwards, sfx still audible
        assert!(rms(&render(&mut s, 20000)) < 1e-4);
        s.play_sfx(Sfx::Coins);
        assert!(rms(&render(&mut s, 10000)) > 0.01);
    }
}

#[test]
fn looping_tracks_are_not_jingles() {
    for t in songs::all_tracks() {
        let looping = songs::song(t).map(|s| s.looping);
        if let Some(l) = looping {
            assert_eq!(l, !t.is_jingle(), "{:?}", t);
        }
    }
}

fn features(t: Track) -> (u64, Vec<f32>) {
    let mut s = track_synth(t);
    let v = render(&mut s, SR as usize * 10);
    // 100 ms energy envelope
    let env: Vec<f32> = v.chunks(SR as usize / 10).map(rms).collect();
    (hash(&v), env)
}

#[test]
fn ten_store_songs_are_pairwise_different() {
    let f: Vec<_> = songs::OPEN_STORES.iter().map(|s| features(Track::Store(*s))).collect();
    for i in 0..f.len() {
        for j in i + 1..f.len() {
            assert_ne!(f[i].0, f[j].0);
            let d: f32 = f[i].1.iter().zip(&f[j].1).map(|(a, b)| (a - b).abs()).sum::<f32>() / f[i].1.len() as f32;
            assert!(d > 0.004, "{:?} vs {:?} envelope distance {d}", songs::OPEN_STORES[i], songs::OPEN_STORES[j]);
        }
    }
    // the closed stores share the quiet bed
    assert_eq!(features(Track::Store(StoreId::CircuitPity)).0, features(Track::MallAmbient).0);
}

#[test]
fn song_note_data_differs_between_stores() {
    let sigs: Vec<Vec<i16>> = songs::OPEN_STORES.iter().map(|s| songs::store(*s).ch[0].evs.iter().map(|e| e.pitch).collect()).collect();
    for i in 0..sigs.len() {
        for j in i + 1..sigs.len() {
            assert_ne!(sigs[i], sigs[j]);
        }
    }
}

#[test]
fn ambient_is_much_quieter_than_title() {
    let a = rms(&render(&mut track_synth(Track::MallAmbient), SR as usize * 40));
    let t = rms(&render(&mut track_synth(Track::Title), SR as usize * 40));
    assert!(a < 0.65 * t, "ambient {a} vs title {t}");
    assert!(a > 0.005);
}

#[test]
fn ambient_phrase_is_long() {
    let s = songs::song(Track::MallAmbient).unwrap();
    assert!(s.seconds() >= 40.0, "{}", s.seconds());
}

#[test]
fn music_volume_scales_music_not_sfx() {
    let mut s = track_synth(Track::Title);
    s.set_music_volume(0.0);
    let _ = render(&mut s, 4000); // ramp
    assert!(rms(&render(&mut s, 20000)) < 1e-4);
    s.play_sfx(Sfx::Jump);
    let v = render(&mut s, 2000);
    assert!(rms(&v) > 0.01);
    s.set_music_volume(1.0);
    let _ = render(&mut s, 4000);
    assert!(rms(&render(&mut s, 20000)) > 0.01);
    // half volume is quieter than full
    let mut a = track_synth(Track::Title);
    let mut b = track_synth(Track::Title);
    b.set_music_volume(0.5);
    let _ = (render(&mut a, 5000), render(&mut b, 5000));
    let (ra, rb) = (rms(&render(&mut a, 44100)), rms(&render(&mut b, 44100)));
    assert!(rb < ra * 0.8, "{rb} {ra}");
}

#[test]
fn volume_ramp_has_no_clicks() {
    let mut s = Synth::new(SR);
    s.set_hum(true);
    s.set_track(Track::Title);
    let _ = render(&mut s, 20000);
    let before = render(&mut s, 2000);
    s.set_music_volume(0.0);
    let after = render(&mut s, 2000);
    let max_step = |v: &[f32]| v.windows(2).fold(0.0f32, |m, w| m.max((w[1] - w[0]).abs()));
    assert!(max_step(&after) < max_step(&before) * 1.5 + 0.1);
}

#[test]
fn hum_toggles() {
    let mut s = Synth::new(SR);
    let _ = render(&mut s, 1000);
    assert_eq!(rms(&render(&mut s, 4000)), 0.0);
    s.set_hum(true);
    let _ = render(&mut s, SR as usize / 2);
    let on = render(&mut s, SR as usize);
    assert!(rms(&on) > 0.01 && peak(&on) < 0.5, "{}", rms(&on));
    s.set_hum(false);
    let _ = render(&mut s, SR as usize / 2);
    assert!(rms(&render(&mut s, 4000)) < 1e-4);
    // the hum is low: dominant period well above 10 ms-ish zero-crossing rate
    s.set_hum(true);
    let _ = render(&mut s, SR as usize);
    let h = render(&mut s, SR as usize);
    let zc = h.windows(2).filter(|w| (w[0] < 0.0) != (w[1] < 0.0)).count();
    assert!(zc < 400, "hum zero crossings {zc}");
}

#[test]
fn same_track_twice_does_not_restart() {
    let mut a = track_synth(Track::Title);
    let mut b = track_synth(Track::Title);
    let _ = render(&mut a, 30000);
    let _ = render(&mut b, 30000);
    a.set_track(Track::Title);
    a.apply(&Event::Music(Track::Title));
    assert_eq!(render(&mut a, 4000), render(&mut b, 4000));
    // a different track does restart
    a.set_track(Track::Alarm);
    a.set_track(Track::Title);
    assert_ne!(render(&mut a, 4000), render(&mut b, 4000));
}

#[test]
fn silence_stops_music() {
    let mut s = track_synth(Track::Title);
    let _ = render(&mut s, 5000);
    s.set_track(Track::Silence);
    let _ = render(&mut s, 20000); // DC-blocker tail of the cut
    assert!(rms(&render(&mut s, 10000)) < 1e-4);
    assert!(s.music_finished());
}

#[test]
fn many_simultaneous_sfx_never_overflow() {
    let mut s = Synth::new(SR);
    s.set_track(Track::Alarm);
    for i in 0..500 {
        for sfx in sfx::all_sfx() {
            s.play_sfx(sfx);
        }
        if i % 50 == 0 {
            let v = render(&mut s, 700);
            assert!(peak(&v) <= 1.0);
            assert!(v.iter().all(|x| x.is_finite()));
        }
    }
    assert!(s.sfx_voices_active() <= 8);
    // same sfx spammed (TextBlip typewriter)
    for _ in 0..200 {
        s.play_sfx(Sfx::TextBlip);
        let _ = render(&mut s, 100);
    }
    assert!(s.sfx_voices_active() <= 8);
}

#[test]
fn sfx_steal_music_channels_then_music_returns() {
    let mut s = track_synth(Track::Store(StoreId::Forever12));
    let _ = render(&mut s, 8000);
    s.play_sfx(Sfx::Death);
    let _ = render(&mut s, SR as usize * 2);
    assert!(rms(&render(&mut s, 20000)) > 0.01);
}

#[test]
fn apply_handles_all_event_kinds() {
    let mut s = Synth::new(SR);
    s.apply(&Event::Music(Track::Elevator));
    s.apply(&Event::Hum(true));
    s.apply(&Event::Sfx(Sfx::Ding));
    s.apply(&Event::MusicVolume(0.5));
    let v = render(&mut s, 20000);
    assert!(rms(&v) > 0.01 && peak(&v) <= 1.0);
    assert_eq!(s.current_track(), Some(Track::Elevator));
    s.apply(&Event::MusicVolume(f32::NAN));
    s.apply(&Event::MusicVolume(5.0));
    assert!(peak(&render(&mut s, 5000)) <= 1.0);
}

// ---- melodic analysis -------------------------------------------------------------------------------------

/// Dominant frequency in a window by autocorrelation (works for the monophonic solo parts we render in isolation).
fn pitch_hz(v: &[f32], sr: f32, lo: f32, hi: f32) -> f32 {
    let (min_lag, max_lag) = ((sr / hi) as usize, (sr / lo) as usize);
    let mut best = (0.0f32, min_lag);
    for lag in min_lag..max_lag.min(v.len() / 2) {
        let c: f32 = (0..v.len() - lag).step_by(2).map(|i| v[i] * v[i + lag]).sum();
        if c > best.0 {
            best = (c, lag);
        }
    }
    sr / best.1 as f32
}

fn solo(song: &Song, ch: usize) -> Song {
    let mut s = song.clone();
    for i in 0..4 {
        if i != ch {
            s.ch[i].evs.iter_mut().for_each(|e| e.pitch = -1);
        }
    }
    s
}

fn midi_hz(m: f32) -> f32 {
    440.0 * ((m - 69.0) / 12.0).exp2()
}

/// Render a song's single channel through the real synth (via the song player) and return the pitch heard at the
/// start of each of the first `n` melody events (sampled mid-note), compared with the written note.
#[test]
fn melody_notes_are_the_written_pitches() {
    for t in [Track::Title, Track::Store(StoreId::KgbToys)] {
        let song = songs::song(t).unwrap();
        let mut sy = Synth::new(SR);
        sy.song_override(solo(&song, 0));
        let tick = (song.tick_seconds() * SR as f32) as usize;
        let total_ticks = 64;
        let v = render(&mut sy, tick * total_ticks);
        let mut at = 0usize;
        let mut checked = 0;
        for ev in song.ch[0].evs.iter() {
            let dur = ev.dur as usize;
            if at + dur > total_ticks {
                break;
            }
            if ev.pitch >= 0 && dur >= 4 {
                let a = (at * tick) + tick;
                let b = ((at + dur) * tick).min(v.len()) - tick / 2;
                if b > a + 600 {
                    let seg = &v[a..b.min(a + 3000)];
                    let want = midi_hz(ev.pitch as f32);
                    let got = pitch_hz(seg, SR as f32, want * 0.6, want * 1.7);
                    let cents = 1200.0 * (got / want).log2();
                    assert!(cents.abs() < 60.0 || (cents.abs() - 1200.0).abs() < 60.0, "{:?} tick {at}: want {want} got {got}", t);
                    checked += 1;
                }
            }
            at += dur;
        }
        assert!(checked >= 8, "{:?} only {checked} notes checked", t);
    }
}

/// Onset times (in ticks) of the noise channel kick/snare reveal the meter: the waltz has 3 beats per bar.
#[test]
fn waltz_is_in_three_four() {
    let song = songs::store(StoreId::KgbToys);
    assert_eq!(song.beats_per_bar, 3);
    assert_eq!(song.bar_ticks(), 12);
    // bass (triangle) plays once per bar on the downbeat
    let mut at = 0;
    let mut onsets = Vec::new();
    for e in &song.ch[2].evs {
        if e.pitch >= 0 {
            onsets.push(at);
        }
        at += e.dur as u32;
    }
    assert!(onsets.iter().all(|o| o % 12 == 0));
    // chord stabs land on beats 2 and 3 (ticks 4 and 8 of the bar)
    let mut at = 0;
    for e in &song.ch[1].evs {
        if e.pitch >= 0 {
            assert!(matches!(at % 12, 4 | 8), "stab at {}", at % 12);
        }
        at += e.dur as u32;
    }
    // and the rendered audio's loudness peaks repeat every 12 ticks, not every 16
    let mut s = Synth::new(SR);
    s.song_override(song.clone());
    let tick = (song.tick_seconds() * SR as f32) as usize;
    let v = render(&mut s, tick * 12 * 8);
    let env: Vec<f32> = v.chunks(tick).map(|c| c.iter().map(|x| x.abs()).sum::<f32>()).collect();
    let period = |p: usize| -> f32 { (0..env.len() - p).map(|i| (env[i] - env[i + p]).abs()).sum::<f32>() / (env.len() - p) as f32 };
    assert!(period(12) < period(16), "bar period 12 ticks should fit better than 16: {} vs {}", period(12), period(16));
    assert!(period(12) < period(8));
}

#[test]
fn tempo_matches_bpm() {
    // Alarm: first bass notes onset spacing = one 8th = 2 ticks at 150 bpm sixteenths.
    let song = songs::song(Track::Alarm).unwrap();
    assert!((song.tick_seconds() - 0.1).abs() < 1e-6);
    let mut s = Synth::new(SR);
    s.song_override(solo(&song, 2));
    let v = render(&mut s, SR as usize * 2);
    // sample counter at which note 2 begins: tick 2 -> 0.2 s; envelope dips at note boundaries (gate < 1).
    let i = (0.2 * SR as f32) as usize;
    let before: f32 = v[i - 300..i - 100].iter().map(|x| x.abs()).sum();
    let gap: f32 = v[i - 100..i].iter().map(|x| x.abs()).sum::<f32>();
    assert!(gap < before, "no articulation gap at the 8th-note boundary");
}

#[test]
fn siren_figure_alternates_pitches() {
    let song = songs::song(Track::Alarm).unwrap();
    let p: Vec<i16> = song.ch[0].evs.iter().take(8).map(|e| e.pitch).collect();
    for w in p.windows(2) {
        assert_ne!(w[0], w[1]);
    }
    assert_eq!(p[0], p[2]);
    assert_eq!(p[1], p[3]);
}
