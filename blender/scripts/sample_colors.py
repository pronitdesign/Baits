import bpy, numpy as np
def L(p):
    im=bpy.data.images.load(p); w,h=im.size; return np.array(im.pixels[:]).reshape(h,w,4)[::-1,:,:3]
def s(a,x,y,r=6): return (a[y-r:y+r,x-r:x+r].reshape(-1,3).mean(0)*255).round(0).tolist()
c=L("refs/hero_coffee.png"); b=L("refs/hero_banana.png"); at=L("textures/baits_walls_atlas_v02.png")
print("coffee box",s(c,1310,640),"brain",s(c,880,560),s(c,1050,640),"cream logo",s(c,790,300),"coffee txt",s(c,745,905,3))
print("banana box",s(b,1310,640),"brain",s(b,880,560),s(b,1060,560),"maroon logo",s(b,790,300))
# atlas side panel (x 1516..2072): bg + brain
print("atlas side bg",s(at,1560,1500),s(at,2040,300),"side brain",s(at,1790,700),s(at,1760,760))
