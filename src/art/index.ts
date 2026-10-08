// Importing this module registers every sprite (side effects).
import './characters';
import './items';
import './mallprops';
import './storefronts';
import './storeart';

export { getSprite, hasSprite, allSprites } from './registry';
