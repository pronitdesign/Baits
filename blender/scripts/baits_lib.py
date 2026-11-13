"""Baits Flow Crunch cereal box - modular build (units: metres).

Evidence: refs/hero_front.png (target view, 2048x1152) and refs/turnaround.png.
Assumed real width 190 mm; other dimensions derived from hero image ratios.
"""
import bpy, bmesh, math
from mathutils import Vector

MM = 0.001
W, H, D = 190 * MM, 251 * MM, 70 * MM   # outer body dimensions
T = 0.6 * MM        # paperboard thickness
RC = 1.2 * MM       # vertical fold radius
RB = 1.2 * MM       # bottom fold radius
RT = 1.2 * MM       # lid hinge radius (back top fold)
LIFT = 0.8 * MM     # lid rises slightly toward the front

# lid front notch (fractions of width from left, measured on hero)
NOTCH = (-0.165, -0.140, 0.140, 0.165)
NOTCH_DEPTH = 10 * MM
LID_CORNER = 4 * MM


def coll(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def new_obj(name, bm, collection="BOX_geometry", smooth_max_area=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    coll(collection).objects.link(ob)
    for p in me.polygons:
        p.use_smooth = smooth_max_area is None or p.area < smooth_max_area
    return ob


def solidify(ob, t=T, offset=-1.0):
    m = ob.modifiers.new("Board thickness", "SOLIDIFY")
    m.thickness = t; m.offset = offset; m.use_even_offset = True
    m.use_quality_normals = True; m.use_rim = True
    return m


def arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def ring(inset=0.0, n=6):
    """Rounded-rectangle ring, CCW from top, starting at mid-arc of the front-left corner.
    Returns list of (x, y, u) with u = arc length (closed ring; last point not repeated)."""
    hw, hd = W / 2 - inset, D / 2 - inset
    r = max(RC - inset, 0.02 * MM)
    pts = []
    pts += arc(-hw + r, -hd + r, r, 225, 270, n // 2)
    pts += arc(hw - r, -hd + r, r, 270, 360, n)
    pts += arc(hw - r, hd - r, r, 0, 90, n)
    pts += arc(-hw + r, hd - r, r, 90, 180, n)
    pts += arc(-hw + r, -hd + r, r, 180, 225, n // 2)
    # guard points so smooth shading of the folds does not bleed across flat panels
    g = 0.4 * MM
    guarded = []
    for i, p in enumerate(pts):
        guarded.append(p)
        if i + 1 < len(pts):
            a, b = Vector(p), Vector(pts[i + 1])
            seg = b - a
            if seg.length > 3 * g:
                guarded.append(tuple(a + seg.normalized() * g))
                guarded.append(tuple(b - seg.normalized() * g))
    pts = guarded
    clean = []
    for p in pts:
        if not clean or (Vector(p) - Vector(clean[-1])).length > 1e-7:
            clean.append(p)
    if (Vector(clean[0]) - Vector(clean[-1])).length < 1e-7:
        clean.pop()
    out, u = [], 0.0
    for i, p in enumerate(clean):
        if i:
            u += (Vector(p) - Vector(clean[i - 1])).length
        out.append((p[0], p[1], u))
    perim = u + (Vector(clean[0]) - Vector(clean[-1])).length
    return out, perim


def panel_widths():
    """Width of each panel in the atlas, split at corner mid-arcs: front, right, back, left."""
    a = math.pi * RC / 2
    return [W - 2 * RC + a, D - 2 * RC + a, W - 2 * RC + a, D - 2 * RC + a]


# ---------------------------------------------------------------- pieces
def build_walls():
    """Four side walls: rounded vertical folds, from top of bottom fold (z=RB) to z=H."""
    pts, perim = ring()
    zs = [RB + (H - RB) * k / 8 for k in range(9)]
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    rows = [[bm.verts.new((x, y, z)) for (x, y, _) in pts] for z in zs]
    n = len(pts)
    for k in range(len(zs) - 1):
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new([rows[k][i], rows[k][j], rows[k + 1][j], rows[k + 1][i]])
            u0, u1 = pts[i][2] / perim, (pts[j][2] if j else perim) / perim
            for loop, (uu, vv) in zip(f.loops, [(u0, zs[k]), (u1, zs[k]), (u1, zs[k + 1]), (u0, zs[k + 1])]):
                loop[uv].uv = (uu, vv / H)
    ob = new_obj("Box_Walls", bm)
    solidify(ob)
    return ob


def build_bottom():
    """Bottom panel with rounded fold into the walls (z from RB down to 0)."""
    pts0, perim = ring()
    m = 6
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    rows, zrow = [], []
    for k in range(m + 1):
        th = math.radians(90 * k / m)
        inset = RB * (1 - math.cos(th)); z = RB * (1 - math.sin(th))
        pts, _ = ring(inset)
        rows.append([bm.verts.new((x, y, z)) for (x, y, _) in pts]); zrow.append(z)
    n = len(rows[0])
    for k in range(m):
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new([rows[k + 1][i], rows[k + 1][j], rows[k][j], rows[k][i]])
            u0, u1 = pts0[i][2] / perim, (pts0[j][2] if j else perim) / perim
            for loop, (uu, vv) in zip(f.loops, [(u0, zrow[k + 1]), (u1, zrow[k + 1]), (u1, zrow[k]), (u0, zrow[k])]):
                loop[uv].uv = (uu, vv / H)
    cap = bm.faces.new(list(reversed(rows[-1])))
    cap.smooth = False
    for loop in cap.loops:
        loop[uv].uv = (0.001, 0.001)
    ob = new_obj("Box_Bottom", bm)
    solidify(ob)
    return ob


def lid_outline(hw, yf, yb):
    xs1, xs2, xs3, xs4 = [f * W for f in NOTCH]
    rc = LID_CORNER
    pts = [(-hw, yb), (-hw, yf + rc)]
    pts += arc(-hw + rc, yf + rc, rc, 180, 270, 6)[1:]
    pts += [(xs1, yf), (xs2, yf + NOTCH_DEPTH), (xs3, yf + NOTCH_DEPTH), (xs4, yf)]
    pts += arc(hw - rc, yf + rc, rc, 270, 360, 6)
    pts += [(hw, yb)]
    return pts


def build_lid():
    """Top lid hinged on the back wall, notched front edge, slight rise to the front."""
    hw = W / 2 - 0.3 * MM
    hd = D / 2
    yb = hd - RT
    yf = -hd + 0.2 * MM
    zt = H + RT
    bm = bmesh.new()
    # hinge: quarter circle from back wall top to horizontal lid
    hinge = []
    for k in range(7):
        th = math.radians(90 * k / 6)
        y = yb + RT * math.cos(th); z = H + RT * math.sin(th)
        hinge.append((bm.verts.new((-hw, y, z)), bm.verts.new((hw, y, z))))
    for k in range(6):
        a, b = hinge[k], hinge[k + 1]
        bm.faces.new([a[0], b[0], b[1], a[1]])
    outline = lid_outline(hw, yf, yb)
    verts = []
    for (x, y) in outline[1:-1]:
        rise = LIFT * (yb - y) / (yb - yf)
        verts.append(bm.verts.new((x, y, zt + rise)))
    # CCW polygon: back-left(hinge) -> left side -> front -> right side -> back-right(hinge)
    bm.faces.new([hinge[-1][0]] + verts + [hinge[-1][1]])
    ob = new_obj("Box_Lid", bm, smooth_max_area=0.002)
    solidify(ob)
    return ob


def build_dust_flaps():
    """Two side dust flaps folded inward, lying under the lid."""
    obs = []
    for side in (-1, 1):
        x0 = side * (W / 2 - T)
        x1 = side * (W / 2 - T - 28 * MM)
        y0, y1 = -D / 2 + T + 0.5 * MM, D / 2 - T - 0.5 * MM
        z = H + 0.3 * MM
        bm = bmesh.new()
        v = [bm.verts.new(p) for p in [(x0, y0, z), (x0, y1, z), (x1, y1 - 8 * MM, z + 0.3 * MM), (x1, y0 + 8 * MM, z + 0.3 * MM)]]
        f = bm.faces.new(v if side < 0 else list(reversed(v)))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
        ob = new_obj("Box_DustFlap_" + ("L" if side < 0 else "R"), bm)
        solidify(ob, offset=-1.0)
        obs.append(ob)
    return obs


def build_tuck_fold():
    """Horizontal part of the tuck flap under the lid: what shows through the front notch."""
    hw = W / 2 - 3 * MM
    y0 = -D / 2 + T + 0.2 * MM
    y1 = y0 + NOTCH_DEPTH + 6 * MM
    z = H + RT - T - 0.15 * MM
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-hw, y0, z), (hw, y0, z), (hw, y1, z), (-hw, y1, z)]]
    bm.faces.new(v)
    ob = new_obj("Box_TuckFold", bm)
    solidify(ob)
    return ob


def build_tuck_flap():
    """Tuck flap hanging from the lid front fold, inside the front wall."""
    hw = W / 2 - 3 * MM
    y = -D / 2 + T + 0.4 * MM
    ztop = H + RT - T
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in [(-hw, y, ztop - 20 * MM), (hw, y, ztop - 20 * MM), (hw, y, ztop), (-hw, y, ztop)]]
    bm.faces.new(v)
    ob = new_obj("Box_TuckFlap", bm)
    solidify(ob, offset=1.0)
    return ob


