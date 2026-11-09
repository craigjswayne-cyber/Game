import json, sys, subprocess, bisect, os
from PIL import Image, ImageDraw, ImageFilter
W = os.path.dirname(os.path.abspath(__file__))
FPS, DUR, SW, SH = 30, 15.0, 1080, 1920
N = int(FPS * DUR)
L = {k: Image.open(f'{W}/layers/{k}.png').convert('RGBA') for k in ['hook','setup','cap1','cap2','cap3','cap4','logo','free','stores']}

# background: office photo, darkened, 5% push-in over 15 s
hero = Image.open('/home/user/Game/src/ui/title-bg.webp').convert('RGB')
base = hero.resize((round(SW*1.05), round(SW*1.05*hero.height/hero.width)), Image.LANCZOS)
if base.height < SH*1.05: base = hero.resize((round(SH*1.05*hero.width/hero.height), round(SH*1.05)), Image.LANCZOS)
shade = Image.new('RGBA', (SW, SH))
d = ImageDraw.Draw(shade)
for y in range(SH):
    f = y / SH
    a = 0.55 + 0.25*max(0, 1 - f/0.2) + 0.30*max(0, (f-0.75)/0.25)
    d.line([(0,y),(SW,y)], fill=(6,10,8,int(min(a,0.92)*255)))
def background(t):
    z = 1.05 / (1 + 0.05*t/DUR)          # crop factor relative to the 1.05x master
    cw, ch = SW*1.05*z/1.05, SH*1.05*z/1.05
    cw, ch = SW*z, SH*z
    cx, cy = base.width/2, base.height/2
    im = base.crop((round(cx-cw/2), round(cy-ch/2), round(cx+cw/2), round(cy+ch/2))).resize((SW, SH), Image.BILINEAR)
    im = im.convert('RGBA'); im.alpha_composite(shade); return im

# recorded clips: (folder, source start s, speed)
def frames(root, clip):
    src = json.load(open(f'{W}/{root}/frames.json'))
    fr = [(t, f'{W}/{root}/{n}') for n, t in src if n.startswith(clip + '/')]
    t0 = fr[0][0]; return [t - t0 for t, _ in fr], [p for _, p in fr]
CLIPS = [dict(cap='cap1', fr=frames('rec3','leagues'), s0=0.0, sp=1.6, d=1.85),
         dict(cap='cap2', fr=frames('rec2','team'), s0=0.3, sp=1.6, d=1.85),
         dict(cap='cap3', fr=frames('rec2','moves'), s0=0.8, sp=1.8, d=1.8),
         dict(cap='cap4', fr=frames('q-Northampton','match'), s0=8.4, sp=2.0, d=2.5)]
G0, G1 = 3.5, 11.5
STARTS = [G0]
for c in CLIPS[:-1]: STARTS.append(STARTS[-1] + c['d'])
assert abs(STARTS[-1] + CLIPS[-1]['d'] - G1) < 1e-6
cache = {}
def src_frame(c, local):
    ts, ps = c['fr']; st = c['s0'] + local*c['sp']
    i = max(0, bisect.bisect_right(ts, st) - 1)
    p = ps[i]
    if p not in cache:
        if len(cache) > 40: cache.clear()
        cache[p] = Image.open(p).convert('RGB')
    return cache[p]

