# MALL ACTION

**A benchmark for AI coding models.** One prompt, one shot, every model. **MALL ACTION** is an 8-bit spy caper set in an 80s shopping mall, a spiritual
successor to *Elevator Action* by the fictional studio **FLICKERSOFT**. Ride elevators, shoot spies, search
stores for hidden packages, and drive away in the wood-panelled getaway wagon.

The whole game is specified in a single brief, [`one-shot-prompt.md`](one-shot-prompt.md), and each model was
asked to build it from scratch in one go. Every implementation lives on its own branch:

| Model | Branch | Play it |
|---|---|---|
| Claude Opus 5.5 | [`opus-5-5`](../../tree/opus-5-5) | https://rlorca.github.io/mall-action/opus-5.5/ |
| Claude Sonnet 5.5 | [`sonnet-5-5`](../../tree/sonnet-5-5) | https://rlorca.github.io/mall-action/sonnet-5.5/ |
| GPT-6 Sol | [`gpt-6-sol`](../../tree/gpt-6-sol) | https://rlorca.github.io/mall-action/gpt-6.sol/ |
| GPT-6 Astra | [`gpt-6-astra`](../../tree/gpt-6-astra) | https://rlorca.github.io/mall-action/gpt-6.astra/ |
| GPT-6.1 Sol | [`gpt-6-1-sol`](../../tree/gpt-6-1-sol) | https://rlorca.github.io/mall-action/gpt-6.1-sol/ |
| GPT-6.2 Sol (xhigh) | [`gpt-6-2-sol-xhigh`](../../tree/gpt-6-2-sol-xhigh) | https://rlorca.github.io/mall-action/gpt-6.2-sol-xhigh/ |
| GPT-6.2 Astra (xhigh) | [`gpt-6-2-astra-xhigh`](../../tree/gpt-6-2-astra-xhigh) | https://rlorca.github.io/mall-action/gpt-6.2-astra-xhigh/ |
| GPT-6.1 Sol (medium), Rust | [`rust-gpt-6.1-sol-medium`](../../tree/rust-gpt-6.1-sol-medium) | https://rlorca.github.io/mall-action/rust-gpt-6.1-sol-medium/ |
| Claude Sonnet 5.5 + Fable 5.1 advisor, Rust | [`rust-sonnet-5-5-fable-5-1`](../../tree/rust-sonnet-5-5-fable-5-1) | https://rlorca.github.io/mall-action/rust-sonnet-5.5-fable-5.1/ |
| Claude Sonnet 5.5, Rust + Macroquad | [`macroquad-sonnet-5-5`](../../tree/macroquad-sonnet-5-5) | https://rlorca.github.io/mall-action/macroquad-sonnet-5.5/ |
| Claude Sonnet 5.5, Rust + Bevy | [`bevy-sonnet-5-5`](../../tree/bevy-sonnet-5-5) | https://rlorca.github.io/mall-action/bevy-sonnet-5.5/ |
| Claude Fable 5.1 | [`fable-5-1`](../../tree/fable-5-1) | https://rlorca.github.io/mall-action/fable-5.1/ |
| Claude Fable 5.2 | [`fable-5-2`](../../tree/fable-5-2) | https://rlorca.github.io/mall-action/fable-5.2/ |
| Claude Haiku 4.5 | [`haiku-4-5`](../../tree/haiku-4-5) | https://rlorca.github.io/mall-action/haiku-4.5/ |
| Gemini 3.6 Flash | [`gemini-3-6-flash`](../../tree/gemini-3-6-flash) | https://rlorca.github.io/mall-action/gemini-3.6-flash/ |
| Claude Opus 4.6 | [`opus-4-6`](../../tree/opus-4-6) | https://rlorca.github.io/mall-action/opus-4.6/ |
| Claude Opus 5 | [`opus-5`](../../tree/opus-5) | https://rlorca.github.io/mall-action/opus-5/ |
| Claude Haiku 5.5 | [`haiku-5-5`](../../tree/haiku-5-5) | https://rlorca.github.io/mall-action/haiku-5.5/ |
| Claude Sonnet 5.5 + Fable 5.1 advisor | [`sonnet-5-5-fable-5-1`](../../tree/sonnet-5-5-fable-5-1) | https://rlorca.github.io/mall-action/sonnet-5.5-fable-5.1/ |
| Claude Sonnet 5.5 + Opus 5.5 advisor | [`sonnet-5-5-opus-5-5`](../../tree/sonnet-5-5-opus-5-5) | https://rlorca.github.io/mall-action/sonnet-5.5-opus-5.5/ |
| Kimi K3.1 Pro (high) | [`kimi-k3-1-pro-high`](../../tree/kimi-k3-1-pro-high) | https://rlorca.github.io/mall-action/kimi-k3.1-pro-high/ |

Each branch has its own README, tests and CI; pushing to a branch republishes its build.

[Leaderboard and play links](https://rlorca.github.io/mall-action/) · [Full assessments](https://rlorca.github.io/mall-action/reviews/index.html)

The GPT-6.1 Rust entry is a constrained, interactively revised run; the leaderboard assesses current snapshots, not original one-shot performance. [Rust assessment](https://rlorca.github.io/mall-action/reviews/index.html#rust-gpt-6.1-sol-medium).

The [Sonnet–Fable Rust assessment](https://rlorca.github.io/mall-action/reviews/index.html#rust-sonnet-5-5-fable-5-1) covers a parity-tested port, not a new one-shot implementation. The port used a Fable 5.2 advisor; its branch name retains the source’s Fable 5.1 label.

The [Bevy assessment](https://rlorca.github.io/mall-action/reviews/index.html#bevy-sonnet-5-5) and [Macroquad assessment](https://rlorca.github.io/mall-action/reviews/index.html#macroquad-sonnet-5-5) cover separate framework-constrained Sonnet implementations.

## Using it as a benchmark

When a new model comes out, give it [`one-shot-prompt.md`](one-shot-prompt.md) in an empty directory, let it work
autonomously, and publish the result as a new branch. Then compare the games side by side: does it run, does it
feel good to play, how complete is it, how good are the tests, how much time and effort did it take. See
[`AGENTS.md`](AGENTS.md) for the exact protocol.

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*
