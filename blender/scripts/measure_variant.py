import bpy, numpy as np, sys
for p in sys.argv[sys.argv.index("--")+1:]:
    im=bpy.data.images.load(p); w,h=im.size
    a=np.array(im.pixels[:]).reshape(h,w,4)[::-1,:,:3]
    sat=a.max(-1)-a.min(-1); m=sat>0.18
    print(p, w, h)
    cols=np.where(m.sum(0)>300)[0]; rows=np.where(m.sum(1)>200)[0]
    print(" cols",cols.min(),cols.max()," rows",rows.min(),rows.max())
    for y in list(range(rows.min(), rows.min()+60, 3))+list(range(rows.max()-30, rows.max()+1, 3)):
        xs=np.where(m[y])[0]; print("  y",y,(xs.min(),xs.max(),len(xs)) if len(xs) else None)
    for x in [720,1000,1300]:
        ys=np.where(m[:,x])[0]; print("  x",x,ys.min(),ys.max())
    # plain box colour sample right of the bowl
    print(" box sRGB", (a[600:700,1300:1330].reshape(-1,3).mean(0)*255).round(1))
