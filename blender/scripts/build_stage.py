"""Usage: Blender -b --factory-startup --python build_stage.py -- <stage>
stage 1 = top (lid, dust flaps, tuck flap)
stage 2 = + side walls
stage 3 = + bottom
Each stage saves blend/baits_box_stageN.blend and clay previews in renders/."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L
importlib.reload(L)
from math import radians

stage = int(sys.argv[sys.argv.index("--") + 1])
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, "blend"), exist_ok=True)

L.reset_scene()
if stage >= 1:
    L.build_lid(); L.build_dust_flaps(); L.build_tuck_flap(); L.build_tuck_fold()
if stage >= 2:
    L.build_walls()
if stage >= 3:
    L.build_bottom()

hero = L.hero_camera()
q34 = L.preview_camera("Preview_34", (0.42, -0.62, 0.52), lens=55)
top = L.preview_camera("Preview_TopDetail", (0.10, -0.22, L.H + 0.16), target=(0, 0, L.H), lens=50)
low = L.preview_camera("Preview_Below", (0.30, -0.45, -0.18), target=(0, 0, 0.02), lens=50)

out = os.path.join(root, "renders")
if stage >= 4:
    L.apply_materials(os.path.join(root, "textures", "baits_walls_atlas.png"))
if stage == 4:
    L.preview_lighting(); L.cycles_settings(samples=32, res=(1400, 1000))
    L.render_to(os.path.join(out, "stage4_tex_34.png"), q34)
    L.render_to(os.path.join(out, "stage4_tex_top.png"), top)
    L.cycles_settings(samples=32)
    L.render_to(os.path.join(out, "stage4_tex_hero.png"), hero)
if stage >= 5:
    import lighting; importlib.reload(lighting); lighting.build(L, hero, out, q34)
if stage <= 3:
  L.clay_render(os.path.join(out, f"stage{stage}_clay_34.png"), q34)
  L.clay_render(os.path.join(out, f"stage{stage}_clay_top.png"), top)
  L.clay_render(os.path.join(out, f"stage{stage}_clay_hero.png"), hero, res=(2048, 1152))
if stage == 3:
    L.clay_render(os.path.join(out, f"stage{stage}_clay_below.png"), low)

import bpy
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root, "blend", f"baits_box_stage{stage}.blend"))
print("STAGE", stage, "OK", [o.name for o in bpy.data.objects])
