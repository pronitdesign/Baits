import bpy, numpy as np
im=bpy.data.images.load("refs/turnaround.png"); w,h=im.size
a=np.array(im.pixels[:]).reshape(h,w,4)[::-1,:,:3]
m=(a[...,0]-a[...,1]>0.12)&(a[...,0]>0.5)
def ext(y0,y1,x0,x1):
    s=m[y0:y1,x0:x1]; ys,xs=np.where(s)
    cols=s.sum(0); rows=s.sum(1)
    cx=np.where(cols>20)[0]; ry=np.where(rows>20)[0]
    return (x0+cx.min(),x0+cx.max(),y0+ry.min(),y0+ry.max())
print("front TL",ext(0,590,0,650))
print("side  TR",ext(0,590,650,1312))
print("back  BL",ext(590,1199,0,650))
print("3/4   BR",ext(590,1199,650,1312))
# side view per row extents
for y in [30,40,50,100,300,530,540]:
    xs=np.where(m[y,650:])[0]+650; print(" side y",y,xs.min(),xs.max())
for y in [32,60,300,540]:
    xs=np.where(m[y,:650])[0]; print(" front y",y,xs.min(),xs.max())