# ---------------------------------------------------------------- scene helpers
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    sc.render.resolution_x, sc.render.resolution_y = 2048, 1152
    return sc


def hero_camera():
    """Level camera with lens shift, solved from hero landmarks (see notes)."""
    cam = bpy.data.cameras.new("HeroCam")
    cam.lens = 85.5; cam.sensor_fit = 'HORIZONTAL'; cam.sensor_width = 36
    cam.shift_x = -0.0012; cam.shift_y = -0.5015
    cam.clip_start = 0.05; cam.clip_end = 20
    ob = bpy.data.objects.new("HeroCam", cam)
    coll("CAMERAS").objects.link(ob)
    ob.location = (0, -D / 2 - 1.346, 0.418)
    ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = ob
    return ob


def preview_camera(name, loc, target=(0, 0, H * 0.55), lens=60):
    cam = bpy.data.cameras.new(name); cam.lens = lens
    ob = bpy.data.objects.new(name, cam); coll("CAMERAS").objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def clay_render(path, cam, res=(1400, 1000)):
    sc = bpy.context.scene
    old = (sc.camera, sc.render.resolution_x, sc.render.resolution_y)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.85, 0.82, 0.8)
    sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_shadows = True
    sh.show_object_outline = True
    sc.display.shadow_shift = 0.1
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new("World")
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    sc.camera, sc.render.resolution_x, sc.render.resolution_y = old


