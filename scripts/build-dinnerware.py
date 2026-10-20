"""Build the studio's reusable, UV-mapped dinnerware meshes with Blender.

Run: blender --background --factory-startup --python scripts/build-dinnerware.py
"""

import json
import math
import re
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models" / "dinnerware"
OUTPUT.mkdir(parents=True, exist_ok=True)
SEGMENTS = 96

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
        (0, .12), (.18, .12), (.32, .12), (.42, .18), (.53, .28), (.59, .35),
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
    "cup": [
        (0, .13), (.38, .13), (.57, .16), (.66, .24), (.74, .55),
        (.82, .94), (.85, .995), (.90, 1), (.94, .98), (.95, .94),
        (.86, .54), (.77, .13), (.72, .035), (.67, 0), (.55, 0),
        (.53, .05), (.30, .075), (0, .075),
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


def add_wall(points, name="Raised divider"):
    section = [(-.045, .16), (-.038, .28), (-.025, .65), (-.016, .84), (0, .89),
               (.016, .84), (.025, .65), (.038, .28), (.045, .16)]
    vertices, faces = [], []
    for index, (x, y) in enumerate(points):
        before, after = points[max(0, index - 1)], points[min(len(points) - 1, index + 1)]
        dx, dy = after[0] - before[0], after[1] - before[1]
        distance = math.hypot(dx, dy)
        for offset, height in section:
            vertices.append((x - dy / distance * offset, y + dx / distance * offset, height))
    width = len(section)
    for index in range(len(points) - 1):
        for edge in range(width):
            following = (edge + 1) % width
            faces.append((index * width + edge, index * width + following,
                          (index + 1) * width + following, (index + 1) * width + edge))
    faces.extend([tuple(reversed(range(width))),
                  tuple((len(points) - 1) * width + edge for edge in range(width))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    editable = bmesh.new()
    editable.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(mesh)
    editable.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    obj.select_set(True)
    return obj


def add_dividers(layout, shape):
    edge = .85
    def line(a, b):
        add_wall([a, b])
    def ring(center, radius):
        add_wall([(center[0] + radius * math.cos(i * math.tau / 96),
                   center[1] + radius * math.sin(i * math.tau / 96))
                  for i in range(97)], "Cup recess")
    if layout in ["three-radial", "three-holder"]:
        start = .15 if layout == "three-holder" else 0
        if start:
            ring((0, 0), start)
        for angle in [math.pi / 2, 7 * math.pi / 6, 11 * math.pi / 6]:
            line((start * math.cos(angle), start * math.sin(angle)),
                 (edge * math.cos(angle), edge * math.sin(angle)))
    elif layout == "three-curved":
        line((0, -.08), (0, edge))
        for sign in [-1, 1]:
            add_wall([(sign * edge * t, -.08 - .60 * t * (1 - t) - .12 * t)
                      for t in [i / 32 for i in range(33)]], "Curved divider")
    elif layout == "two":
        line((-edge, 0), (edge, 0)) if shape == "round" else line((0, -edge), (0, edge))
    elif layout == "three":
        for x in [-.29, .29]:
            line((x, -edge), (x, edge))
    elif layout == "four":
        line((-edge, 0), (edge, 0))
        line((0, -edge), (0, edge))
    elif layout.startswith("four-server"):
        sign = -1 if layout.endswith("reverse") else 1
        line((-edge, 0), (edge, 0))
        for x in [-.29, .29]:
            line((x, 0), (x, sign * edge))
    elif layout == "six":
        line((-edge, 0), (edge, 0))
        for x in [-.29, .29]:
            line((x, -edge), (x, edge))
    elif layout in ["six-left", "six-right"]:
        sign = 1 if layout == "six-left" else -1
        line((sign * -.68, -edge), (sign * -.68, edge))
        line((sign * -.68, 0), (sign * edge, 0))
        for x in [-.18, .34]:
            line((sign * x, 0), (sign * x, edge))
        line((sign * .08, -edge), (sign * .08, 0))
        ring((sign * .59, .44), .19)
    elif layout == "six-center":
        line((-edge, 0), (edge, 0))
        for x in [-.31, .31]:
            line((x, 0), (x, edge))
        line((.56, -edge), (.56, 0))
        ring((0, .44), .20)
    elif layout == "holder":
        ring((-.35, .12), .26)
    elif layout == "three-holders":
        line((-edge, .12), (edge, .12))
        for x in [-.56, 0, .56]:
            ring((x, .48), .20)


def add_handle():
    curve = bpy.data.curves.new("Hollow cup handle", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = .075
    curve.bevel_resolution = 4
    spline = curve.splines.new("BEZIER")
    coordinates = [(.88, 0, .82), (1.22, 0, .86), (1.55, 0, .69),
                   (1.48, 0, .41), (.77, 0, .23)]
    spline.bezier_points.add(len(coordinates) - 1)
    for point, coordinate in zip(spline.bezier_points, coordinates):
        point.co = coordinate
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new("Cup handle", curve)
    bpy.context.collection.objects.link(obj)
    obj.select_set(True)


def smooth_profile(profile):
    # Smooth the cross section before revolving it. Subdividing a collapsed
    # center fan instead introduces ripples and tilted normals in flat wells.
    for _ in range(2):
        result = [profile[0]]
        for a, b in zip(profile, profile[1:]):
            result.extend([
                tuple(.75 * a[i] + .25 * b[i] for i in range(2)),
                tuple(.25 * a[i] + .75 * b[i] for i in range(2)),
            ])
        result.append(profile[-1])
        profile = result
    return profile


def make_model(family, shape, layout=None, handle=False, profile=None, filename=None):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    boundary = outline(shape)
    profile = smooth_profile(profile or PROFILES[family])
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
    filename = filename or (
        f"divided-{layout}-{shape}" if layout else f"{'mug' if handle else family}-{shape}"
    )
    mesh = bpy.data.meshes.new(filename)
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
    if family == "glass":
        material.name = "Transmissive glass"
        shader.inputs["Base Color"].default_value = (.97, .99, .98, 1)
        shader.inputs["Roughness"].default_value = .065
        shader.inputs["Transmission Weight"].default_value = 1
        shader.inputs["IOR"].default_value = 1.5
        shader.inputs["Coat Weight"].default_value = 0
    obj.data.materials.append(material)
    # Profile smoothing slightly shrinks the lip and foot. Normalize the mesh,
    # so browser scaling still matches the catalog's measured proportions.
    for axis in range(3):
        low = min(vertex.co[axis] for vertex in obj.data.vertices)
        high = max(vertex.co[axis] for vertex in obj.data.vertices)
        for vertex in obj.data.vertices:
            normalized = (vertex.co[axis] - low) / (high - low)
            vertex.co[axis] = normalized if axis == 2 else 2 * normalized - 1
    if layout:
        add_dividers(layout, shape)
        # Fuse the wall roots and junctions into the well instead of leaving
        # separate intersecting surfaces with abrupt seams.
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.join()
        obj.data.remesh_voxel_size = .013
        bpy.ops.object.voxel_remesh()
        modifier = obj.modifiers.new("Molded divider joins", "SMOOTH")
        modifier.factor = .45
        modifier.iterations = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        modifier = obj.modifiers.new("Compact divider mesh", "DECIMATE")
        modifier.ratio = .10
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for face in obj.data.polygons:
            face.use_smooth = True
    if handle:
        add_handle()
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{filename}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    return {"family": "mug" if handle and family != "glass" else family, "shape": shape,
            "layout": layout, "file": f"{filename}.glb"}


def glass_measurement(item, marker):
    match = re.search(rf'\b{marker}(\d+(?:\s+\d+/\d+|/\d+)?)"', item["specification"])
    if not match:
        return None
    return sum(float(part.split("/")[0]) / float(part.split("/")[1])
               if "/" in part else float(part) for part in match[1].split())


def glass_form(item):
    name = item["name"].lower()
    for pattern, form in [
        ("shot|short glass", "shot"), ("stemless", "stemless"),
        ("coupe", "coupe"), ("martini", "martini"), ("margarita", "margarita"),
        ("flute|champagne", "flute"), ("brandy", "brandy"),
        ("hurricane|poco", "hurricane"), ("goblet", "goblet"), ("wine", "wine"),
        ("beer mug", "beer-mug"), ("pilsner|tall beer", "pilsner"),
    ]:
        if re.search(pattern, name):
            return form
    return "beer" if item["sku"] in ["AS-412", "AM-509", "AM-512"] else "tumbler"


def glass_profile(item, form):
    dimensions = item.get("dimensions") or {}
    width = max(dimensions.get("length") or 0,
                glass_measurement(item, "T") or 0,
                glass_measurement(item, "B") or 0, 1)
    mouth = glass_measurement(item, "T")
    mouth = mouth / width if mouth else (.78 if form in ["wine", "brandy", "stemless"] else 1)
    base = glass_measurement(item, "B")
    base = base / width if base else (.72 if form not in ["shot", "tumbler", "beer-mug"] else .82)
    wall = .045
    if form in ["shot", "tumbler", "beer-mug", "stemless", "pilsner"]:
        floor = .27 if form == "shot" else .075
        if form == "stemless":
            outer = [(base, .025), (.95, .13), (1, .38), (.97, .67), (mouth, .985)]
        elif form == "pilsner":
            outer = [(base, .025), (base, .05), (.35, .09), (.40, .30), (mouth, .985)]
        else:
            outer = [(base, .025), (base, .07), (mouth, .985)]
        inner = [(0, floor), (max(.18, outer[0][0] - .14), floor)]
        inner += [(max(.12, r - wall), max(floor + .025, h)) for r, h in outer[1:]]
        return inner + [(mouth - wall / 2, 1), (mouth, .995)] + list(reversed(outer)) + [(0, .025)]
    stem = {"coupe": .66, "martini": .58, "margarita": .55, "brandy": .18,
            "goblet": .26, "hurricane": .19, "beer": .12, "flute": .41}.get(form, .42)
    if item["sku"] in ["AS-510", "AS-114"]:
        stem = .19
    if form == "coupe":
        bowl = [(.12, stem), (.45, .73), (.88, .81), (mouth, .91), (mouth, .985)]
    elif form == "martini":
        bowl = [(.09, stem), (.20, stem + .045), (mouth, .985)]
    elif form == "margarita":
        bowl = [(.12, stem), (.34, stem + .02), (.35, .75), (.75, .79), (mouth, .90), (mouth, .985)]
    elif form == "flute":
        bowl = [(.09, stem), (.43, .48), (.70, .62), (mouth, .86), (mouth, .985)]
    elif form == "hurricane":
        bowl = [(.12, stem), (.62, .24), (.90, .40), (.83, .61), (.70, .80), (mouth, .985)]
    else:
        bowl = [(.12, stem), (.48, stem + .06), (.92, stem + (1 - stem) * .35),
                (1, stem + (1 - stem) * .65), (mouth, .985)]
    inner = [(0, stem + .04)]
    inner += [(max(.05, r - wall), h + (.025 if h < .95 else 0)) for r, h in bowl[1:]]
    foot = [(.10, stem - .025), (.065, stem - .07), (.065, .12),
            (.15, .07), (base * .85, .045), (base, .025), (base * .94, 0), (0, 0)]
    return inner + [(mouth - wall / 2, 1), (mouth, .995)] + list(reversed(bowl)) + foot


models = [
    make_model(family, shape)
    for family in ["rimmed", "coupe", "bowl", "tray"]
    for shape in ["round", "square", "triangular", "irregular"]
]
models += [make_model("cup", shape, handle=handle)
           for shape in ["round", "square"] for handle in [False, True]]
layouts = {
    "round": ["three-radial", "three-curved", "three-holder", "two", "four", "holder"],
    "square": ["two", "three", "four", "four-server", "four-server-reverse",
               "six", "six-left", "six-right", "six-center", "three-holders"],
}
models += [make_model("rimmed" if shape == "round" else "tray", shape, layout)
           for shape, variants in layouts.items() for layout in variants]
catalog = json.loads((ROOT / "src" / "data" / "catalog.json").read_text(encoding="utf-8"))
for item in catalog["items"]:
    if item["type"] != "glass":
        continue
    form = glass_form(item)
    model = make_model("glass", "round", handle=form == "beer-mug",
                       profile=glass_profile(item, form),
                       filename=f"glass-{item['sku'].lower()}")
    model.update({"item": item["id"], "form": form})
    models.append(model)
(OUTPUT / "provenance.json").write_text(json.dumps({
    "generator": "scripts/build-dinnerware.py",
    "blender": bpy.app.version_string,
    "description": "Illustrative profile meshes; not manufacturer CAD or reconstructed product scans.",
    "coordinates": "Y up, 2-unit body footprint (handles extend beyond), 1-unit height, base at zero.",
    "models": models,
}, indent=2) + "\n", encoding="utf-8")
print(f"Exported {len(models)} dinnerware meshes to {OUTPUT}", flush=True)
