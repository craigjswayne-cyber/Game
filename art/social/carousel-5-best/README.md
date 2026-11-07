# Carousel: the five best things about PHASE

Seven 1080x1440 (3:4) slides: a cover, five feature slides and a download slide.
Post `slide-1.png` to `slide-7.png` in order. All claims come from `docs/store-listing.md`
and `README.md`.

To re-render after editing `carousel.html`, from the repo root:

```
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1440}});await p.goto('file://'+process.cwd()+'/art/social/carousel-5-best/carousel.html');await p.evaluate(()=>document.fonts.ready);const s=await p.\$\$('.slide');for(let i=0;i<s.length;i++){await s[i].screenshot({path:'art/social/carousel-5-best/slide-'+(i+1)+'.png'})}await b.close()})()"
```
