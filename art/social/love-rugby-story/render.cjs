const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
const D=__dirname+'/',u='file://'+D+'story.html';
await p.goto(u);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
const r=await p.evaluate(()=>['h1','sub','phone','brand','stores'].map(id=>{const e=document.getElementById(id);let x=e.getBoundingClientRect();
 if(id==='h1'||id==='sub'||id==='free'||id==='brand'){const rg=document.createRange();rg.selectNodeContents(e);x=rg.getBoundingClientRect()}
 return [id,Math.round(x.left),Math.round(x.top),Math.round(x.right),Math.round(x.bottom)]}));
let ok=true;for(const [id,l,t,rr,bb] of r){const pass=l>=65&&rr<=1015&&t>=270&&bb<=1540;ok=ok&&pass;console.log(pass?'ok  ':'FAIL',id,l,t,rr,bb)}
await p.screenshot({path:D+'phase-love-rugby-story-1080x1920.png'});
await p.goto(u+'?overlay');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);await p.screenshot({path:D+'safe-zone-check.png'});
await b.close();console.log(ok?'ALL INSIDE SAFE BAND':'SOMETHING OUTSIDE')})()
