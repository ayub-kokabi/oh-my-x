from PIL import Image
import os

# مسیر پوشه خروجی
output_folder = "icons"
os.makedirs(output_folder, exist_ok=True)

# تصویر اصلی
original_path = "icon.png"
img = Image.open(original_path).convert("RGBA")

# برش فضای خالی اطراف تصویر
bbox = img.getbbox()
if bbox:
    img_cropped = img.crop(bbox)
else:
    img_cropped = img  # اگر چیزی برای برش نبود

# سایزهایی که می‌خواهید تولید کنید
sizes = [16, 24, 32, 48, 64, 128, 256]

# ایجاد و ذخیره تصاویر با سایزهای مختلف
for size in sizes:
    img_resized = img_cropped.resize((size, size), Image.LANCZOS)
    save_path = os.path.join(output_folder, f"icon{size}.png")
    img_resized.save(save_path)
    print(f"Saved {save_path}")
