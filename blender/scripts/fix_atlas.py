"""Atlas v02: retype the broken front badges (350G / 12G / 80KCAL), remove the stray accent on CRUNCH,
sharpen the low-resolution side/back panels. Source atlas v01 is kept untouched."""
import bpy, os, sys, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "textures", "baits_walls_atlas.png")
DST = os.path.join(ROOT, "textures", "baits_walls_atlas_v02.png")
FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

im = bpy.data.images.load(SRC); W, H = im.size
A = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1].copy()   # top-down
PW = [round(x * 1000 * 8) for x in L.panel_widths()]
FRONT = (0, PW[0])

def lum(a): return a[..., :3].mean(-1)
def dark(a): return (a[..., 0] < 0.5) & (a[..., 1] < 0.22) & (a[..., 2] < 0.28)

# ---------------------------------------------------------------- 1) badges
y0, y1, x0, x1 = 1760, 1930, 880, FRONT[1] - 40
reg = A[y0:y1, x0:x1]
m = dark(reg)
cols = m.sum(0) > 6
runs, s = [], None
for i, c in enumerate(cols):
    if c and s is None: s = i
    if not c and s is not None:
        if i - s > 40: runs.append((s, i))
        s = None
if s is not None and len(cols) - s > 40: runs.append((s, len(cols)))
print("badges found:", len(runs), runs)
assert len(runs) == 3, "expected three badges"
labels = ["350G", "12G", "80KCAL"]
badges = []
for (a, b), text in zip(runs, labels):
    rows = np.where(m[:, a:b].sum(1) > 6)[0]
    bx0, bx1, by0, by1 = x0 + a, x0 + b, y0 + rows.min(), y0 + rows.max() + 1
    col = np.median(A[by0:by1, bx0:bx1][dark(A[by0:by1, bx0:bx1])][:, :3], 0)
    txt = A[by0:by1, bx0:bx1][lum(A[by0:by1, bx0:bx1]) > 0.6][:, :3]
    tcol = np.median(txt, 0) if len(txt) else np.array([0.95, 0.9, 0.88])
    badges.append(dict(box=(bx0, by0, bx1, by1), color=col, tcol=tcol, text=text))

# repaint each badge as a clean ellipse (anti-aliased) in its own sampled colour
yy, xx = np.mgrid[0:H, 0:W]
for bd in badges:
    bx0, by0, bx1, by1 = bd["box"]
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
    rx, ry = (bx1 - bx0) / 2 + 1.0, (by1 - by0) / 2 + 1.0
    sl = (slice(by0 - 6, by1 + 6), slice(bx0 - 6, bx1 + 6))
    d = np.sqrt(((xx[sl] - cx) / rx) ** 2 + ((yy[sl] - cy) / ry) ** 2)
    cov = np.clip((1 - d) * min(rx, ry) + 0.5, 0, 1)[..., None]
    A[sl][..., :3] = A[sl][..., :3] * (1 - cov) + bd["color"] * cov

# render the labels with Blender text (Workbench, flat white, transparent) at atlas pixel scale
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'SINGLE'
sc.display.shading.single_color = (1, 1, 1)
sc.display.shading.show_object_outline = False
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.resolution_percentage = 100
font = bpy.data.fonts.load(FONT)
cam = bpy.data.objects.new("TxtCam", bpy.data.cameras.new("TxtCam")); sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.location = (0, 0, 10); sc.camera = cam
for i, bd in enumerate(badges):
    bx0, by0, bx1, by1 = bd["box"]; w, h = bx1 - bx0, by1 - by0
    cu = bpy.data.curves.new(f"t{i}", 'FONT'); cu.body = bd["text"]; cu.font = font
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.size = 1.0
    ob = bpy.data.objects.new(f"t{i}", cu); sc.collection.objects.link(ob)
    bpy.context.view_layer.update()
    tw = ob.dimensions.x; th = ob.dimensions.y
    # fit: text width <= 72% of badge, cap height ~ 34% of badge height
    s = min(0.72 * w / tw, 0.36 * h / 0.72)
    ob.scale = (s, s, 1)
    for o in sc.collection.objects:
        if o.type == 'FONT': o.hide_render = (o is not ob)
    cam.data.ortho_scale = max(w, h)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    out = os.path.join(ROOT, "textures", f"_badge_{i}.png"); sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    t = bpy.data.images.load(out); tp = np.array(t.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    a = tp[..., 3:4]
    A[by0:by1, bx0:bx1, :3] = A[by0:by1, bx0:bx1, :3] * (1 - a) + bd["tcol"] * a
    os.remove(out)

# ---------------------------------------------------------------- 2) stray accent over the U of CRUNCH
# located by inspection at atlas x 262-290, y 1809-1824 (just above the U); donor = clean pink, same rows
ax0, ax1, ay0, ay1 = 262, 291, 1808, 1824
A[ay0:ay1, ax0:ax1] = A[ay0:ay1, 560:560 + (ax1 - ax0)].copy()
print("accent removed at", (ax0, ay0, ax1, ay1))

# ---------------------------------------------------------------- 3) sharpen panels (unsharp mask via FFT gaussian)
def gblur(img, sigma):
    h, w = img.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (math.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.stack([np.real(np.fft.ifft2(np.fft.fft2(img[..., c]) * g)) for c in range(3)], -1)
def unsharp(x0, x1, sigma, amount):
    p = A[:, x0:x1, :3]
    A[:, x0:x1, :3] = np.clip(p + amount * (p - gblur(p, sigma)), 0, 1)
edges = np.cumsum([0] + PW)
unsharp(edges[0], edges[1], 2.0, 0.45)            # front (from 3.6 px/mm photo)
for k in (1, 2, 3):                                 # sides + back (from 2 px/mm sheet)
    unsharp(edges[k], edges[k + 1], 3.2, 1.1)

# ---------------------------------------------------------------- save
A[..., 3] = 1
out = bpy.data.images.new("atlas_v02", W, H, alpha=False)
out.pixels = A[::-1].ravel(); out.filepath_raw = DST; out.file_format = 'PNG'; out.save()
print("SAVED", DST)
