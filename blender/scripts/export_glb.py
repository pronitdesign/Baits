import bpy, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='DESELECT')
box = list(bpy.data.collections["BOX_geometry"].objects)
for o in box: o.select_set(True)
bpy.context.view_layer.objects.active = box[0]
out = os.path.join(root, "web", "baits_box.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_image_format='AUTO', export_materials='EXPORT')
dg = bpy.context.evaluated_depsgraph_get()
tris = sum(sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).to_mesh().polygons) for o in box)
print("GLB", out, os.path.getsize(out), "bytes, tris", tris)
