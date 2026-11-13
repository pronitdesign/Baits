import bpy, sys, os
sys.path.insert(0, "scripts"); import baits_lib as L
from bpy_extras.object_utils import world_to_camera_view as w2c
from mathutils import Vector
sc=bpy.context.scene; cam=sc.camera
def px(p):
    v=w2c(sc,cam,Vector(p)); return round(v.x*2048,1), round((1-v.y)*1152,1)
fy=-L.D/2
pts={"front TL":(-L.W/2,fy,L.H),"front TR":(L.W/2,fy,L.H),"front BL":(-L.W/2,fy,0),"front BR":(L.W/2,fy,0),
     "lid back L":(-L.W/2,L.D/2,L.H+L.RT),"lid back R":(L.W/2,L.D/2,L.H+L.RT)}
ref={"front TL":(683,152),"front TR":(1370,152),"front BL":(683,1060),"front BR":(1370,1060),"lid back L":(699,118),"lid back R":(1352,118)}
for k,p in pts.items(): print(f"{k:12s} model {px(p)}  ref {ref[k]}")
