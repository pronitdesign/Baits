"""Stage 5: studio cyclorama + lights matched to the hero photo, Cycles render, numeric comparison."""
import bpy, bmesh, math, os, json
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAMS_FILE = os.path.join(ROOT, "scripts", "light_params.json")
DEFAULT = {
    "key_power": 1600.0, "key_size": 1.0, "key_loc": [-4.0, 0.05, 0.42],
    "fill_power": 120.0, "fill_size": 1.6, "fill_loc": [-0.15, -1.6, 0.55],
    "top_power": 60.0, "top_size": 1.2, "top_loc": [0.0, -0.2, 1.4],
    "world": 0.35, "backdrop_albedo": 0.86, "exposure": 0.0,
    "samples": 256, "tune_res": 0.5,
}


def params():
    p = dict(DEFAULT)
    if os.path.exists(PARAMS_FILE):
        p.update(json.load(open(PARAMS_FILE)))
    return p


def cyclorama(L):
    bm = bmesh.new()
    xs = (-3.0, 3.0)
    prof = [(-4.0, 0.0), (0.4, 0.0)]
    r = 0.6
    for k in range(1, 13):
        a = math.radians(90 * k / 12)
        prof.append((0.4 + r * math.sin(a), r - r * math.cos(a)))
    prof.append((0.4 + r, 3.0))
    rows = [(bm.verts.new((xs[0], y, z)), bm.verts.new((xs[1], y, z))) for y, z in prof]
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new([a[0], a[1], b[1], b[0]])
    me = bpy.data.meshes.new("Studio_Cyclorama"); bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    ob = bpy.data.objects.new("Studio_Cyclorama", me)
    L.coll("STUDIO").objects.link(ob)
    return ob


def area(L, name, power, size, loc, target=(0, 0, 0.09)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.shape = 'DISK'; ld.size = size
    ob = bpy.data.objects.new(name, ld); L.coll("STUDIO").objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


def load_px(path):
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]
    bpy.data.images.remove(im)
    return a


def compare(render_path, ref_path, out_diff, front=(700, 170, 1355, 1045)):
    r = load_px(render_path); f = load_px(ref_path)
    if r.shape != f.shape:  # tuning renders are half-size: subsample ref
        s = f.shape[0] // r.shape[0]
        f = f[:r.shape[0] * s, :r.shape[1] * s].reshape(r.shape[0], s, r.shape[1], s, 3).mean((1, 3))
    h, w = r.shape[:2]
    def box(x0, y0, x1, y1):
        return (slice(int(y0 * h / 1152), int(y1 * h / 1152)), slice(int(x0 * w / 2048), int(x1 * w / 2048)))
    regions = {"front": box(*front), "bg_left": box(50, 50, 600, 900),
               "bg_right": box(1450, 50, 2000, 900), "shadow_band": box(1380, 960, 2000, 1050),
               "floor": box(50, 1070, 2000, 1150), "frame": box(0, 0, 2048, 1152)}
    res = {}
    for k, sl in regions.items():
        res[k] = {"render": (r[sl].reshape(-1, 3).mean(0) * 255).round(1).tolist(),
                  "ref": (f[sl].reshape(-1, 3).mean(0) * 255).round(1).tolist(),
                  "mae": round(float(np.abs(r[sl] - f[sl]).mean() * 255), 2)}
    d = np.clip(np.abs(r - f) * 4, 0, 1)
    img = bpy.data.images.new("diff", w, h); px = np.ones((h, w, 4), np.float32); px[..., :3] = d[::-1]
    img.pixels = px.ravel(); img.filepath_raw = out_diff; img.file_format = 'PNG'; img.save()
    return res


def build(L, hero, out, q34, final=None):
    p = params()
    final = final if final is not None else bool(int(os.environ.get("BAITS_FINAL", "0")))
    cyc = cyclorama(L)
    cyc.data.materials.append(L.board_material("Studio_Backdrop", color=(p["backdrop_albedo"],) * 3, rough=0.9))
    # backdrop must not pick up the paper bump
    bd = cyc.data.materials[0].node_tree
    for n in list(bd.nodes):
        if n.type in ("BUMP", "TEX_NOISE", "TEX_COORD"):
            bd.nodes.remove(n)
    area(L, "Light_Key_Left", p["key_power"], p["key_size"], p["key_loc"])
    area(L, "Light_Fill_Front", p["fill_power"], p["fill_size"], p["fill_loc"], target=(0, 0, 0.13))
    area(L, "Light_Top_Soft", p["top_power"], p["top_size"], p["top_loc"], target=(0, 0, 0.1))
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new("World"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (1, 1, 1, 1); bg.inputs["Strength"].default_value = p["world"]

    if final:
        L.cycles_settings(samples=p["samples"] * 4)
        sc.view_settings.exposure = p["exposure"]
        L.render_to(os.path.join(out, "stage5_final_hero.png"), hero)
        res = compare(os.path.join(out, "stage5_final_hero.png"), os.path.join(ROOT, "refs", "hero_front.png"),
                      os.path.join(out, "stage5_final_diff.png"))
        L.cycles_settings(samples=p["samples"] * 2, res=(1600, 1200))
        sc.view_settings.exposure = p["exposure"]
        L.render_to(os.path.join(out, "stage5_final_34.png"), q34)
    else:
        L.cycles_settings(samples=p["samples"], res=(int(2048 * p["tune_res"]), int(1152 * p["tune_res"])))
        sc.view_settings.exposure = p["exposure"]
        L.render_to(os.path.join(out, "stage5_tune_hero.png"), hero)
        res = compare(os.path.join(out, "stage5_tune_hero.png"), os.path.join(ROOT, "refs", "hero_front.png"),
                      os.path.join(out, "stage5_tune_diff.png"))
    print("COMPARE", json.dumps(res))
    return res
