import sys
from PIL import Image

def clean_background(image_path, output_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        data = img.getdata()

        new_data = []
        for item in data:
            r, g, b, a = item
            # The background is a very light blue gradient, while the logo is a dark solid blue.
            # If we check the brightness or simply if it's not dark blue, we can make it white.
            # A simple threshold: if R > 100, G > 100, it's definitely not the dark blue logo.
            # (The logo is mostly dark blue, where R and G are quite low).
            if r > 100 and g > 100:
                # To soften the edges (anti-aliasing preservation), we could do a gradient,
                # but since the background is very light, just turning everything that isn't
                # dark blue into white or transparent is a start. Let's make it pure white for now.
                # Actually, setting it to transparent is better for web!
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Successfully cleaned {image_path} -> {output_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

if __name__ == "__main__":
    for path in sys.argv[1:]:
        clean_background(path, path.replace(".png", "_clean.png").replace(".jpg", "_clean.png"))
