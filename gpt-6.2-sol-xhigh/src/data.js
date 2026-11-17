export const W = 256;
export const H = 240;
export const HUD = 16;
export const WORLD = { width:768, height:348 };
export const floors = [78,126,174,222,270,318];
export const shafts = [
  {id:'A',x:150,top:0,bottom:3}, {id:'B',x:399,top:1,bottom:5},
  {id:'C',x:637,top:0,bottom:4,auto:true}
];
export const escalators = [
  {top:1,bottom:2,tx:599,bx:548},
  {top:3,bottom:4,tx:348,bx:295}
];
export const kiosks = [null,198,206,199,209];
export const fountains = [{x:484,floor:2},{x:469,floor:4}];
export const booth = {x:339,floor:2};
export const car = {x:586,floor:5};
export const lamps = [
  {x:209,floor:1}, {x:459,floor:1}, {x:674,floor:1},
  {x:231,floor:2}, {x:433,floor:2}, {x:672,floor:2},
  {x:112,floor:3}, {x:214,floor:3}, {x:461,floor:3}, {x:674,floor:3},
  {x:140,floor:4}, {x:353,floor:4}, {x:662,floor:4}
];

const shop = (id, name, floor, x, role, theme, layout, guards = []) => ({
  id, name, floor, x, role, theme, layout, guards
});
export const shops = [
  shop('fashion','FOREVER 12',1,56,'target','fashion',[
    '################','#F..f......f..F#','#..............#','#.ff..cc...ff..#',
    '#..............#','#....f....f....#','#.ff........ff.#','#......gg......#',
    '#.d..........d.#','#..............#','########e#######'],['spy']),
  shop('radio','RADIOSHOCK',1,275,'target','electronics',[
    '################','#f.f....ff.f..f#','#..............#','#..cc....cc....#',
    '#.......g......#','#.ff.........f.#','#......ff......#','#..g...........#',
    '#...f.....f..d.#','#..............#','########e#######'],['spy','bot']),
  shop('crook','CROOKSTONE',1,522,'power','gadgets',[
    '################','#f..f...c...f.f#','#..............#','#.....ff...d...#',
    '#..f...........#','#......c....f..#','#..............#','#..d..f..g.....#',
    '#.f..........f.#','#..............#','########e#######'],['spy']),
  shop('games','GAMESTONK',1,719,'power','games',[
    '################','#f...d...d....f#','#..............#','#.ff....j...ff.#',
    '#..............#','#..c......f....#','#..............#','#.f......g...f.#',
    '#....f.........#','#..............#','########e#######'],['spy']),
  shop('toys','KGB TOYS',2,60,'target','toys',[
    '################','#t.t....t.t..f.#','#..............#','#.t...t..t...t.#',
    '#..............#','#...f......f...#','#.t....g.....t.#','#..........g...#',
    '#.d..........d.#','#..............#','########e#######'],['spy','spy']),
  shop('video','BLOCKBLUSTER VIDEO',2,287,'closed','electronics'),
  shop('gifts',"SPENDER'S GIFTS",2,716,'power','novelty',[
    '################','#d..f.f..f.f..d#','#..............#','#.f.........f..#',
    '#..............#','#.....cccc.....#','#....g.........#','#.ff.......ff..#',
    '#..............#','#.d..........d.#','########e#######'],['spy']),
  shop('music','SAM BADDY',3,56,'target','music',[
    '################','#f.f....f.f..b.#','#..............#','#..fff.........#',
    '#............f.#','#.....g.cc.....#','#..f........f..#','#..f..f..g.....#',
    '#.d........f...#','#..............#','########e#######'],['spy','spy']),
  shop('sharper','SHARPER IMAGINE',3,279,'power','gadgets',[
    '################','#f...f....f...f#','#..............#','#..f...d....f..#',
    '#..f...f....f..#','#..............#','#.c..g..g...f..#','#.c.........f..#',
    '#....d.........#','#..............#','########e#######'],['bot','bot']),
  shop('food','HOT SPY ON A STICK',3,532,'target','food',[
    '################','#f...f..cc...f.#','#..............#','#.cccc.........#',
    '#........d..f..#','#.f....f....f..#','#..............#','#.f...g...g..f.#',
    '#...d..........#','#..............#','########e#######'],['spy','spy']),
  shop('circuit','CIRCUIT PITY',3,720,'closed','electronics'),
  shop('sports','FOOT LOCKPICKER',4,64,'target','sports',[
    '################','#f..f..ff..f..f#','#..............#','#.f....f.....f.#',
    '#......f..g....#','#.cc...........#','#...........f..#','#....g..cc.....#',
    '#..f.........d.#','#..............#','########e#######'],['spy','spy']),
  shop('books','BORDERLINE BOOKS',4,544,'closed','novelty')
];
export const byId = Object.fromEntries(shops.map(s => [s.id,s]));
export const powers = ['rapid','spread','armor','sneakers','radar','life','cinna','orange','pretzel'];
export const foodPowers = powers.slice(6);
export const solidTile = c => '#ftFcd'.includes(c) && c !== '';
export const fixtureTile = c => 'ftF'.includes(c) && c !== '';

export function parseRoom(layout) {
  const fixtures = [], guards = [];
  let door, bonus, pedestal;
  for (const [y,row] of layout.entries()) for (const [x,tile] of [...row].entries()) {
    const at = {x,y};
    if (fixtureTile(tile)) fixtures.push({...at, type:tile});
    if (tile === 'g') guards.push(at);
    if (tile === 'e') door = at;
    if (tile === 'b') bonus = at;
    if (tile === 'j') pedestal = at;
  }
  return {width:layout[0].length,height:layout.length,layout,fixtures,guards,door,bonus,pedestal};
}
export const rooms = Object.fromEntries(shops.filter(s=>s.layout).map(s=>[s.id,parseRoom(s.layout)]));
export const floorAt = y => floors.indexOf(y);
export const tilePixel = t => t * 16 + 8;
export const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
