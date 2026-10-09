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
| GPT-6.1 Sol | [`gpt-6-1-sol`](../../tree/gpt-6-1-sol) | https://rlorca.github.io/mall-action/gpt-6.1-sol/ |
| Claude Fable 5.1 | [`fable-5-1`](../../tree/fable-5-1) | https://rlorca.github.io/mall-action/fable-5.1/ |
| Claude Haiku 4.5 | [`haiku-4-5`](../../tree/haiku-4-5) | https://rlorca.github.io/mall-action/haiku-4.5/ |
| Gemini 3.6 Flash | [`gemini-3-6-flash`](../../tree/gemini-3-6-flash) | https://rlorca.github.io/mall-action/gemini-3.6-flash/ |
| Claude Opus 4.6 | [`opus-4-6`](../../tree/opus-4-6) | https://rlorca.github.io/mall-action/opus-4.6/ |
| Claude Opus 5 | [`opus-5`](../../tree/opus-5) | https://rlorca.github.io/mall-action/opus-5/ |
| Claude Haiku 5.5 | [`haiku-5-5`](../../tree/haiku-5-5) | https://rlorca.github.io/mall-action/haiku-5.5/ |
| Claude Sonnet 5.5 + Fable 5.1 advisor | [`sonnet-5-5-fable-5-1`](../../tree/sonnet-5-5-fable-5-1) | https://rlorca.github.io/mall-action/sonnet-5.5-fable-5.1/ |

Each branch has its own README, tests and CI; pushing to a branch republishes its build.

## Using it as a benchmark

When a new model comes out, give it [`one-shot-prompt.md`](one-shot-prompt.md) in an empty directory, let it work
autonomously, and publish the result as a new branch. Then compare the games side by side: does it run, does it
feel good to play, how complete is it, how good are the tests, how much time and effort did it take. See
[`AGENTS.md`](AGENTS.md) for the exact protocol.

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*
