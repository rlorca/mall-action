async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const url='http://127.0.0.1:4176/';
 await page.setViewportSize({width:1024,height:960});
 await page.goto(url+'?seed=42');await page.waitForTimeout(400);
 await page.screenshot({path:'/tmp/mall-splash.png',scale:'css'});
 await page.waitForTimeout(2900);await page.keyboard.press('z');await page.waitForTimeout(250);
 await page.screenshot({path:'/tmp/mall-title.png',scale:'css'});
 await page.keyboard.press('Enter');await page.waitForTimeout(4400);
 await page.screenshot({path:'/tmp/mall-arrival.png',scale:'css'});
 await page.goto(url+'?seed=123&debug=1');await page.waitForFunction(()=>window.game);
 await page.keyboard.press('z');await page.waitForTimeout(400);
 let audio;for(let i=0;i<12;i++){await page.keyboard.press('z');await page.waitForTimeout(80);audio=await page.evaluate(()=>game.audio);if(audio.rms>0)break;}check(audio.state==='running'&&audio.rms>0,'audio must produce a signal: '+JSON.stringify(audio));
 await page.evaluate(()=>{game.command(0);game.command(1,0,162)});
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(500);await page.keyboard.up('ArrowDown');await page.waitForTimeout(500);
 check(await page.evaluate(()=>game.state.floor===1&&game.state.lift===0),'manual elevator ride');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(1600);await page.keyboard.up('ArrowLeft');
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(100);
 check(await page.evaluate(()=>game.state.scene===5),'enter store using keyboard');
 await page.evaluate(()=>{const f=game.fixtures.find(f=>f.content===1);game.command(3,f.x+4,f.y+24)});
 await page.keyboard.press('x');await page.waitForTimeout(850);
 check(await page.evaluate(()=>game.state.packages===1),'single tap package search');
 await page.screenshot({path:'/tmp/mall-store.png',scale:'css'});
 await page.waitForTimeout(1000);await page.evaluate(()=>game.command(3,122,155));
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(100);await page.keyboard.up('ArrowDown');
 check(await page.evaluate(()=>game.state.scene===4),'leave store');
 await page.keyboard.press('Shift');await page.waitForTimeout(50);check(await page.evaluate(()=>game.state.map===1),'map');
 await page.screenshot({path:'/tmp/mall-map.png',scale:'css'});
 await page.keyboard.press('Shift');await page.waitForTimeout(50);await page.keyboard.press('Enter');await page.waitForTimeout(50);check(await page.evaluate(()=>game.state.paused===1),'pause');
 await page.keyboard.press('Enter');await page.waitForTimeout(50);
 await page.evaluate(()=>game.command(1,2,302));await page.keyboard.press('ArrowUp');await page.waitForTimeout(900);check(await page.evaluate(()=>game.state.floor===1),'escalator');
 await page.evaluate(()=>{game.command(1,1,85);game.step(1)});await page.screenshot({path:'/tmp/mall-gameplay.png',scale:'css'});
 await page.evaluate(()=>{game.command(0);game.command(1,1,95);game.command(9)});
 const beforeShot=await page.evaluate(()=>game.state.score);
 for(let i=0;i<3;i++){await page.keyboard.press('z');await page.waitForTimeout(350)}
 check(await page.evaluate(()=>game.state.fallingLamps>0),'shoot a hanging lamp');
 check(await page.evaluate(before=>game.state.score>before,beforeShot),'shoot a spy');
 // Restore the first collected package before the remaining-store checks.
 await page.evaluate(()=>{game.command(2,0);const f=game.fixtures.find(f=>f.content===1);game.command(3,f.x+4,f.y+24);game.freeze();game.step(1,32);game.step(46)});
 // Exercise every remaining package through the same simulated search rules.
 await page.evaluate(()=>{game.freeze();for(const id of [1,4,7,9,11]){game.command(2,id);let f=game.fixtures.find(f=>f.content===1);game.command(3,f.x+4,f.y+24);for(let retry=0;retry<8;retry++){game.step(1,32);game.step(46);if(game.fixtures.find(f=>f.content===1).open)break;}}game.command(1,5,630);});
 // Leave the last room before using the car.
 await page.evaluate(()=>{game.command(3,122,155);game.step(80);game.step(1,2);game.command(1,5,630);game.step(1,1)});
 check(await page.evaluate(()=>game.state.scene===6&&game.state.packages===6),'all packages and level clear');
 await page.screenshot({path:'/tmp/mall-clear.png',scale:'css'});
 const next=await page.evaluate(()=>{game.step(1,128);game.step(1,128);game.step(1,128);return game.state});check(next.loop===2,'loop two');
 const continued=await page.evaluate(()=>{game.command(0);game.command(7);game.step(1,128);return game.state});check(continued.lives===3&&continued.continues===2,'continue');
 const over=await page.evaluate(()=>{game.command(8);return game.state});check(over.scene===10,'game over');
 await page.evaluate(()=>{game.command(0);game.command(1,1,85);game.step(1);game.freeze(false)});
 check(errors.length===0,errors.join('\n'));
 return {passed:true,errors,audio,next,continued,over};
}
