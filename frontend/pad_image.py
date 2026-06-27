from PIL import Image

# Open the new logo
img_path = 'public/new-logo.png'
target_path = 'public/allclear-logo.png'

img = Image.open(img_path).convert("RGBA")
width, height = img.size

target_width = width
target_height = int(width / 0.45) # 784 / 0.45 = 1742

new_img = Image.new('RGBA', (target_width, target_height), (247, 248, 252, 255))

# Paste original image at the top
new_img.paste(img, (0, 0))

# Create a gradient mask to fade the bottom of the original image into the background color
fade_height = 200
for y in range(height - fade_height, height):
    alpha = int(255 * (height - y) / fade_height)
    for x in range(width):
        r, g, b, a = new_img.getpixel((x, y))
        # Blend pixel with background color
        br, bg, bb = 247, 248, 252
        nr = int((r * alpha + br * (255 - alpha)) / 255)
        ng = int((g * alpha + bg * (255 - alpha)) / 255)
        nb = int((b * alpha + bb * (255 - alpha)) / 255)
        new_img.putpixel((x, y), (nr, ng, nb, 255))

# Save the padded image
new_img.save(target_path, format='PNG', quality=100)
print(f"Successfully padded and saved to {target_path} with size {new_img.size}")
