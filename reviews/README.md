# Landing-page assessments

`scores.json` is the review source. It records the date each implementation was written (`written`,
from the branch README benchmark notes or else its first commit), five category scores, a note of
at most 140 Unicode characters, rationale, verification, and exact source commits.
Overall is calculated rather than entered separately.

Generate the landing page and assessment page from this directory's data:

```sh
node reviews/build.mjs
```

Run this from the publishing branch/worktree. The generator validates the data,
calculates the equally weighted mean, and sorts by overall, completeness, then
game design. Do not hand-edit either generated HTML file.

`enhance.mjs` restores review metadata and ordering when implementation CI replaces
its own landing card. Static HTML already includes all scores, so the page also
works without JavaScript. New implementations need a data entry and regeneration
to receive an assessment; unreviewed cards added by CI stay after reviewed cards.

These ratings cover the recorded current branch snapshots, including later
fixes. They do not rate the original one-shot commits or model capability.
