"""Iteratively fit exposure / backdrop / key-vs-fill balance to the hero photo (opens stage5 blend)."""
import bpy, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import baits_lib as L, lighting as LT
ROOT = LT.ROOT; out = os.path.join(ROOT, "renders")
sc = bpy.context.scene; hero = bpy.data.objects["HeroCam"]
def lin(v): v = v / 255; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def lum(c): return sum(lin(x) for x in c) / 3
p = LT.params(); p["samples"] = 48
key, fill, top = (bpy.data.objects[n].data for n in ("Light_Key_Left", "Light_Fill_Front", "Light_Top_Soft"))
bgn = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
for it in range(int(sys.argv[sys.argv.index("--") + 1])):
    L.cycles_settings(samples=p["samples"], res=(1024, 576)); sc.view_settings.exposure = p["exposure"]
    path = os.path.join(out, "stage5_tune_hero.png"); L.render_to(path, hero)
    r = LT.compare(path, os.path.join(ROOT, "refs", "hero_front.png"), os.path.join(out, "stage5_tune_diff.png"))
    fr, bgl, bgr, sh = (lum(r[k]["render"]) for k in ("front", "bg_left", "bg_right", "shadow_band"))
    fr0, bgl0, bgr0, sh0 = (lum(r[k]["ref"]) for k in ("front", "bg_left", "bg_right", "shadow_band"))
    print(f"IT {it} exp {p['exposure']:.2f} key {p['key_power']:.0f} fill {p['fill_power']:.0f} top {p['top_power']:.0f} world {p['world']:.3f} | "
          f"MAE front {r['front']['mae']} bgL {r['bg_left']['mae']} bgR {r['bg_right']['mae']} shadow {r['shadow_band']['mae']} frame {r['frame']['mae']}")
    sat = max(r["bg_left"]["render"]) >= 254.5
    # 1) global exposure from the front panel
    p["exposure"] += max(-2, min(2, math.log2(fr0 / max(fr, 1e-4)))) if not sat or fr > fr0 else -1.0
    # 2) shadow depth: ratio shadow/background governed by key share of floor light
    if not sat:
        want, got = sh0 / bgr0, sh / max(bgr, 1e-4)
        k = max(0.6, min(1.6, (1 - want) / max(1 - got, 0.02)))
        p["key_power"] *= k; p["top_power"] /= k ** 0.5; p["world"] /= k ** 0.5
        # 3) background level relative to front: world + top light the backdrop more than the front
        bgk = max(0.7, min(1.4, ((bgl0 + bgr0) / (bgl + bgr)) / (fr0 / fr)))
        p["world"] *= bgk; p["top_power"] *= bgk
        # 4) left/right background gradient from key
        lr = max(0.8, min(1.25, (bgl0 / bgr0) / (bgl / bgr)))
        p["key_power"] *= lr
    key.energy, fill.energy, top.energy = p["key_power"], p["fill_power"], p["top_power"]
    bgn.inputs["Strength"].default_value = p["world"]
    json.dump({k: p[k] for k in ("key_power", "fill_power", "top_power", "world", "exposure")}, open(LT.PARAMS_FILE, "w"), indent=1)
print("FINAL", json.dumps(r))
