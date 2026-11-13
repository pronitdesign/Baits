import bpy, numpy as np
im=bpy.data.images.load("refs/hero_front.png"); a=np.array(im.pixels[:]).reshape(1152,2048,4)[::-1,:,:3]
def s(x,y,r=12): return (a[y-r:y+r,x-r:x+r].reshape(-1,3).mean(0)*255).round(0)
for name,(x,y) in {"TL":(100,100),"TR":(1950,100),"mid L":(300,600),"mid R":(1750,600),"floor L":(300,1100),"floor R":(1750,1100),
 "near box L":(640,1040),"near box R":(1420,1040),"shadow R1":(1500,980),"shadow R2":(1600,1000),"under":(1000,1080),"bottom c":(1000,1140),
 "front mid":(1310,650),"front top":(1310,200),"front bottom":(1310,1000),"front left":(700,650)}.items():
    print(f"{name:12s}",s(x,y))
# row profile at x=1700 to locate horizon/shadow
print([int(a[y,1700].mean()*255) for y in range(800,1152,16)])
print([int(a[1000,x].mean()*255) for x in range(1370,2048,40)])
