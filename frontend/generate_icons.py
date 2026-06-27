from PIL import Image

img = Image.open('public/app-icon.png').convert("RGBA")
width, height = img.size
max_dim = max(width, height)

# Create a square white background
square_img = Image.new('RGBA', (max_dim, max_dim), (255, 255, 255, 255))
offset = ((max_dim - width) // 2, (max_dim - height) // 2)

# Paste the original image in the center
square_img.paste(img, offset, mask=img)

# Save as 512x512
icon512 = square_img.resize((512, 512), Image.Resampling.LANCZOS)
icon512.save('public/icons/icon-512.png', format='PNG')

# Save as 192x192
icon192 = square_img.resize((192, 192), Image.Resampling.LANCZOS)
icon192.save('public/icons/icon-192.png', format='PNG')

print("Icons generated successfully.")
