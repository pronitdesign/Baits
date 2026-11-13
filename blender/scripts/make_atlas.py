"""Build the wall texture atlas (front | right | back | left) at 8 px/mm from the references."""
import bpy, numpy as np, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PXMM = 8
def load(p):
    im = bpy.data.images.load(os.path.join(root, p)); im.colorspace_settings.name = 'sRGB'
    return im
def crop(im, x0, y0, x1, y1, w, h, flip=False):
    W0, H0 = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(H0, W0, 4)
    c = a[H0 - y1:H0 - y0, x0:x1].copy()
    if flip: c = c[:, ::-1]
    t = bpy.data.images.new("tmp", x1 - x0, y1 - y0, alpha=True, float_buffer=True)
    t.colorspace_settings.name = 'sRGB'
    t.pixels = c.ravel(); t.scale(w, h)
    out = np.array(t.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(t); return out
hero = load("refs/hero_front.png"); turn = load("refs/turnaround.png")
pw = [round(x * 1000 * PXMM) for x in L.panel_widths()]
Hpx = round(L.H * 1000 * PXMM)
front = crop(hero, 683, 152, 1371, 1061, pw[0], Hpx)
right = crop(turn, 901, 37, 1043, 544, pw[1], Hpx)
back  = crop(turn, 162, 640, 550, 1152, pw[2], Hpx)
left  = crop(turn, 901, 37, 1043, 544, pw[3], Hpx)   # unseen: reuse right-side artwork
# colour-match turnaround panels to the hero: per-channel gain from the same clean pink area on both fronts
def mean(im, x0, y0, x1, y1):
    W0, H0 = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(H0, W0, 4)
    return a[H0 - y1:H0 - y0, x0:x1, :3].reshape(-1, 3).mean(0)
def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
# clean pink right of the bowl, below spoon: hero (1290..1340, 600..700) <-> turnaround front (500..535, 260..310)
gain = lin(mean(hero, 1290, 600, 1340, 700)) / lin(mean(turn, 500, 260, 535, 310))
print("GAIN", gain.round(3))
for pan in (right, back, left):
    pan[..., :3] = srgb(lin(pan[..., :3]) * gain)
atlas = np.concatenate([front, right, back, left], axis=1)
atlas[..., 3] = 1
h, w = atlas.shape[:2]
img = bpy.data.images.new("atlas", w, h, alpha=False)
img.pixels = atlas.ravel()
img.filepath_raw = os.path.join(root, "textures", "baits_walls_atlas.png"); img.file_format = 'PNG'; img.save()
# plain board colour sampled from the hero lid and a clean front area
a = np.array(hero.pixels[:], dtype=np.float32).reshape(1152, 2048, 4)
lid = a[1152 - 140:1152 - 126, 760:880, :3].reshape(-1, 3).mean(0)
pink = a[1152 - 700:1152 - 600, 1290:1340, :3].reshape(-1, 3).mean(0)
print("ATLAS", w, h, pw, "lid sRGB", lid.round(4), "front pink sRGB", pink.round(4))
