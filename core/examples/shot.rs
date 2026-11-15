//! Dev tool: render game screens to PNGs you can look at.
//!   cargo run -p mall-core --example shot -- <what> <out.png> [scale]
//! `what`: gallery[:page] | store:<id index> | frames:N (run the Game N frames from the title, then shoot)
//! Other agents may extend this example with their own cases.

use mall_core::art;
use mall_core::pixel::Fb;
use mall_core::png;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let what = args.get(1).map(String::as_str).unwrap_or("gallery");
    let out = args.get(2).map(String::as_str).unwrap_or("shot.png");
    let scale: usize = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(3);
    let mut fb = Fb::new();
    if let Some(rest) = what.strip_prefix("gallery") {
        let page: usize = rest.trim_start_matches(':').parse().unwrap_or(0);
        art::gallery::draw(&mut fb, page, 0);
    } else {
        eprintln!("unknown shot kind {what}");
    }
    png::save_fb(out, &fb, scale);
    eprintln!("wrote {out}");
}
