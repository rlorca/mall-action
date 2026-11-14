// Original scores. Each four-bar phrase has explicit chord voicings: minor melodies
// use minor thirds, rather than a generic major arpeggio over every harmony.
const MINOR=[[0,3,7],[8,12,15],[5,8,12],[7,11,14]];
const MAJOR=[[0,4,7],[9,12,16],[5,9,12],[7,11,14]];
const track=(name,bpm,root,lead,chords=MINOR,extra={})=>({name,bpm,root,lead,chords,...extra});
export const SCORES={
 title:track('Red Coat After Dark',116,57,[0,-1,3,7,10,7,5,3,0,-1,3,7,8,-1,7,3,5,-1,8,12,10,8,7,5,7,-1,11,14,12,11,7,-1]),
 ambient:track('Closing Time Neon',64,45,[12,-1,-1,-1,-1,-1,-1,-1,15,-1,-1,-1,-1,-1,-1,-1,17,-1,-1,-1,-1,-1,-1,-1,14,-1,-1,-1,12,-1,-1,-1],MINOR,{ambient:true}),
 elevator:track('Please Hold (Muzak)',94,57,[4,-1,7,9,7,-1,4,-1,4,-1,7,12,9,-1,7,-1,5,-1,9,12,9,7,5,-1,7,-1,11,14,12,11,7,-1],MAJOR,{soft:true}),
 alarm:track('Security Is Watching',146,57,[0,0,3,-1,7,7,10,-1,8,8,12,-1,15,12,8,-1,5,5,8,-1,12,10,8,-1,7,7,11,14,12,11,7,-1]),
 fashion:track('Trenchcoat Strut',112,57,[0,-1,3,7,10,-1,7,3,8,-1,12,15,12,-1,8,-1,5,-1,8,12,10,-1,8,5,7,-1,11,14,12,11,7,-1]),
 electronics:track('Batteries Not Included',124,60,[0,3,7,12,7,3,0,-1,8,12,15,20,15,12,8,-1,5,8,12,17,12,8,5,-1,7,11,14,19,14,11,7,-1]),
 toys:track('Little Comrade Waltz',100,60,[0,-1,4,7,4,-1,9,-1,12,16,12,-1,5,-1,9,12,9,-1,7,-1,11,14,11,-1],MAJOR,{meter:3,soft:true}),
 food:track('Pretzel Polka',126,60,[0,4,7,4,0,-1,7,-1,9,12,16,12,9,-1,12,-1,5,9,12,9,5,4,2,-1,7,11,14,11,7,-1,0,-1],MAJOR),
 sports:track('Both Left Feet',112,55,[0,0,7,-1,12,10,7,-1,8,8,12,-1,15,12,8,-1,5,5,12,-1,10,8,5,-1,7,7,11,14,12,11,7,-1]),
 music:track('No Refunds Rock',122,52,[0,0,3,0,7,-1,5,3,8,8,12,8,15,-1,12,8,5,5,8,5,12,-1,10,8,7,7,11,7,14,12,11,-1]),
 lounge:track('Massage Chair Bossa',92,57,[4,-1,7,9,-1,7,4,-1,9,-1,12,16,-1,12,9,-1,5,-1,9,12,9,-1,7,5,7,-1,11,14,11,-1,7,-1],MAJOR,{soft:true}),
 gadgets:track('Dreaming In Retail',80,57,[12,-1,-1,7,4,-1,-1,-1,16,-1,-1,12,9,-1,-1,-1,17,-1,-1,12,9,-1,-1,-1,14,-1,11,-1,7,-1,-1,-1],MAJOR,{soft:true}),
 novelty:track('Lava Lamp Surf Club',130,57,[0,0,3,5,7,5,3,-1,8,8,12,15,12,10,8,-1,5,5,8,10,12,10,8,-1,7,7,11,14,12,11,7,-1]),
 games:track('To The Moon Menu',140,60,[0,7,12,7,3,7,12,-1,8,15,20,15,12,15,8,-1,5,12,17,12,8,12,5,-1,7,14,19,14,11,14,7,-1]),
 sideb:track('Side B: Mall Hearts',114,60,[4,7,9,-1,7,4,2,-1,9,12,16,-1,12,9,7,-1,5,9,12,9,7,5,4,2,7,11,14,11,7,4,2,0],MAJOR),
 clear:track('No Receipt Required',120,60,[0,4,7,12,-1,7,12,16,19,-1,16,12,7,12,-1,-1],MAJOR,{once:true,soft:true}),
 over:track('The Mall Is Now Closed',76,57,[12,-1,10,-1,8,-1,7,-1,5,-1,3,-1,2,-1,0,-1],MINOR,{once:true,soft:true})
};
export const STORE_TRACKS=['fashion','electronics','lounge','games','toys','electronics','novelty','music','gadgets','food','electronics','sports','music'];
