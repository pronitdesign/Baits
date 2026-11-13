import bpy, numpy as np, sys
args=sys.argv[sys.argv.index("--")+1:]
src,out,x0,y0,x1,y1,sc=args[0],args[1],*map(int,args[2:6]),float(args[6])
im=bpy.data.images.load(src); w,h=im.size
a=np.array(im.pixels[:]).reshape(h,w,4)
# convert top-down coords
c=a[h-y1:h-y0, x0:x1].copy()
o=bpy.data.images.new("o",x1-x0,y1-y0,alpha=True); o.pixels=c.ravel()
o.filepath_raw=out; o.file_format='PNG'
if sc!=1: o.scale(int((x1-x0)*sc),int((y1-y0)*sc))
o.save()
