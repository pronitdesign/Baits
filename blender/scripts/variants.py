"""Flavour variants. Pixel coords are in each 2048x1152 hero reference (top-down)."""
VARIANTS = {
    "flow_crunch": dict(
        ref="refs/hero_front.png", atlas="textures/baits_walls_atlas_v02.png",
        box_rgb=(192, 127, 159), front=(683, 152, 1370, 1060),
    ),
    "coffee_wake": dict(
        ref="refs/hero_coffee.png",
        front=(696, 162, 1348, 1015),                 # x0, y0, x1, y1 of the front panel
        marks={"front TL": (696, 162), "front TR": (1346, 162), "front BL": (699, 1015), "front BR": (1348, 1015),
               "lid back L": (708, 142), "lid back R": (1334, 142)},
        box_samples=[(1310, 640), (720, 470), (1290, 460), (760, 700)],
        brain_rgb=(234, 147, 197),
        side_text_rgb=(244, 240, 225),                # cream, as on the front
        side_logo_rgb=(244, 240, 225),
        name=("COFFEE", "WAKE"),
    ),
    "banana_rings": dict(
        ref="refs/hero_banana.png",
        front=(698, 158, 1352, 1019),
        marks={"front TL": (698, 158), "front TR": (1351, 158), "front BL": (696, 1019), "front BR": (1352, 1019),
               "lid back L": (716, 145), "lid back R": (1344, 145)},
        box_samples=[(1310, 640), (720, 470), (1290, 460), (760, 700)],
        brain_rgb=(253, 117, 76),
        side_text_rgb=(109, 28, 28),                  # maroon, as on the front
        side_logo_rgb=(109, 28, 28),
        name=("BANANA", "RINGS"),
    ),
}
BADGES = ["350G", "12G", "80KCAL"]   # same pack values as Flow Crunch (placeholders: confirm per flavour)
