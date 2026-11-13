"""Render each light alone (linear EXR) and least-squares fit their intensities to the hero photo."""
import bpy, sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L, lighting as LT
ROOT = LT.ROOT; out = os.path.join(ROOT, "renders", "passes"); os.makedirs(out, exist_ok=True)
sc = bpy.context.scene; hero = bpy.data.objects["HeroCam"]
# extra light that evens out the right side of the backdrop
if "Light_Backdrop_Right" not in bpy.data.objects:
    LT.area(L, "Light_Backdrop_Right", 100, 1.5, (1.4, -0.9, 0.9), target=(0.6, 1.0, 0.3))
lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
bgn = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
base = {o.name: o.data.energy for o in lights}; base_world = 1.0
L.cycles_settings(samples=48, res=(1024, 576)); sc.view_settings.exposure = 0
sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'
def load(path):
    im = bpy.data.images.load(path, check_existing=False); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]; bpy.data.images.remove(im); return a
passes = {}
for src in [o.name for o in lights] + ["World"]:
    for o in lights: o.data.energy = base[o.name] if o.name == src else 0
    bgn.inputs["Strength"].default_value = base_world if src == "World" else 0
    path = os.path.join(out, src + ".exr"); sc.render.filepath = path; sc.camera = hero
    bpy.ops.render.render(write_still=True); passes[src] = load(path)
REF = os.environ.get("BAITS_REF", "refs/hero_front.png")
ref = load(os.path.join(ROOT, REF))
ref = ref.reshape(576, 2, 1024, 2, 3).mean((1, 3))
ref = np.where(ref <= 0.04045, ref / 12.92, ((ref + 0.055) / 1.055) ** 2.4)
names = list(passes)
# weight map: box front x3, everything else x1 (in 1024x576 space)
fx0, fy0, fx1, fy1 = [int(v) // 2 for v in os.environ.get("BAITS_FRONT", "683,152,1370,1060").split(",")]
wmap = np.ones((576, 1024), np.float32); wmap[fy0:fy1, fx0:fx1] = 3.0
wmap[fy1 - 40:fy1 - 2, fx1 + 5:1024] = 8.0   # long shadow band right of the box
wmap[fy1 - 20:fy1 + 20, 150:fx0 - 20] = 3.0  # bright floor left of the box
A = np.stack([passes[n].reshape(-1) for n in names], 1); b = ref.reshape(-1)
wv = np.repeat(wmap.reshape(-1), 3)
active = list(range(len(names)))
while True:
    x, *_ = np.linalg.lstsq(A[:, active] * wv[:, None], b * wv, rcond=None)
    if (x >= 0).all(): break
    active.pop(int(np.argmin(x)))
coef = dict.fromkeys(names, 0.0); coef.update({names[i]: float(v) for i, v in zip(active, x)})
print("COEF", json.dumps({k: round(v, 4) for k, v in coef.items()}))
fit = (A @ np.array([coef[n] for n in names])).reshape(576, 1024, 3)
srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
err = np.abs(np.clip(srgb(fit), 0, 1) - srgb(ref)) * 255
print("FIT MAE frame", round(float(err.mean()), 2), "front", round(float(err[fy0:fy1, fx0:fx1].mean()), 2), "bg", round(float(err[:, :300].mean()), 2), round(float(err[:, 730:].mean()), 2))
for o in lights: o.data.energy = base[o.name] * coef[o.name]
bgn.inputs["Strength"].default_value = base_world * coef["World"]
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
json.dump({"lights": {o.name: o.data.energy for o in lights}, "world": bgn.inputs["Strength"].default_value},
          open(os.path.join(ROOT, "scripts", os.environ.get("BAITS_NAME", "flow_crunch") + "_light_solution.json"), "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blend", os.environ.get("BAITS_OUT", "baits_box_stage5_lit.blend")))
