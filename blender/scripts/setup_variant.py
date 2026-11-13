"""Open the approved Flow Crunch blend, swap flavour texture/colour and fit the hero camera to the flavour photo."""
import bpy, sys, os, json
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view as w2c
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L
from variants import VARIANTS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[sys.argv.index("--") + 1]; V = VARIANTS[name]
sc = bpy.context.scene

img = bpy.data.images.load(os.path.join(ROOT, "textures", f"baits_walls_atlas_{name}.png")); img.colorspace_settings.name = 'sRGB'
next(n for n in bpy.data.materials["Board_Print_Atlas"].node_tree.nodes if n.type == "TEX_IMAGE").image = img
box = [float(v) for v in open(os.path.join(ROOT, "textures", f"box_color_{name}.txt")).read().split()]
plain = bpy.data.materials["Board_Plain_Pink"]; plain.name = "Board_Plain_Flavour"
next(n for n in plain.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*L.srgb_to_lin(box), 1)

cam = bpy.data.objects["HeroCam"]
fy = -L.D / 2
P = {"front TL": (-L.W/2, fy, L.H), "front TR": (L.W/2, fy, L.H), "front BL": (-L.W/2, fy, 0), "front BR": (L.W/2, fy, 0),
     "lid back L": (-L.W/2, L.D/2, L.H + L.RT), "lid back R": (L.W/2, L.D/2, L.H + L.RT)}
keys = list(V["marks"]); target = np.array([V["marks"][k] for k in keys], float).ravel()
def project():
    bpy.context.view_layer.update()
    out = []
    for k in keys:
        v = w2c(sc, cam, Vector(P[k])); out += [v.x * 2048, (1 - v.y) * 1152]
    return np.array(out)
def setp(x):
    cam.location.x, cam.location.y, cam.location.z = x[0], x[1], x[2]
    cam.data.lens, cam.data.shift_x, cam.data.shift_y = x[3], x[4], x[5]
x = np.array([cam.location.x, cam.location.y, cam.location.z, cam.data.lens, cam.data.shift_x, cam.data.shift_y])
steps = np.array([1e-4, 1e-3, 1e-3, 0.05, 1e-4, 1e-4])
for it in range(25):                               # Gauss-Newton with damping
    setp(x); r = project() - target
    J = np.zeros((len(r), len(x)))
    for i in range(len(x)):
        xd = x.copy(); xd[i] += steps[i]; setp(xd); J[:, i] = (project() - target - r) / steps[i]
    dx = np.linalg.solve(J.T @ J + 1e-3 * np.diag(np.diag(J.T @ J)), -J.T @ r)
    x = x + dx
setp(x); r = project() - target
print("CAMERA", dict(loc=[round(v, 4) for v in x[:3]], lens=round(x[3], 2), shift=[round(x[4], 4), round(x[5], 4)]))
for k, (px, py), (rx, ry) in zip(keys, project().reshape(-1, 2), r.reshape(-1, 2)):
    print(f"  {k:11s} model ({px:7.1f},{py:7.1f})  ref {V['marks'][k]}  err {np.hypot(rx, ry):.1f}px")
sc.camera = cam
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blend", f"baits_{name}_setup.blend"))
