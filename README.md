# MALL ACTION

One prompt, several models: **MALL ACTION** is an 8-bit spy caper set in an 80s shopping mall, a spiritual
successor to *Elevator Action* by the fictional studio **FLICKERSOFT**. Ride elevators, shoot spies, search
stores for hidden packages, and drive away in the wood-panelled getaway wagon.

The whole game is specified in a single brief, [`one-shot-prompt.md`](one-shot-prompt.md), and each model was
asked to build it from scratch in one go. Every implementation lives on its own branch:

| Model | Branch | Play it |
|---|---|---|
| Claude Opus 5.5 | [`opus-5-5`](../../tree/opus-5-5) | https://rlorca.github.io/mall-action/opus-5.5/ |
| Claude Sonnet 5.5 | [`sonnet-5-5`](../../tree/sonnet-5-5) | https://rlorca.github.io/mall-action/sonnet-5.5/ |

Each branch has its own README, tests and CI; pushing to a branch republishes its build.

*A FLICKERSOFT fan homage. Not affiliated with Taito or any parodied brand.*
