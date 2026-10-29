"""Generate SRL Logistics profile logo and Facebook cover (Armstrong branding)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.dirname(os.path.abspath(__file__))
FONTS = r"C:\Windows\Fonts"
NAVY = (11, 31, 58)
NAVY2 = (17, 52, 96)
WHITE = (255, 255, 255)
ORANGE = (242, 120, 30)
GREY = (190, 200, 214)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h), c1)
    px = img.load()
    for x in range(w):
        t = x / max(1, w - 1)
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for y in range(h):
            px[x, y] = col
    return img


def road_stripes(draw, w, h, y0, color, alpha_img=None):
    """Diagonal 'motion' stripes in the lower-right, subtle."""
    for i in range(0, 14):
        x = w - 60 - i * 70
        draw.polygon([(x, h), (x + 34, h), (x + 34 + 220, y0), (x + 220, y0)], fill=color)


def text_w(draw, text, f):
    l, t, r, b = draw.textbbox((0, 0), text, font=f)
    return r - l, b - t


# ---------------- Profile logo 1024x1024 ----------------
S = 1024
logo = Image.new("RGB", (S, S), NAVY)
d = ImageDraw.Draw(logo)
# outer ring
d.ellipse([28, 28, S - 28, S - 28], outline=WHITE, width=10)
d.ellipse([60, 60, S - 60, S - 60], outline=ORANGE, width=6)
# big SRL
f_big = font("arialbd.ttf", 330)
tw, th = text_w(d, "SRL", f_big)
d.text(((S - tw) / 2, 250), "SRL", font=f_big, fill=WHITE)
# orange road bar with dashes
bar_y = 640
d.rounded_rectangle([230, bar_y, S - 230, bar_y + 26], radius=13, fill=ORANGE)
for x in range(270, S - 270, 64):
    d.rectangle([x, bar_y + 9, x + 28, bar_y + 17], fill=NAVY)
# LOGISTICS
f_sub = font("arialbd.ttf", 92)
tw, th = text_w(d, "LOGISTICS", f_sub)
d.text(((S - tw) / 2, 690), "LOGISTICS", font=f_sub, fill=WHITE)
# small tagline
f_tag = font("arial.ttf", 44)
tag = "ARMSTRONG TRANSPORT GROUP AGENT"
tw, th = text_w(d, tag, f_tag)
d.text(((S - tw) / 2, 810), tag, font=f_tag, fill=GREY)
logo.save(os.path.join(OUT, "srl_profile_logo.png"))

# ---------------- Cover 1640x624 ----------------
W, H = 1640, 624
cover = gradient(W, H, NAVY, NAVY2)
d = ImageDraw.Draw(cover)
road_stripes(d, W, H, 150, (22, 62, 112))
# orange accent bar left
d.rectangle([0, 0, 14, H], fill=ORANGE)
# Title block (kept inside the mobile-safe centre)
f_title = font("arialbd.ttf", 118)
f_sub = font("arial.ttf", 50)
f_chip = font("arialbd.ttf", 34)
f_foot = font("arial.ttf", 34)
x0 = 120
d.text((x0, 118), "SRL Logistics", font=f_title, fill=WHITE)
d.text((x0 + 4, 262), "An Armstrong Transport Group Agency", font=f_sub, fill=GREY)
# chips
chips = ["FULL TRUCKLOAD", "LTL", "DEDICATED CAPACITY"]
cx, cy = x0 + 4, 360
for c in chips:
    tw, th = text_w(d, c, f_chip)
    d.rounded_rectangle([cx, cy, cx + tw + 48, cy + 62], radius=31, outline=ORANGE, width=4)
    d.text((cx + 24, cy + 12), c, font=f_chip, fill=WHITE)
    cx += tw + 48 + 22
# footer line
d.text((x0 + 4, 480), "Midwest to nationwide  |  Backed by Armstrong's carrier network and credit", font=f_foot, fill=GREY)
d.text((x0 + 4, 530), "armstrongtransport.com  |  614-855-9504", font=f_foot, fill=ORANGE)
cover.save(os.path.join(OUT, "srl_cover.png"))
print("ok", os.path.join(OUT, "srl_profile_logo.png"), os.path.join(OUT, "srl_cover.png"))
