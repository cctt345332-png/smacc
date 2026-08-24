from colorsys import rgb_to_hls, hls_to_rgb
from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/smacc-reps-preview/frontend/public/logo-ha.png')
target = Path('/home/ubuntu/smacc-reps-preview/frontend/public/logo-masar-green.png')
image = Image.open(source).convert('RGBA')
pixels = image.load()

for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = pixels[x, y]
        if a < 8:
            continue
        h, l, s = rgb_to_hls(r / 255, g / 255, b / 255)
        if s > 0.14 and l < 0.92:
            target_hue = 0.435
            target_saturation = min(0.80, max(0.34, s * 0.88))
            target_lightness = max(0.18, min(0.62, l * 0.92))
            nr, ng, nb = hls_to_rgb(target_hue, target_lightness, target_saturation)
            pixels[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

alpha = image.getchannel('A')
bounds = alpha.getbbox()
if not bounds:
    raise SystemExit('Logo visibility bounds unavailable')
left, top, right, bottom = bounds
pad_x = max(8, int((right - left) * 0.008))
pad_y = max(6, int((bottom - top) * 0.025))
left, top = max(0, left - pad_x), max(0, top - pad_y)
right, bottom = min(image.width, right + pad_x), min(image.height, bottom + pad_y)
image.crop((left, top, right, bottom)).save(target, 'PNG', optimize=True)
print(f'saved={target} size={right-left}x{bottom-top}')
