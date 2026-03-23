#!/usr/bin/env python3
"""
Script to rebuild walls array with proper door gaps and 3-tile-tall corridors.
"""

# All doors from House layout.txt
DOORS = [
    { 'x': -261.5, 'y': -217, 'w': 1.5, 'h': 0.3, 'name': 'Ensuite → Master Bedroom' },
    { 'x': -256.3, 'y': -210.6, 'w': 0.3, 'h': 1.2, 'name': 'Master Bedroom → Corridor (left)' },
    { 'x': -253.8, 'y': -211.3, 'w': 1.6, 'h': 0.3, 'name': 'Reading room → Corridor (left)' },
    { 'x': -246.2, 'y': -211.3, 'w': 1.6, 'h': 0.3, 'name': 'Kitchen → Corridor (left)' },
    { 'x': -249.5, 'y': -209.3, 'w': 1.6, 'h': 0.3, 'name': "Baby's room → Corridor (left)" },
    { 'x': -241.3, 'y': -210.6, 'w': 0.3, 'h': 1.2, 'name': 'Corridor (left) → Living room' },
    { 'x': -241.3, 'y': -219.0, 'w': 0.3, 'h': 1.2, 'name': 'Kitchen → Living room' },
    { 'x': -221.0, 'y': -211.6, 'w': 0.3, 'h': 1.2, 'name': 'Living room → Corridor (right)' },
    { 'x': -218.0, 'y': -212.3, 'w': 1.6, 'h': 0.3, 'name': "Corridor (right) → Housemate's room" },
    { 'x': -220.0, 'y': -210.3, 'w': 1.4, 'h': 0.3, 'name': 'Corridor (right) → Home office' },
    { 'x': -214.0, 'y': -210.3, 'w': 1.4, 'h': 0.3, 'name': 'Corridor (right) → Spare room' },
    { 'x': -221.0, 'y': -223.5, 'w': 0.3, 'h': 1.6, 'name': 'Living room → Patio' },
    { 'x': -210.3, 'y': -216.5, 'w': 0.3, 'h': 1.2, 'name': "Housemate's room → Patio strip" },
    { 'x': -233.0, 'y': -199.3, 'w': 1.6, 'h': 0.3, 'name': 'Living room → Dog patio' },
    { 'x': -262.0, 'y': -199.3, 'w': 1.6, 'h': 0.3, 'name': 'Master Bedroom → Dog patio' },
    { 'x': -196.0, 'y': -224.3, 'w': 1.2, 'h': 0.3, 'name': 'Chicken yard → Shed' },
    { 'x': -195.5, 'y': -222.0, 'w': 1.2, 'h': 0.3, 'name': 'Chicken yard → Chicken run' },
    { 'x': -194.5, 'y': -204.3, 'w': 1.0, 'h': 0.3, 'name': 'Chicken run → Coop' },
]

def overlaps(wall, door):
    """Check if a wall overlaps with a door position."""
    wx1, wy1, wx2, wy2 = wall['x'], wall['y'], wall['x'] + wall['w'], wall['y'] + wall['h']
    dx1, dy1, dx2, dy2 = door['x'], door['y'], door['x'] + door['w'], door['y'] + door['h']

    # Check for overlap
    return not (wx2 <= dx1 or wx1 >= dx2 or wy2 <= dy1 or wy1 >= dy2)

