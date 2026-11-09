const {chromium}=require('playwright');const W=process.argv[2];(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+W+'/layers.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
for(const id of ['hook','setup','cap1','cap2','cap3','cap4','logo','free','stores']){await p.evaluate(id=>{document.querySelectorAll('.L').forEach(e=>e.classList.toggle('on',e.id===id))},id);await p.waitForTimeout(50);await p.screenshot({path:W+'/layers/'+id+'.png',omitBackground:true})}
await b.close()})()
