import bpy, numpy as np
def load(p):
    im=bpy.data.images.load(p); w,h=im.size; return np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)
def save(a,p):
    h,w=a.shape[:2]; o=bpy.data.images.new("o",w,h); o.pixels=a.ravel(); o.filepath_raw=p; o.file_format='PNG'; o.save()
sep=lambda h: np.ones((h,16,4),np.float32)
for v,ref in [("coffee_wake","refs/hero_coffee.png"),("banana_rings","refs/hero_banana.png")]:
    a=load(ref); b=load(f"renders/baits_{v}_hero_v01.png"); save(np.concatenate([a,sep(a.shape[0]),b],1), f"renders/compare_{v}_ref_vs_render_v01.png")
# lineup: crop the central 1024 px of each hero render
ims=[load(p)[:, 512:1536] for p in ["renders/baits_flow_crunch_hero_v01.png","renders/baits_coffee_wake_hero_v01.png","renders/baits_banana_rings_hero_v01.png"]]
save(np.concatenate(ims,1),"renders/baits_3_sabores_v01.png")
