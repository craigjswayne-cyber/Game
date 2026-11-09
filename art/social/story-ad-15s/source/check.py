import render as R
from PIL import Image
boxes=[]; T=[0]
orig=Image.Image.alpha_composite
def ac(self, im, dest=(0,0), source=(0,0)):
    if self.size==(1080,1920) and im.size!=self.size:
        bb=im.getchannel('A').point(lambda a:255 if a>180 else 0).getbbox()
        if bb: boxes.append((T[0],dest[0]+bb[0],dest[1]+bb[1],dest[0]+bb[2],dest[1]+bb[3]))
    return orig(self, im, dest, source)
Image.Image.alpha_composite=ac
R.background=lambda t: Image.new('RGBA',(1080,1920))
for i in range(R.N): T[0]=i/R.FPS; R.frame(i)
bad=[b for b in boxes if b[1]<65 or b[3]>1015 or b[2]<270 or b[4]>1540]
print('elements checked',len(boxes),'outside',len(bad))
for b in bad[:8]: print(' t=%.2f box=%s'%(b[0],b[1:]))
ext=[min(b[1] for b in boxes),min(b[2] for b in boxes),max(b[3] for b in boxes),max(b[4] for b in boxes)]
print('extent of all content: left %d top %d right %d bottom %d'%tuple(ext))
