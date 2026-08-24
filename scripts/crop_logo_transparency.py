from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/smacc-reps-preview/frontend/public/logo-masar-green.png')
target = source
image = Image.open(source).convert('RGBA')
alpha = image.getchannel('A')
bounds = alpha.getbbox()
if not bounds:
    raise SystemExit('No visible logo pixels found')
left, top, right, bottom = bounds
padding_x = max(12, int((right - left) * 0.012))
padding_y = max(8, int((bottom - top) * 0.035))
left = max(0, left - padding_x)
top = max(0, top - padding_y)
right = min(image.width, right + padding_x)
bottom = min(image.height, bottom + padding_y)
image.crop((left, top, right, bottom)).save(target, 'PNG', optimize=True)
print(f'cropped={target} size={right-left}x{bottom-top}')
