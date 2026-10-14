"""Locate photograph outlines, excluding the small text components on catalog pages."""
from PIL import Image, ImageFilter
from collections import deque

def regions(path):
    original=Image.open(path).convert('RGB');im=original.copy();im.thumbnail((414,562))
    w,h=im.size;scale=original.width/w
    gray=im.convert('L').filter(ImageFilter.GaussianBlur(.3))
    mask=gray.point(lambda p:255 if p<229 else 0).filter(ImageFilter.MaxFilter(3))
    pixels=bytearray(mask.tobytes());boxes=[]
    for index,value in enumerate(pixels):
        if not value:continue
        pixels[index]=0;q=deque([index]);xmin=xmax=index%w;ymin=ymax=index//w;count=0
        while q:
            pos=q.popleft();x=pos%w;y=pos//w;count+=1
            xmin=min(xmin,x);xmax=max(xmax,x);ymin=min(ymin,y);ymax=max(ymax,y)
            for nxt in [pos-1 if x else -1,pos+1 if x<w-1 else -1,pos-w if y else -1,pos+w if y<h-1 else -1]:
                if nxt>=0 and pixels[nxt]:pixels[nxt]=0;q.append(nxt)
        bw=xmax-xmin+1;bh=ymax-ymin+1
        if bw>30 and bh>25 and count>150 and bw*bh<w*h*.45 and ymin>h*.17:
            boxes.append(tuple(round(v*scale) for v in [xmin,ymin,xmax+1,ymax+1]))
    return boxes

if __name__=='__main__':
    from PIL import ImageDraw
    from pathlib import Path
    for p in [62,136,10,122]:
        path=Path(f'.cache/catalog-pages/page-{p:03}.jpg');im=Image.open(path);draw=ImageDraw.Draw(im)
        boxes=regions(path)
        for b in boxes:draw.rectangle(b,outline='red',width=5)
        im.thumbnail((660,900));im.save(f'.cache/regions-{p}.png');print(p,boxes)
