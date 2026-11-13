import bpy, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L, lighting as LT
ROOT = LT.ROOT; out = os.path.join(ROOT, "renders")
sc = bpy.context.scene
L.cycles_settings(samples=512); sc.view_settings.exposure = 0
sc.render.image_settings.color_depth = '8'
L.render_to(os.path.join(out, "baits_hero_v01.png"), bpy.data.objects["HeroCam"])
r = LT.compare(os.path.join(out, "baits_hero_v01.png"), os.path.join(ROOT, "refs", "hero_front.png"), os.path.join(out, "baits_hero_v01_diff.png"))
print("COMPARE", json.dumps({k: v["mae"] for k, v in r.items()}))
L.cycles_settings(samples=384, res=(1600, 1200)); sc.view_settings.exposure = 0
L.render_to(os.path.join(out, "baits_34_v01.png"), bpy.data.objects["Preview_34"])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blend", "baits_box_final_v01.blend"))
