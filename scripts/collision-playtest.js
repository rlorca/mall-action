async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 await page.goto('http://127.0.0.1:4176/?debug=1&seed=123');await page.waitForFunction(()=>window.game);await page.keyboard.press('z');await page.waitForFunction(()=>game.audio.engine==='audio-worklet'&&game.audio.samples>0);
 const before=await page.evaluate(()=>game.audio);await page.evaluate(()=>{const until=performance.now()+750;while(performance.now()<until){};});await page.waitForTimeout(300);const after=await page.evaluate(()=>game.audio);
 check(after.samples-before.samples>after.sampleRate*.5,'sample-clock music must continue during a main-thread stall');check(after.error===null&&after.peak<.8,'audio must have headroom and no processor errors');
 await page.evaluate(()=>game.freeze());await page.keyboard.press('m');await page.waitForTimeout(250);const muted=await page.evaluate(()=>game.audio);check(muted.muted&&muted.rms<.001,'mute must work even with no game frames');await page.keyboard.press('m');
 await page.evaluate(()=>{game.command(0);game.command(10,0,1);game.command(1,0,162);game.freeze(false)});await page.waitForTimeout(400);const roof=await page.evaluate(()=>game.state);check(roof.roof===0&&roof.y===60,'feet must stand on the rendered car roof');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(700);await page.keyboard.up('ArrowLeft');const landing=await page.evaluate(()=>game.state);check(landing.floor===1&&landing.y===88&&landing.lives===3&&!landing.falling,'walk off car roof onto the next floor');
 await page.screenshot({path:'/tmp/mall-collision-roof.png',scale:'css'});
 await page.evaluate(()=>{game.command(0);game.command(1,2,162)});await page.keyboard.press('ArrowUp');await page.waitForTimeout(1800);const called=await page.evaluate(()=>game.state);check(called.lift===0&&called.floor===2&&called.lives===3,'called car must pick up rather than crush its passenger');
 await page.evaluate(()=>{game.command(0);game.command(2,1)});
 // Walk the complete approach with real keys: central aisle, left aisle, counter edge.
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>game.state.y<=70);await page.keyboard.up('ArrowUp');
 await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>game.state.x<=30);await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');const counter=await page.evaluate(()=>({state:game.state,f:game.fixtures[0]}));
 check(counter.state.scene===5&&counter.state.y===counter.f.y+24-10,'walking into a counter must stop at its front edge');
 await page.keyboard.press('x');await page.waitForTimeout(850);check(await page.evaluate(()=>game.fixtures[0].open),'a counter approached by walking must be searchable');
 await page.screenshot({path:'/tmp/mall-collision-counter.png',scale:'css'});await page.evaluate(()=>game.freeze());
 check(errors.length===0,errors.join('\n'));return {passed:true,errors,audio:{before,after,muted},roof,landing,called,counter};
}
