from PIL import Image
import os

target_width = 1536
target_height = 2754

# Open the new logo
img_path = 'public/new-logo.png'
target_path = 'public/allclear-logo.png'

if not os.path.exists(img_path):
    print("File not found.")
    exit(1)

img = Image.open(img_path)
width, height = img.size

# Calculate aspect ratios
target_ratio = target_width / target_height
img_ratio = width / height

if img_ratio > target_ratio:
    # Image is wider than target. Scale height to match, crop width.
    new_height = target_height
    new_width = int(new_height * img_ratio)
else:
    # Image is taller than target. Scale width to match, crop height.
    new_width = target_width
    new_height = int(new_width / img_ratio)

# Resize
img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

# Crop center
left = (new_width - target_width) / 2
top = (new_height - target_height) / 2
right = (new_width + target_width) / 2
bottom = (new_height + target_height) / 2

img_cropped = img_resized.crop((left, top, right, bottom))

# Save
img_cropped.save(target_path, format='PNG', quality=100)
print(f"Successfully resized and saved to {target_path} with size {img_cropped.size}")
