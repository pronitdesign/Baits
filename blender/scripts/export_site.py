"""Export one flavour for the website: GLB (JPEG textures) + transparent 3/4 thumbnail. Does not save the blend."""
import bpy, os, sys
name = sys.argv[sys.argv.index("--") + 1]
site = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "site", "assets")
box = list(bpy.data.collections["BOX_geometry"].objects)
bpy.ops.object.select_all(action='DESELECT')
for o in box: o.select_set(True)
bpy.context.view_layer.objects.active = box[0]
glb = os.path.join(site, f"baits-{name}.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_image_format='JPEG', export_jpeg_quality=88, export_materials='EXPORT')
print("GLB", glb, os.path.getsize(glb))
sc = bpy.context.scene
for o in bpy.data.objects:
    if o.name.startswith("Studio_"): o.hide_render = True
sc.render.film_transparent = True
sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.use_denoising = True
cam = bpy.data.objects["Preview_34"]; cam.data.lens = 92
sc.camera = cam; sc.render.resolution_x = sc.render.resolution_y = 480
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = os.path.join(site, f"thumb-{name}.png")
bpy.ops.render.render(write_still=True)
