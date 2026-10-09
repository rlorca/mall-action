export const repository = 'https://github.com/rlorca/mall-action';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function validateReview(review) {
  if (review.scale !== 10 || review.criteria.length !== 5) {
    throw new Error('Reviews require five criteria scored out of 10.');
  }
  const branches = new Set();
  const folders = new Set();
  const keys = review.criteria.map(criterion => criterion.key);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate criteria.');
  for (const entry of review.implementations) {
    if (branches.has(entry.branch) || folders.has(entry.folder)) {
      throw new Error(`Duplicate implementation: ${entry.branch}`);
    }
    branches.add(entry.branch);
    folders.add(entry.folder);
    if (!/^[a-z0-9.-]+$/.test(entry.branch) || !/^[a-z0-9.-]+$/.test(entry.folder)) {
      throw new Error(`Invalid implementation path: ${entry.branch}`);
    }
    if (!/^[a-f0-9]{40}$/.test(entry.commit)) throw new Error(`Missing snapshot: ${entry.branch}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.written)) throw new Error(`Missing written date: ${entry.branch}`);
    if (!entry.note || [...entry.note].length > 140) {
      throw new Error(`Note exceeds 140 characters: ${entry.branch}`);
    }
    if (Object.keys(entry.scores).length !== keys.length) throw new Error(`Wrong score count: ${entry.branch}`);
    for (const key of keys) {
      const score = entry.scores[key];
      if (!Number.isFinite(score) || score < 0 || score > review.scale) {
        throw new Error(`Invalid ${key} score: ${entry.branch}`);
      }
      if (!entry.assessment[key]) throw new Error(`Missing ${key} assessment: ${entry.branch}`);
    }
  }
  return review;
}

export function overallScore(entry, criteria) {
  const total = criteria.reduce((sum, criterion) => sum + entry.scores[criterion.key], 0);
  return Math.round((total / criteria.length) * 10) / 10;
}

export function rankedEntries(review) {
  return [...review.implementations].sort((a, b) =>
    overallScore(b, review.criteria) - overallScore(a, review.criteria)
    || b.scores.completeness - a.scores.completeness
    || b.scores.gameDesign - a.scores.gameDesign
    || a.branch.localeCompare(b.branch),
  );
}

/** The date the implementation was written, as shown on the page. */
export function formatWritten(entry) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${entry.written}T00:00:00Z`));
}

export function renderScores(entry, criteria) {
  const scores = [...criteria.map(criterion => ({
    label: criterion.label, value: entry.scores[criterion.key], key: criterion.key,
  })), { label: 'Overall score', value: overallScore(entry, criteria), key: 'overall' }];
  return `<dl class="scores" aria-label="Implementation scores out of 10">${scores.map(score =>
    `<div class="score${score.key === 'overall' ? ' overall' : ''}" data-criterion="${score.key}"><dt>${escapeHtml(score.label)}</dt><dd>${score.value.toFixed(1)}<span> / 10</span></dd></div>`,
  ).join('')}</dl>`;
}

export function renderReviewBlock(entry, criteria, rank, assessmentHref = 'reviews/index.html') {
  return `<div class="review-block" data-rank="${rank}">
    ${renderScores(entry, criteria)}
    <p class="review-note">${escapeHtml(entry.note)}</p>
    <a class="assessment-link" href="${assessmentHref}#${entry.branch}">Read assessment <span aria-hidden="true">↗</span></a>
  </div>`;
}

export function renderCard(entry, review, rank) {
  return `<section class="card" data-implementation="${entry.branch}" aria-labelledby="${entry.branch}-title">
    <h2 id="${entry.branch}-title"><span class="rank" aria-label="Rank ${rank}">${String(rank).padStart(2, '0')}</span>${escapeHtml(entry.name)}</h2>
    <p class="technology">${escapeHtml(entry.technology)}. Branch <code>${entry.branch}</code>.</p>
    <p class="written">Written <time datetime="${entry.written}">${formatWritten(entry)}</time></p>
    ${renderReviewBlock(entry, review.criteria, rank)}
    <div class="actions">
      <a class="btn play" href="${entry.folder}/">Play</a>
      <a class="btn" href="${repository}/tree/${entry.branch}">Source code</a>
    </div>
  </section>`;
}
