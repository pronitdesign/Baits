"""Usage: Blender -b --factory-startup --python make_variant_atlas.py -- <variant>
Front: crop of the flavour hero photo + retyped badges.
Sides/back: Flow Crunch v02 panels recoloured (board colour, character colour, side logo + flavour name)."""
import bpy, os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L
from variants import VARIANTS, BADGES
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
name = sys.argv[sys.argv.index("--") + 1]; V = VARIANTS[name]

def load(p):
    im = bpy.data.images.load(os.path.join(ROOT, p)); w, h = im.size
    return np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
def lin(c): c = np.asarray(c, np.float32); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
def rgb(t): return np.array(t, np.float32) / 255

base = load("textures/baits_walls_atlas_v02.png")          # Flow Crunch atlas (top-down)
H, W = base.shape[:2]
PW = [round(x * 1000 * 8) for x in L.panel_widths()]
E = np.cumsum([0] + PW)
hero = load(V["ref"])
A = base.copy()

# ---------------------------------------------------------------- front panel from the flavour photo
x0, y0, x1, y1 = V["front"]
c = hero[y0:y1, x0:x1].copy()
t = bpy.data.images.new("crop", x1 - x0, y1 - y0, alpha=True, float_buffer=True)
t.colorspace_settings.name = 'sRGB'; t.pixels = c[::-1].ravel(); t.scale(PW[0], H)
A[:, :PW[0]] = np.array(t.pixels[:], np.float32).reshape(H, PW[0], 4)[::-1]
box = np.mean([hero[y - 8:y + 8, x - 8:x + 8, :3].reshape(-1, 3).mean(0) for x, y in V["box_samples"]], 0)
print("box sRGB", (box * 255).round(1))

# ---------------------------------------------------------------- text rendering helper (Blender text -> RGBA)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'SINGLE'; sh.single_color = (1, 1, 1)
sh.show_object_outline = False
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
font = bpy.data.fonts.load(FONT)
cam = bpy.data.objects.new("TxtCam", bpy.data.cameras.new("TxtCam")); sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.location = (0, 0, 10); sc.camera = cam
def text_alpha(text, w, h, fill_w=0.72, cap_h=0.36, line_gap=1.0):
    for o in [o for o in sc.collection.objects if o.type == 'FONT']: bpy.data.objects.remove(o)
    cu = bpy.data.curves.new("t", 'FONT'); cu.body = text; cu.font = font
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.space_line = line_gap
    ob = bpy.data.objects.new("t", cu); sc.collection.objects.link(ob); bpy.context.view_layer.update()
    s = min(fill_w * w / ob.dimensions.x, cap_h * h / 0.72 if "\n" not in text else 0.95 * h / ob.dimensions.y)
    ob.scale = (s, s, 1); cam.data.ortho_scale = max(w, h)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    out = os.path.join(ROOT, "textures", "_txt.png"); sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(out); a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1, :, 3:4].copy()
    bpy.data.images.remove(im); os.remove(out); return a

# ---------------------------------------------------------------- badges on the front
def dark(a): return (a[..., 0] < 0.5) & (a[..., 1] < 0.22) & (a[..., 2] < 0.28)
ry0, ry1, rx0, rx1 = 1740, 1950, 820, PW[0] - 30
m = dark(A[ry0:ry1, rx0:rx1]); cols = m.sum(0) > 6
runs, s = [], None
for i, cc in enumerate(list(cols) + [False]):
    if cc and s is None: s = i
    if not cc and s is not None:
        if i - s > 40: runs.append((s, i))
        s = None
print("badges", runs); assert len(runs) == 3
yy, xx = np.mgrid[0:H, 0:W]
for (a, b), label in zip(runs, BADGES):
    rows = np.where(m[:, a:b].sum(1) > 6)[0]
    bx0, bx1, by0, by1 = rx0 + a, rx0 + b, ry0 + rows.min(), ry0 + rows.max() + 1
    reg = A[by0:by1, bx0:bx1]
    col = np.median(reg[dark(reg)][:, :3], 0)
    lt = reg[reg[..., :3].mean(-1) > 0.6][:, :3]; tcol = np.median(lt, 0) if len(lt) else np.array([.95, .92, .88])
    cx, cy, rx, ryy = (bx0 + bx1) / 2, (by0 + by1) / 2, (bx1 - bx0) / 2 + 1, (by1 - by0) / 2 + 1
    sl = (slice(by0 - 6, by1 + 6), slice(bx0 - 6, bx1 + 6))
    d = np.sqrt(((xx[sl] - cx) / rx) ** 2 + ((yy[sl] - cy) / ryy) ** 2)
    cov = np.clip((1 - d) * min(rx, ryy) + 0.5, 0, 1)[..., None]
    A[sl][..., :3] = A[sl][..., :3] * (1 - cov) + col * cov
    al = text_alpha(label, bx1 - bx0, by1 - by0)
    A[by0:by1, bx0:bx1, :3] = A[by0:by1, bx0:bx1, :3] * (1 - al) + tcol * al

