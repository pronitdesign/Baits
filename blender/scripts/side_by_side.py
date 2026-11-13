import bpy, numpy as np
def load(p):
    im=bpy.data.images.load(p); w,h=im.size; return np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)
a=load("refs/hero_front.png"); b=load("renders/baits_hero_v01.png")
sep=np.ones((a.shape[0],16,4),np.float32)
c=np.concatenate([a,sep,b],1); h,w=c.shape[:2]
o=bpy.data.images.new("sbs",w,h); o.pixels=c.ravel(); o.filepath_raw="renders/compare_ref_vs_render_v01.png"; o.file_format='PNG'; o.save()
