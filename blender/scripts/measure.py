import bpy, numpy as np, sys
def load(p):
    im=bpy.data.images.load(p); w,h=im.size
    a=np.array(im.pixels[:]).reshape(h,w,4)[::-1,:,:3]  # top-down
    return a
def pinkmask(a):
    r,g,b=a[...,0],a[...,1],a[...,2]
    return (r-g>0.12)&(r>0.5)
for name in ["refs/hero_front.png","refs/turnaround.png"]:
    a=load(name); m=pinkmask(a); h,w=m.shape
    print(name,w,h)
    cols=m.sum(0); rows=m.sum(1)
    # print runs of columns with many pink pixels
    def runs(v,th):
        out=[];s=None
        for i,x in enumerate(v>th):
            if x and s is None:s=i
            if not x and s is not None: out.append((s,i-1)); s=None
        if s is not None: out.append((s,len(v)-1))
        return out
    print(" col runs",runs(cols,40))
    print(" row runs",runs(rows,40))
    if "hero" in name:
        # per-row extent of pink near top and bottom
        for y in list(range(100,175,4))+list(range(1020,1075,4)):
            xs=np.where(m[y])[0]
            print("  y",y, (xs.min(),xs.max(),len(xs)) if len(xs) else None)
        for x in [700,1000,1300]:
            ys=np.where(m[:,x])[0]; print("  x",x,ys.min(),ys.max())