# Original walls from House layout.txt
original_walls = [
    # Yards
    { 'x': -269, 'y': -233, 'w': 48, 'h': 0.3 },
    { 'x': -269, 'y': -190.3, 'w': 48, 'h': 0.3 },
    { 'x': -269, 'y': -233, 'w': 0.3, 'h': 43 },
    { 'x': -221.3, 'y': -233, 'w': 0.3, 'h': 43 },
    { 'x': -221, 'y': -233, 'w': 34, 'h': 0.3 },
    { 'x': -221, 'y': -190.3, 'w': 34, 'h': 0.3 },
    { 'x': -187.3, 'y': -233, 'w': 0.3, 'h': 43 },

    # Shed
    { 'x': -202, 'y': -232, 'w': 14, 'h': 0.3 },
    { 'x': -202, 'y': -224.3, 'w': 14, 'h': 0.3 },
    { 'x': -202, 'y': -232, 'w': 0.3, 'h': 8 },
    { 'x': -188.3, 'y': -232, 'w': 0.3, 'h': 8 },

    # Chicken run
    { 'x': -198, 'y': -222, 'w': 9, 'h': 0.3 },
    { 'x': -198, 'y': -197.3, 'w': 9, 'h': 0.3 },
    { 'x': -198, 'y': -222, 'w': 0.3, 'h': 25 },
    { 'x': -189.3, 'y': -222, 'w': 0.3, 'h': 25 },

    # Chicken coop
    { 'x': -195, 'y': -209, 'w': 4, 'h': 0.3 },
    { 'x': -195, 'y': -204.3, 'w': 4, 'h': 0.3 },
    { 'x': -195, 'y': -209, 'w': 0.3, 'h': 5 },
    { 'x': -191.3, 'y': -209, 'w': 0.3, 'h': 5 },

    # Living room
    { 'x': -241, 'y': -226, 'w': 20, 'h': 0.3 },
    { 'x': -241, 'y': -199.3, 'w': 20, 'h': 0.3 },
    { 'x': -241, 'y': -226, 'w': 0.3, 'h': 27 },
    { 'x': -221.3, 'y': -226, 'w': 0.3, 'h': 27 },

    # Patio main
    { 'x': -221, 'y': -219.3, 'w': 15, 'h': 0.3 },

    # Patio strip
    { 'x': -210, 'y': -219, 'w': 4, 'h': 0.3 },
    { 'x': -210, 'y': -219, 'w': 0.3, 'h': 20 },

    # Housemate room
    { 'x': -221, 'y': -219, 'w': 11, 'h': 0.3 },
    { 'x': -221, 'y': -212.3, 'w': 11, 'h': 0.3 },
    { 'x': -221, 'y': -219, 'w': 0.3, 'h': 7 },
    { 'x': -210.3, 'y': -219, 'w': 0.3, 'h': 7 },

    # Corridor right (CHANGED: height 3 instead of 2)
    { 'x': -221, 'y': -212, 'w': 11, 'h': 0.3 },
    { 'x': -221, 'y': -209.3, 'w': 11, 'h': 0.3 },
    { 'x': -221, 'y': -212, 'w': 0.3, 'h': 3 },
    { 'x': -210.3, 'y': -212, 'w': 0.3, 'h': 3 },

    # Corridor left (CHANGED: height 3 instead of 2)
    { 'x': -256, 'y': -211, 'w': 15, 'h': 0.3 },
    { 'x': -256, 'y': -208.3, 'w': 15, 'h': 0.3 },
    { 'x': -256, 'y': -211, 'w': 0.3, 'h': 3 },
    { 'x': -241.3, 'y': -211, 'w': 0.3, 'h': 3 },

    # Kitchen
    { 'x': -249, 'y': -226, 'w': 8, 'h': 0.3 },
    { 'x': -249, 'y': -211.3, 'w': 8, 'h': 0.3 },
    { 'x': -249, 'y': -226, 'w': 0.3, 'h': 15 },
    { 'x': -241.3, 'y': -226, 'w': 0.3, 'h': 15 },

    # Reading/dog room
    { 'x': -256, 'y': -226, 'w': 7, 'h': 0.3 },
    { 'x': -256, 'y': -211.3, 'w': 7, 'h': 0.3 },
    { 'x': -256, 'y': -226, 'w': 0.3, 'h': 15 },
    { 'x': -249.3, 'y': -226, 'w': 0.3, 'h': 15 },

    # Baby's room
    { 'x': -256, 'y': -209, 'w': 15, 'h': 0.3 },
    { 'x': -256, 'y': -199.3, 'w': 15, 'h': 0.3 },
    { 'x': -256, 'y': -209, 'w': 0.3, 'h': 10 },
    { 'x': -241.3, 'y': -209, 'w': 0.3, 'h': 10 },

    # Home office
    { 'x': -221, 'y': -210, 'w': 5, 'h': 0.3 },
    { 'x': -221, 'y': -199.3, 'w': 5, 'h': 0.3 },
    { 'x': -221, 'y': -210, 'w': 0.3, 'h': 11 },
    { 'x': -216.3, 'y': -210, 'w': 0.3, 'h': 11 },

    # Spare room
    { 'x': -216, 'y': -210, 'w': 6, 'h': 0.3 },
    { 'x': -216, 'y': -199.3, 'w': 6, 'h': 0.3 },
    { 'x': -216, 'y': -210, 'w': 0.3, 'h': 11 },
    { 'x': -210.3, 'y': -210, 'w': 0.3, 'h': 11 },

    # Master bedroom
    { 'x': -264, 'y': -217, 'w': 8, 'h': 0.3 },
    { 'x': -264, 'y': -199.3, 'w': 8, 'h': 0.3 },
    { 'x': -264, 'y': -217, 'w': 0.3, 'h': 18 },
    { 'x': -256.3, 'y': -217, 'w': 0.3, 'h': 18 },

    # Ensuite
    { 'x': -264, 'y': -226, 'w': 8, 'h': 0.3 },
    { 'x': -264, 'y': -217.3, 'w': 8, 'h': 0.3 },
    { 'x': -264, 'y': -226, 'w': 0.3, 'h': 9 },
    { 'x': -256.3, 'y': -226, 'w': 0.3, 'h': 9 },

    # Dog patio
    { 'x': -264, 'y': -199, 'w': 43, 'h': 0.3 },
    { 'x': -264, 'y': -194.3, 'w': 43, 'h': 0.3 },
    { 'x': -264, 'y': -199, 'w': 0.3, 'h': 5 },
    { 'x': -221.3, 'y': -199, 'w': 0.3, 'h': 5 },
]

# Filter out walls that overlap with doors
filtered_walls = []
for wall in original_walls:
    has_overlap = False
    for door in DOORS:
        if overlaps(wall, door):
            has_overlap = True
            # Skip printing door name (has unicode arrows)
            break

    if not has_overlap:
        filtered_walls.append(wall)

# Output as JavaScript
print("\nconst RAW_WALLS = [")
for wall in filtered_walls:
    print(f"    {{ x: {wall['x']}, y: {wall['y']}, w: {wall['w']}, h: {wall['h']} }},")
print("];")

print(f"\nFiltered {len(original_walls)} walls down to {len(filtered_walls)} walls")
