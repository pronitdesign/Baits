import bpy, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
img = bpy.data.images.load(os.path.join(root, "textures", "baits_walls_atlas_v02.png"))
img.colorspace_settings.name = 'sRGB'
m = bpy.data.materials["Board_Print_Atlas"]
next(n for n in m.node_tree.nodes if n.type == "TEX_IMAGE").image = img
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root, "blend", "baits_box_final_v02.blend"))
