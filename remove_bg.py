from PIL import Image

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    # A bit of tolerance for white, removing any pure white background
    for item in datas:
        if item[0] > 245 and item[1] > 245 and item[2] > 245:
            # Replace white with transparent
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

remove_white_bg(r"C:\Users\youin\.gemini\antigravity-ide\brain\e0262d42-bbfe-43ea-920c-30393dcd5db0\.user_uploaded\media_1787473275979.png", r"c:\Users\youin\OneDrive\바탕 화면\헌옷수거어플\frontend\public\hero-graphic.png")
