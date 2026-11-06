# Pinned landing post

`phase-pinned-post-1080x1440.png` is the 3:4 pinned post for the PHASE social accounts
(@phaserugbymanager). It is rendered from `post.html`, which uses the fonts, hero art and
icon in `landing/`.

To re-render after a copy change, from the repo root:

```
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1440}});await p.goto('file://'+process.cwd()+'/art/social/pinned-post/post.html');await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:'art/social/pinned-post/phase-pinned-post-1080x1440.png'});await b.close()})()"
```
