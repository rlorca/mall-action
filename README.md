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
| Claude Fable 5.1 | [`fable-5-1`](../../tree/fable-5-1) | https://rlorca.github.io/mall-action/fable-5.1/ |

Each branch has its own README, tests and CI; pushing to a branch republishes its build.

## Using it as a benchmark

When a new model comes out, give it [`one-shot-prompt.md`](one-shot-prompt.md) in an empty directory, let it work
autonomously, and publish the result as a new branch. Then compare the games side by side: does it run, does it
feel good to play, how complete is it, how good are the tests, how much time and effort did it take. See
[`AGENTS.md`](AGENTS.md) for the exact protocol.

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*