# phone
SCW, SCH, BZ, TOP, R = 446, 966, 18, 62, 66   # TOP: status-bar strip that holds the notch, above the screen
PW, PH = SCW + 2*BZ, SCH + TOP + BZ
mask_s = Image.new('L', (SCW, SCH), 0); md = ImageDraw.Draw(mask_s); md.rounded_rectangle([0,0,SCW-1,SCH-1], R-BZ, fill=255); md.rectangle([0,0,SCW-1,R], fill=255)
body = Image.new('RGBA', (PW, PH), (0,0,0,0)); bd = ImageDraw.Draw(body)
bd.rounded_rectangle([0,0,PW-1,PH-1], R, fill=(17,17,17,255), outline=(46,54,51,255), width=3)
def phone(img, scale=1.0, alpha=1.0, angle=-4):
    ph = body.copy()
    scr = img.resize((SCW, SCH), Image.LANCZOS).convert('RGBA')
    ph.paste(scr, (BZ, TOP), mask_s)
    ImageDraw.Draw(ph).rounded_rectangle([PW/2-52, 17, PW/2+52, 45], 14, fill=(0,0,0,255))
    pad = 60; big = Image.new('RGBA', (PW+2*pad, PH+2*pad), (0,0,0,0))
    sh = Image.new('RGBA', big.size, (0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([pad,pad+30,pad+PW,pad+PH+30], R, fill=(0,0,0,170))
    sh = sh.filter(ImageFilter.GaussianBlur(28)); big.alpha_composite(sh); big.alpha_composite(ph, (pad, pad))
    big = big.rotate(-angle, resample=Image.BICUBIC, expand=True)
    if scale != 1.0: big = big.resize((max(1,round(big.width*scale)), max(1,round(big.height*scale))), Image.BICUBIC)
    if alpha < 1.0: big.putalpha(big.getchannel('A').point(lambda a: int(a*alpha)))
    return big
PCX, PCY = 540, 992

def ease_out(x): x = min(max(x,0),1); return 1-(1-x)**3
def back_out(x): x = min(max(x,0),1); c=1.70158; return 1 + (c+1)*(x-1)**3 + c*(x-1)**2
def place(canvas, layer, scale=1.0, alpha=1.0, dy=0):
    if alpha <= 0: return
    bb = layer.getbbox(); cx, cy = (bb[0]+bb[2])/2, (bb[1]+bb[3])/2
    piece = layer.crop(bb)
    if scale != 1.0: piece = piece.resize((max(1,round(piece.width*scale)), max(1,round(piece.height*scale))), Image.BICUBIC)
    if alpha < 1.0: piece.putalpha(piece.getchannel('A').point(lambda a: int(a*alpha)))
    canvas.alpha_composite(piece, (round(cx - piece.width/2), round(cy - piece.height/2 + dy)))

def frame(i):
    t = i / FPS
    im = background(t)
    # hook 0 to 3.45: punch in under 0.3 s
    if t < 3.45:
        k = ease_out(t/0.25); s = 1.18 - 0.18*k; a = min(1, t/0.12)
        if t > 3.2: q = ease_out((t-3.2)/0.25); s *= 1 + 0.08*q; a *= 1 - q
        place(im, L['hook'], s, a)
    if 2.0 <= t < 3.45:
        k = ease_out((t-2.0)/0.25); a = k; dy = 70*(1-k)
        if t > 3.2: q = ease_out((t-3.2)/0.25); a *= 1 - q
        place(im, L['setup'], 1.0, a, dy)
    # gameplay
    if G0 <= t < G1 + 0.3:
        ci = max(i for i in range(len(CLIPS)) if t >= STARTS[i] - 1e-9); c = CLIPS[ci]; local = t - STARTS[ci]
        s, a = 1.0, 1.0
        if t < G0 + 0.25: k = ease_out((t-G0)/0.25); s = 0.82 + 0.18*k; a = k
        if t >= G1: q = ease_out((t-G1)/0.3); s = 1 - 0.15*q; a = 1 - q
        p = phone(src_frame(c, min(local, c['d'])), s, a)
        im.alpha_composite(p, (round(PCX - p.width/2), round(PCY - p.height/2)))
        if t < G1:
            k = ease_out(local/0.15); place(im, L[c['cap']], 1.12 - 0.12*k, min(1, local/0.08))
        else: place(im, L[c['cap']], 1.0, 1 - ease_out((t-G1)/0.2))
    # end card
    if t >= 11.7:
        k = (t-11.7)/0.35; place(im, L['logo'], 0.6 + 0.4*back_out(k), ease_out(k*1.6))
    if t >= 12.1:
        k = ease_out((t-12.1)/0.3); place(im, L['free'], 1.0, k, 30*(1-k))
    if t >= 12.3:
        k = ease_out((t-12.3)/0.3); place(im, L['stores'], 1.0, k, 40*(1-k))
    return im

ov = Image.new('RGBA', (SW, SH), (0,0,0,0)); od = ImageDraw.Draw(ov)
od.rectangle([0,0,SW,270], fill=(220,40,40,110)); od.rectangle([0,SH-380,SW,SH], fill=(220,40,40,110))
od.rectangle([0,270,65,SH-380], fill=(220,40,40,70)); od.rectangle([SW-65,270,SW,SH-380], fill=(220,40,40,70))
for y in (270, SH-380):
    for x in range(0, SW, 24): od.line([(x,y),(x+12,y)], fill=(255,255,255,255), width=3)
def overlay(im): o = im.copy(); o.alpha_composite(ov); return o

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'stills':
        for name, t in [('1-hook',1.0),('2-setup',2.8),('3-club',4.6),('4-team',6.4),('5-moves',8.2),('6-match',11.2),('7-endcard',14.0)]:
            overlay(frame(round(t*FPS))).convert('RGB').save(f'{W}/out/still-{name}.png')
    elif mode == 'video':
        def enc(path):
            return subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{SW}x{SH}','-r',str(FPS),'-i','-',
              '-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',str(DUR),'-map','0:v','-map','1:a',
              '-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-profile:v','high','-r',str(FPS),
              '-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',path], stdin=subprocess.PIPE)
        a, b = enc(f'{W}/out/phase-story-ad-15s.mp4'), enc(f'{W}/out/phase-story-ad-15s-safezones.mp4')
        for i in range(N):
            f = frame(i); a.stdin.write(f.convert('RGB').tobytes()); b.stdin.write(overlay(f).convert('RGB').tobytes())
            if i == N-1: f.convert('RGB').save(f'{W}/out/phase-story-endcard-1080x1920.png')
        a.stdin.close(); b.stdin.close(); a.wait(); b.wait()
