"""Build the studio's reusable, UV-mapped dinnerware meshes with Blender.

Run: blender --background --factory-startup --python scripts/build-dinnerware.py
"""

import json
import math
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models" / "dinnerware"
OUTPUT.mkdir(parents=True, exist_ok=True)
SEGMENTS = 128

# Cross sections travel from the inner well, over the lip, down the outside,
# through the foot ring, and back to the underside. Height is normalized to 1.
PROFILES = {
    "rimmed": [
        (0, .22), (.30, .22), (.55, .22), (.62, .25), (.69, .40),
        (.76, .66), (.85, .84), (.94, .94), (.985, 1), (1, .94),
        (.997, .80), (.975, .74), (.84, .58), (.70, .25),
        (.57, .12), (.55, .02), (.53, 0), (.46, 0), (.44, .08),
        (.30, .12), (0, .12),
    ],
    "coupe": [
        (0, .22), (.25, .22), (.45, .25), (.60, .33), (.73, .49),
        (.84, .69), (.94, .91), (.985, 1), (1, .97), (.999, .85),
        (.97, .78), (.88, .57), (.74, .33), (.60, .16),
        (.52, .10), (.50, .02), (.48, 0), (.40, 0), (.38, .09),
        (.24, .12), (0, .12),
    ],
    "bowl": [
        (0, .12), (.20, .12), (.34, .15), (.46, .22), (.59, .35),
        (.72, .54), (.84, .76), (.94, .95), (.978, 1), (.996, .995),
        (1, .97), (.98, .90), (.87, .68), (.74, .43), (.59, .20),
        (.47, .08), (.43, .025), (.41, 0), (.33, 0), (.31, .06),
        (.20, .075), (0, .075),
    ],
    "tray": [
        (0, .23), (.30, .23), (.64, .23), (.77, .24), (.83, .32),
        (.89, .59), (.94, .89), (.98, 1), (1, .97), (.997, .80),
        (.97, .73), (.92, .46), (.86, .17), (.77, .08),
        (.68, .02), (.65, 0), (.57, 0), (.55, .08), (.30, .12),
        (0, .12),
    ],
}


def outline(shape):
    points = []
    for index in range(SEGMENTS):
        angle = index * math.tau / SEGMENTS
        c, s = math.cos(angle), math.sin(angle)
        if shape == "square":
            x = math.copysign(abs(c) ** .4, c)
            y = math.copysign(abs(s) ** .4, s)
        elif shape == "triangular":
            # A rounded three-sided silhouette with no singular sharp corners.
            radius = 1 + .17 * math.cos(3 * (angle - math.pi / 2))
            x, y = radius * c, radius * s
        elif shape == "irregular":
            radius = 1 + .035 * math.cos(3 * angle) + .022 * math.sin(5 * angle)
            x, y = radius * c, radius * s
        else:
            x, y = c, s
        points.append((x, y))
    min_x, max_x = min(x for x, _ in points), max(x for x, _ in points)
    min_y, max_y = min(y for _, y in points), max(y for _, y in points)
    return [
        (2 * (x - min_x) / (max_x - min_x) - 1,
         2 * (y - min_y) / (max_y - min_y) - 1)
        for x, y in points
    ]


def make_model(family, shape):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    boundary = outline(shape)
    profile = PROFILES[family]
    vertices = [
        (x * radius, y * radius, height)
        for radius, height in profile
        for x, y in boundary
    ]
    faces = []
    for ring in range(len(profile) - 1):
        for segment in range(SEGMENTS):
            next_segment = (segment + 1) % SEGMENTS
            faces.append((
                ring * SEGMENTS + segment,
                (ring + 1) * SEGMENTS + segment,
                (ring + 1) * SEGMENTS + next_segment,
                ring * SEGMENTS + next_segment,
            ))
    mesh = bpy.data.meshes.new(f"{family}-{shape}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    editable = bmesh.new()
    editable.from_mesh(mesh)
    bmesh.ops.remove_doubles(editable, verts=list(editable.verts), dist=.000001)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(mesh)
    editable.free()
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    uv = mesh.uv_layers.new(name="CatalogProjection")
    for face in mesh.polygons:
        face.use_smooth = True
        for loop_index in face.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = ((vertex.x + 1) / 2, (vertex.y + 1) / 2)
    material = bpy.data.materials.new("Glazed ceramic")
    if material.node_tree is None:
        material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (.84, .85, .81, 1)
    shader.inputs["Roughness"].default_value = .29
    shader.inputs["Coat Weight"].default_value = .24
    obj.data.materials.append(material)
    modifier = obj.modifiers.new("Soft ceramic edges", "SUBSURF")
    modifier.levels = 1
    modifier.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Subdivision slightly shrinks the lip and foot. Normalize the final mesh,
    # so browser scaling still matches the catalog's measured proportions.
    for axis in range(3):
        low = min(vertex.co[axis] for vertex in obj.data.vertices)
        high = max(vertex.co[axis] for vertex in obj.data.vertices)
        for vertex in obj.data.vertices:
            normalized = (vertex.co[axis] - low) / (high - low)
            vertex.co[axis] = normalized if axis == 2 else 2 * normalized - 1
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{family}-{shape}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    return {"family": family, "shape": shape, "file": f"{family}-{shape}.glb"}


models = [
    make_model(family, shape)
    for family in PROFILES
    for shape in ["round", "square", "triangular", "irregular"]
]
(OUTPUT / "provenance.json").write_text(json.dumps({
    "generator": "scripts/build-dinnerware.py",
    "blender": bpy.app.version_string,
    "description": "Illustrative profile meshes; not manufacturer CAD or reconstructed product scans.",
    "coordinates": "Y up, 2-unit footprint, 1-unit height, base at zero.",
    "models": models,
}, indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(models)} dinnerware meshes to {OUTPUT}", flush=True)
