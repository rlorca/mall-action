import { escapeHtml, rankedEntries, renderReviewBlock, validateReview } from './scorecards.mjs';

// Implementation CI can replace its own card; restore its assessment and ranking.
try {
  const response = await fetch(new URL('./scores.json', import.meta.url));
  if (!response.ok) throw new Error(`Review data returned ${response.status}`);
  const review = validateReview(await response.json());
  const cards = [...document.querySelectorAll('section.card')];
  const entries = rankedEntries(review);
  const known = entries.flatMap((entry, index) => {
    const card = cards.find(candidate => candidate.querySelector(`a[href="${entry.folder}/"]`));
    if (!card) return [];
    card.dataset.implementation = entry.branch;
    card.querySelector('.review-block')?.remove();
    const actions = card.querySelector('.actions');
    if (!actions) return [];
    actions.insertAdjacentHTML('beforebegin', renderReviewBlock(entry, review.criteria, index + 1));
    const heading = card.querySelector('h2');
    if (heading) {
      heading.id = `${entry.branch}-title`;
      heading.innerHTML = `<span class="rank" aria-label="Rank ${index + 1}">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(entry.name)}`;
      card.setAttribute('aria-labelledby', heading.id);
    }
    return [card];
  });
  const unknown = cards.filter(card => !known.includes(card));
  const footer = document.querySelector('main > footer');
  if (footer) for (const card of [...known, ...unknown]) footer.before(card);
} catch (error) {
  // Generated HTML contains the full review, so network failures retain the scores.
  console.warn('Could not refresh implementation assessments:', error);
}
