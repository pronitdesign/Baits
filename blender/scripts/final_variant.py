import bpy, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L, lighting as LT
from variants import VARIANTS
ROOT = LT.ROOT; out = os.path.join(ROOT, "renders")
name = sys.argv[sys.argv.index("--") + 1]; V = VARIANTS[name]
sc = bpy.context.scene
L.cycles_settings(samples=512); sc.view_settings.exposure = 0
f = V["front"]; fr = (f[0] + 8, f[1] + 12, f[2] - 8, f[3] - 15)
hp = os.path.join(out, f"baits_{name}_hero_v01.png")
L.render_to(hp, bpy.data.objects["HeroCam"])
r = LT.compare(hp, os.path.join(ROOT, V["ref"]), os.path.join(out, f"baits_{name}_hero_v01_diff.png"), front=fr)
print("COMPARE", json.dumps({k: v["mae"] for k, v in r.items()}))
L.cycles_settings(samples=384, res=(1600, 1200)); sc.view_settings.exposure = 0
L.render_to(os.path.join(out, f"baits_{name}_34_v01.png"), bpy.data.objects["Preview_34"])
sc.camera = bpy.data.objects["HeroCam"]; sc.render.resolution_x, sc.render.resolution_y = 2048, 1152
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blend", f"baits_{name}_final_v01.blend"))
