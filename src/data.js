export const W=256,H=240,HUD=16,LEVEL_W=768;
export const FLOORS=['R','4F','3F','2F','1F','P'];
export const FLOOR_Y=[40,88,136,184,232,280];
export const PALETTE=['#0c0b18','#201b35','#38304f','#595072','#807591','#b6a4a3','#e1c9aa','#fbf1cf','#f74657','#ff8060','#ffca61','#f8ef70','#78d779','#48b6a5','#4a8ec9','#9168b7','#f7a8c7'];
export const STORES=[
 {id:'forever',name:'FOREVER 12',floor:1,x:80,role:'target',theme:'fashion',display:'clothes'},
 {id:'radio',name:'RADIOSHOCK',floor:1,x:230,role:'target',theme:'electronics',display:'tv'},
 {id:'crook',name:'CROOKSTONE',floor:1,x:390,role:'shop',theme:'gadgets',display:'chair'},
 {id:'game',name:'GAMESTONK',floor:1,x:580,role:'shop',theme:'games',display:'game'},
 {id:'kgb',name:'KGB TOYS',floor:2,x:118,role:'target',theme:'toys',display:'toys'},
 {id:'block',name:'BLOCKBLUSTER VIDEO',floor:2,x:300,role:'closed',theme:'electronics',display:'shutter'},
 {id:'spender',name:"SPENDER'S GIFTS",floor:2,x:545,role:'shop',theme:'novelty',display:'lava'},
 {id:'sam',name:'SAM BADDY',floor:3,x:92,role:'target',theme:'music',display:'music'},
 {id:'sharper',name:'SHARPER IMAGINE',floor:3,x:282,role:'shop',theme:'gadgets',display:'orb'},
 {id:'hot',name:'HOT SPY ON A STICK',floor:3,x:480,role:'target',theme:'food',display:'food'},
 {id:'circuit',name:'CIRCUIT PITY',floor:3,x:665,role:'closed',theme:'electronics',display:'shutter'},
 {id:'foot',name:'FOOT LOCKPICKER',floor:4,x:168,role:'target',theme:'sports',display:'shoes'},
 {id:'border',name:'BORDERLINE BOOKS',floor:4,x:530,role:'closed',theme:'fashion',display:'shutter'}
];
export const TARGETS=STORES.filter(s=>s.role==='target');
export const SHAFTS=[{id:'A',x:205,min:0,max:3,manual:true},{id:'B',x:687,min:1,max:5,manual:true},{id:'C',x:432,min:0,max:4,manual:false}];
export const ESCALATORS=[{x:350,a:1,b:2},{x:354,a:3,b:4}];
export const POWERUPS=['RAPID FIRE','SPREAD SHOT','ARMOR VEST','SNEAKERS','RADAR','1-UP','CINNABOMB','ORANGE JULI-OOZE','SOFT PRETZEL'];
export const JOKE_ITEMS=['EXPIRED COUPON','PRE-OWNED GUIDE','PET ROCK','MOOD RING','1 SHARE (DOWN 99%)'];
export const FIRST_LINES={forever:["IT'S NOT A DISGUISE.","IT'S A LOOK, SERGEI."],radio:["YOU'LL NEED BATTERIES.","BEEP. NOT INCLUDED."],crook:['TRY THE MASSAGE CHAIR...'],game:["IT'S DANGEROUS TO GO ALONE!"],kgb:["DIMITRI, HE'S HERE!",'DA! HIDE THE TEDDIES!'],spender:['WHOA... THE LAVA LAMP...'],sam:['TURN IT UP, BORIS!'],sharper:["BEEP. PLEASE DON'T TOUCH."],hot:['WANT FRIES WITH THAT?'],foot:['THESE ARE MY GETAWAY SHOES','BOTH LEFT FEET, COMRADE']};
export const LAST_WORDS=['I WAS JUST BROWSING!',"WHAT'S YOUR RETURN POLICY?!",'I HAD A COUPON!','TELL MY CAT...','NOT THE FACE!','I WAS ON MY LUNCH BREAK!','WORTH IT. 70% OFF.','MY RECEIPT...'];
export const PA_LINES=['ATTENTION SHOPPERS: CLEANUP ON 3F. AGAIN.','FREE SAMPLES AT HOT SPY. NOT POISONED. PROBABLY.',"WILL THE OWNER OF A BLACK VAN MARKED 'NOT SPIES' PLEASE MOVE IT.",'LOST CHILD AT THE 2F KIOSK. SAYS HIS NAME IS AGENT 7.','BLOCKBLUSTER IS STILL CLOSED. BE KIND, REWIND.','THE MALL CLOSES AT 9. SPIES CLOSE AT NEVER.','A REMINDER: SECURITY IS WATCHING. MOSTLY TV.'];
export const HEADLINES=['LOCAL AGENT FINDS 6 PACKAGES, STILL NO PARKING','SPIES FOILED; FOOD COURT SALES UP 300%','MAN ZIPLINES ONTO ROOF. SECURITY NOT SURPRISED',"MALL WALKERS DEMAND APOLOGY FOR HEY INCIDENT",'GAMESTONK SHARE PRICE DOWN ANOTHER 99%'];
export const POSTS_ARRIVE=[
 {caption:['FEELING CUTE,','MIGHT DELETE LATER'],comment:'MOM: SO PROUD OF U'},
 {caption:['FIRST DAY ON THE JOB!','#BLESSED'],comment:'BOSS: DELETE THIS'},
 {caption:['MALL RAT? NO.','MALL AGENT.'],comment:'MOM: WEAR A JACKET'},
 {caption:['ZIPLINE WAS $0.','PARKING WAS $12.'],comment:'DAD: TOLD U SO'},
 {caption:['OUTFIT OF THE DAY:','TRENCHCOAT, AGAIN'],comment:'FOREVER12: 20% OFF!'},
 {caption:['NO SPIES WERE HARMED','IN THIS SELFIE. YET.'],comment:'DIMITRI: :( '},
 {caption:['ROOFTOP VIBES','#UNDERCOVER'],comment:'HQ: WHY IS IT PUBLIC'},
 {caption:["DON'T TELL HQ, I'M",'HERE FOR PRETZELS'],comment:'HQ: WE CAN SEE THIS'},
 {caption:['GOLDEN HOUR.','LICENSE TO CHILL.'],comment:'MOM: CALL YOUR MOTHER'},
 {caption:['SECRET MISSION.','PLEASE LIKE & SHARE'],comment:'HQ: ...SERIOUSLY?'}
];
export const POSTS_CLEAR=[
 {caption:['MISSION COMPLETE.','ALSO BOUGHT SOCKS.'],comment:'MOM: WHAT COLOR?'},
 {caption:['6 PACKAGES.','0 RECEIPTS. #WIN'],comment:'RETURNS DESK: NO'},
 {caption:['SAVED THE WORLD.','STILL NO PARKING.'],comment:'DAD: TYPICAL'},
 {caption:['SPIES: 0','ME: 1 #MALLRAT'],comment:'BORIS: REMATCH?'},
 {caption:['GETAWAY CAR:','WOOD PANELING. ICONIC'],comment:'HQ: RETURN THE CAR'},
 {caption:['TREATED MYSELF TO A','CINNABOMB. EARNED IT.'],comment:'MOM: EAT A VEGGIE'},
 {caption:['HQ SAID KEEP IT QUIET','SO HERE IS A POST'],comment:"HQ: YOU'RE FIRED"},
 {caption:['FOUND A PET ROCK.','HIS NAME IS KEVIN.'],comment:'KEVIN: ...'},
 {caption:['BRB, RETURNING 6','SUSPICIOUS PACKAGES'],comment:'MALL COP: WAIT WHAT'},
 {caption:['SEE YOU NEXT LOOP,','FOOD COURT'],comment:'HOT SPY: YAY'}
];
export const FLOOR_BANNERS=['R - ROOFTOP RENDEZVOUS','4F - FASHION & GADGETS','3F - TOYS & ODDITIES','2F - MUSIC & SNACKS','1F - SHOES & SECURITY','P - PARKING & ESCAPE'];
// Hand placed fixtures and walls. The room engine accepts arbitrary dimensions.
export const ROOM_PLANS={
 forever:[[2,2,'rack'],[5,2,'rack'],[10,2,'fitting'],[13,2,'fitting'],[3,5,'mannequin'],[7,5,'rack'],[12,6,'mannequin']],
 radio:[[2,2,'tv'],[6,2,'tv'],[10,2,'radio'],[13,4,'tv'],[3,6,'radio'],[8,6,'tv'],[12,7,'radio']],
 crook:[[2,2,'chair'],[6,2,'gadget'],[11,2,'gadget'],[4,6,'chair'],[9,6,'gadget'],[13,7,'gadget']],
 game:[[2,2,'console'],[6,2,'poster'],[11,2,'tv'],[3,6,'console'],[8,6,'console'],[12,7,'tv']],
 kgb:[[2,2,'teddy'],[6,2,'shelf'],[11,2,'rocket'],[3,6,'shelf'],[8,6,'teddy'],[12,7,'shelf']],
 spender:[[2,2,'lava'],[6,2,'plasma'],[11,2,'lava'],[3,6,'plasma'],[8,6,'lava'],[12,7,'plasma']],
 sam:[[2,2,'vinyl'],[6,2,'booth'],[11,2,'boombox'],[3,6,'vinyl'],[8,6,'booth'],[12,7,'boombox']],
 sharper:[[2,2,'vacuum'],[6,2,'orb'],[11,2,'orb'],[3,6,'vacuum'],[8,6,'orb'],[12,7,'vacuum']],
 hot:[[2,2,'lemonade'],[6,2,'corndog'],[11,2,'counter'],[3,6,'corndog'],[8,6,'lemonade'],[12,7,'counter']],
 foot:[[2,2,'sneakers'],[6,2,'ball'],[11,2,'jersey'],[3,6,'sneakers'],[8,6,'ball'],[12,7,'sneakers']]
};
