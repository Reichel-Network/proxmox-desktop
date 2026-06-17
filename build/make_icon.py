from PIL import Image
import os

src = os.path.expanduser("~/proxmox-desktop/build/icon-src.png")
img = Image.open(src).convert("RGBA")

# electron-builder wants a 256x256+ PNG named icon.png and/or icon.ico
out_ico = os.path.expanduser("~/proxmox-desktop/build/icon.ico")
out_png = os.path.expanduser("~/proxmox-desktop/build/icon.png")

# Save a clean 512 png (electron-builder accepts png and generates the rest)
img.resize((512, 512), Image.LANCZOS).save(out_png)

# Multi-resolution ICO for Windows
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]
img.save(out_ico, format="ICO", sizes=sizes)

print("icon.png:", os.path.getsize(out_png), "bytes")
print("icon.ico:", os.path.getsize(out_ico), "bytes")