# ---------------------------------------------------------------- recolour sides + back
old_bg = lin(np.median(base[440:500, E[1] + 40:E[2] - 40, :3].reshape(-1, 3), 0))   # plain board between logo and character
new_bg = lin(box)
old_brain = lin(rgb((204, 88, 90))); new_brain = lin(rgb(V["brain_rgb"]))
for k in (1, 2, 3):
    p = lin(A[:, E[k]:E[k + 1], :3])
    def weight(ref, tol):
        # chroma-normalised distance so lighting/grain variation still counts as the same ink
        pn = p / np.maximum(p.sum(-1, keepdims=True), 1e-4); rn = ref / ref.sum()
        d = np.linalg.norm(pn - rn, axis=-1) + 0.05 * np.abs(np.log((p.sum(-1) + 1e-3) / (ref.sum() + 1e-3)))
        core = 0.06
        return np.clip((tol - d) / (tol - core), 0, 1)[..., None]
    wb = weight(old_bg, 0.17); wr = weight(old_brain, 0.10)
    p = p * (1 - wb) + p * (new_bg / old_bg) * wb
    p = p * (1 - wr) + p * (new_brain / old_brain) * wr
    A[:, E[k]:E[k + 1], :3] = srgb(p)

# side panels: replace "Baits" logo colour and the flavour name
def ink_bbox(x0, x1, y0, y1):
    mm = dark(A[y0:y1, x0:x1]); ys, xs = np.where(mm)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1
_g = lin(base[378:440, E[1] + 40:E[2] - 40, :3]) * (lin(box) / old_bg)   # clean strip under the logo
_g = srgb(_g); _g = np.concatenate([_g, _g[::-1]], 0); grain_src = np.concatenate([_g, _g[:, ::-1]], 1)
for k in (1, 3):
    px0, px1 = E[k] + 20, E[k + 1] - 20
    # logo: dark ink in the top band -> side_logo colour (keeps anti-aliasing via darkness weight)
    lx0, ly0, lx1, ly1 = ink_bbox(px0, px1, 60, 420)
    reg = A[ly0:ly1, lx0:lx1, :3]
    ink = np.clip((0.55 - base[ly0:ly1, lx0:lx1, :3].mean(-1)) / 0.35, 0, 1)[..., None]   # ink coverage from the original pink panel
    A[ly0:ly1, lx0:lx1, :3] = reg * (1 - ink) + rgb(V["side_logo_rgb"]) * ink
    # flavour name: find the two dark text lines below the character, clear them, retype
    fx0, fy0, fx1, fy1 = ink_bbox(px0, px1, 1060, 1420)
    pad = 14
    fy0, fy1, fx0, fx1 = fy0 - pad, fy1 + pad, max(px0, fx0 - pad), min(px1, fx1 + pad)
    h_, w_ = fy1 - fy0, fx1 - fx0
    g = np.tile(grain_src, (h_ // grain_src.shape[0] + 1, w_ // grain_src.shape[1] + 1, 1))[:h_, :w_]
    # feathered paste so the cleared area has no visible rectangle
    fy_, fx_ = np.mgrid[0:h_, 0:w_]
    edge = np.minimum.reduce([fy_, fx_, h_ - 1 - fy_, w_ - 1 - fx_]).astype(np.float32)
    f = np.clip(edge / pad, 0, 1)[..., None]
    A[fy0:fy1, fx0:fx1, :3] = A[fy0:fy1, fx0:fx1, :3] * (1 - f) + g * f
    al = text_alpha("\n".join(V["name"]), w_ - 2 * pad, h_ - 2 * pad, fill_w=0.98, line_gap=0.85)
    A[fy0 + pad:fy1 - pad, fx0 + pad:fx1 - pad, :3] = A[fy0 + pad:fy1 - pad, fx0 + pad:fx1 - pad, :3] * (1 - al) + rgb(V["side_text_rgb"]) * al
    print("side", k, "logo", (lx0, ly0, lx1, ly1), "name", (fx0, fy0, fx1, fy1))

A[..., 3] = 1
out = os.path.join(ROOT, "textures", f"baits_walls_atlas_{name}.png")
img = bpy.data.images.new("atlas", W, H, alpha=False); img.pixels = A[::-1].ravel()
img.filepath_raw = out; img.file_format = 'PNG'; img.save()
open(os.path.join(ROOT, "textures", f"box_color_{name}.txt"), "w").write(" ".join(f"{v:.4f}" for v in box))
print("SAVED", out)
