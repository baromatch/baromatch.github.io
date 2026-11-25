"""sous_bocks.py - two Baromatch coasters (invented clubs Alvène and Orvèle) on a bar counter at night:
one lies flat, the other lands. No glass, no drink, no real club. The still of direction A (img/sous-bocks-*.webp).
Needs lib3d.py (the helpers of the cinematic-3d-ad skill) and the two insignia as PNG next to it; Blender 5.2 as bpy.
python sous_bocks.py -- still OUT.png WIDTH HEIGHT QUALITY   (here: 1080 1350 final, about 4 min 30 on 4 cores)"""
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib3d import *
import bmesh

R = 0.0535       # a 107 mm beer mat... a coaster: radius in metres
T = 0.0022       # cardboard thickness


def coaster(name, image_path, loc, rot):
    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=T, vertices=160)
    ob = bpy.context.object
    ob.name = name
    printed = mat_image(name + 'Face', image_path, rough=0.62, gain=0.95)
    add_bump(printed, scale=900.0, strength=0.025, distance=0.0002, roughness_var=0.08)
    edge = add_bump(mat_pbr(name + 'Edge', base='#D9CBB0', rough=0.9), scale=1400.0, strength=0.18, distance=0.0002)
    ob.data.materials.append(printed)
    ob.data.materials.append(edge)
    me = ob.data
    uv = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        poly.material_index = 0 if poly.normal.z > 0.9 else 1
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            # the disc maps to the inner 95 % of the drawing (its rough rim and shadow stay outside)
            uv.data[li].uv = (0.5 + co.x / R * 0.472, 0.5 + co.y / R * 0.472)
    bevel(ob, width=0.0005, segments=2, angle=40)
    shade_smooth(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def build(w=600, h=750, quality='preview'):
    reset_scene(res=(w, h), fps=24, frames=(1, 1))
    setup_cycles(quality, look='AgX - Punchy', exposure=-0.1, motion_blur=False)
    world_setup('#07080C', hdri=bundled_hdri('night'), hdri_strength=0.12, rotation_deg=120)
    # the counter, and a wall far behind (something must exist behind the subject)
    counter = add_rounded_slab('Counter', 3.0, 3.0, 0.05, 0.01, edge=0.003, mats=[mat_wood('Wood', dark='#0C0705', light='#24160D', rough=0.42, coat=0.25)])
    counter.location = (0, 1.2, -0.05)
    wall = add_rounded_slab('Wall', 8, 4, 0.05, 0.01, edge=0,
                            mats=[add_bump(mat_pbr('WallM', base='#120E0C', rough=0.9), scale=5, strength=0.3, distance=0.02)])
    wall.rotation_euler, wall.location = (math.radians(90), 0, 0), (0, 3.4, -0.3)
    # the two coasters: Orvèle lies on the counter, Alvène lands on it
    orv = coaster('Orvele', os.path.join(HERE, 'orvele.png'), (0.045, 0.055, T / 2), (0, 0, math.radians(-18)))
    alv = coaster('Alvene', os.path.join(HERE, 'alvene.png'), (-0.030, -0.014, 0.022), (math.radians(-9), math.radians(12), math.radians(9)))
    # practicals far behind: warm bulbs, and a large cool screen glow (a television, nothing on it)
    bulb = mat_emit('Bulb', '#FFB36B', 22.0)
    rnd = random.Random(11)
    for i in range(16):
        b = add_disc(f'Bulb{i}', 0.02, 0.04, mats=[bulb], verts=24, edge=0)
        b.location = (-1.5 + i * 0.2 + rnd.uniform(-.05, .05), 2.4 + rnd.uniform(-.3, .6), 0.55 + 0.22 * math.sin(i * 1.3))
    for i in range(14):
        c = add_disc(f'Lamp{i}', 0.016, 0.03, mats=[bulb], verts=24, edge=0)
        c.location = (-0.42 + i * 0.07 + rnd.uniform(-.02, .02), 0.55 + rnd.uniform(0, .5), 0.05 + rnd.uniform(0, .16))
    tv = add_rounded_slab('TV', 0.9, 0.5, 0.02, 0.01, edge=0, mats=[mat_emit('TVglow', '#6FA0FF', 1.6)])
    tv.rotation_euler, tv.location = (math.radians(90), 0, math.radians(-8)), (0.75, 2.9, 0.75)
    # light: a warm key from above (the bar's lamp), the two club colours as rims, a dim fill
    area_light('Key', (-0.25, -0.05, 0.55), target=(0, 0.02, 0), power=0.9, color='#FFD9B0', size=0.35, spread_deg=40)
    k2 = area_light('RimL', (-0.42, 0.30, 0.10), target=(-0.03, 0.0, 0.03), power=1.4, color='#14B8A6', size=0.25, spread_deg=30)
    k3 = area_light('RimR', (0.45, 0.36, 0.10), target=(0.05, 0.05, 0.01), power=1.4, color='#5C63FF', size=0.25, spread_deg=30)
    light_only(k2, [alv, orv])
    light_only(k3, [alv, orv])
    area_light('Fill', (0.1, -0.6, 0.25), target=(0, 0.02, 0.02), power=0.25, color='#FFE8CC', size=0.8)
    focus = add_empty('Focus', (0.0, 0.02, 0.012))
    add_camera('Cam', loc=(-0.005, -0.40, 0.29), target=(0.006, 0.030, 0.006), lens=66, fstop=3.5, focus=focus)
    bpy.context.scene.view_settings.view_transform = 'Standard'
    bpy.context.scene.view_settings.look = 'None'
    bpy.context.scene.view_settings.exposure = -0.35
    setup_compositor(bloom=0.3, threshold=1.2, size=0.5, dispersion=0.0)


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:]
    build(int(a[2]), int(a[3]), a[4])
    render_still(a[1], 1)