# ---------------------------------------------------------------- stage 4: materials
def srgb_to_lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def _paper_bump(nt, bsdf, strength=0.06):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2500.0      # ~0.4 mm grain in object space (metres)
    noise.inputs["Detail"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.0002
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def board_material(name, color=None, image_path=None, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.0 if image_path else 0.3  # the photo texture already carries its sheen
    if image_path:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(image_path, check_existing=True)
        tex.image.colorspace_settings.name = 'sRGB'
        tex.interpolation = 'Cubic'
        uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UVMap"
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*srgb_to_lin(color), 1)
    _paper_bump(nt, bsdf, 0.02 if image_path else 0.05)
    return m


def apply_materials(atlas_path):
    pink = (0.752, 0.497, 0.625)     # sampled from hero front (sRGB)
    m_print = board_material("Board_Print_Atlas", image_path=atlas_path)
    m_plain = board_material("Board_Plain_Pink", color=pink)
    m_inside = board_material("Board_Inside_White", color=(0.86, 0.83, 0.80), rough=0.8)
    for ob in bpy.data.collections["BOX_geometry"].objects:
        ob.data.materials.clear()
        ob.data.materials.append(m_print if ob.name in ("Box_Walls", "Box_Bottom") else m_plain)
        ob.data.materials.append(m_inside)
        sol = next((md for md in ob.modifiers if md.type == "SOLIDIFY"), None)
        if sol:
            sol.material_offset = 1; sol.material_offset_rim = 1
    # bottom cap polygon gets the plain board
    bot = bpy.data.objects.get("Box_Bottom")
    if bot:
        bot.data.materials.append(m_plain)  # slot 2
        big = max(bot.data.polygons, key=lambda p: p.area)
        big.material_index = 2
        sol = next(md for md in bot.modifiers if md.type == "SOLIDIFY")
        sol.material_offset = 1  # inner side of slot 2 -> slot 3 (missing) falls back; keep simple


def preview_lighting():
    sc = bpy.context.scene
    w = sc.world or bpy.data.worlds.new("World"); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1); bg.inputs["Strength"].default_value = 1.0


def cycles_settings(samples=64, res=(2048, 1152), denoise=True):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'CYCLES'
    except TypeError as e:
        print("engine", e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = denoise
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print("GPU setup failed, CPU:", e)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'   # keeps printed artwork colours unaltered
    try:
        sc.view_settings.look = 'None'
    except TypeError:
        pass


def render_to(path, cam):
    sc = bpy.context.scene; sc.camera = cam
    sc.render.filepath = path; sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
