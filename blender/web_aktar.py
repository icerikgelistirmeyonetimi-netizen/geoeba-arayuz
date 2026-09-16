"""Matematik Takımadaları — Blender sahnelerini Three.js için dışa aktarır.

Kullanım (Blender 4.4):
  blender -b <sahne.blend> --python web_aktar.py -- <cikis_klasoru> <sayfa_id>

sayfa_id: ana-sayfa | ilkokul | ortaokul | lise

Üretilenler:
  <cikis>/models/<sayfa_id>.glb     Draco sıkıştırılmış, tıklanabilir gruplara göre birleştirilmiş sahne
  <cikis>/textures/deniz-<sayfa_id>.png  Deniz malzemesinin kıyıdan derine renk geçişi (pişirilmiş)
  <cikis>/data/<sayfa_id>.json      Kamera, ışık, deniz sınırları ve grup/etiket bilgileri

Kaynak .blend dosyası değiştirilmez; tüm işlemler kaydedilmeyen oturumda yapılır.
"""

import bpy
import bmesh
import json
import math
import os
import re
import sys
import time
import unicodedata
from mathutils import Vector

T0 = time.time()
ARGV = sys.argv[sys.argv.index("--") + 1:]
OUT_DIR = os.path.abspath(ARGV[0])
PAGE = ARGV[1]
IS_HOME = PAGE == "ana-sayfa"

for sub in ("models", "textures", "data"):
    os.makedirs(os.path.join(OUT_DIR, sub), exist_ok=True)

scene = bpy.context.scene
view_layer = bpy.context.view_layer


def log(*a):
    print(f"[web_aktar {PAGE} {time.time() - T0:6.1f}s]", *a, flush=True)


def slug(text):
    text = str(text).replace("ı", "i").replace("İ", "I")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def to_three(v):
    """Blender (Z yukarı) → Three.js (Y yukarı)."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]


# ---------------------------------------------------------------------------
# Görünürlük: render'da görünen nesneler
# ---------------------------------------------------------------------------
parent_of = {}
for col in bpy.data.collections:
    for child in col.children:
        parent_of[child.name] = col


def layer_collection_map(lc, acc):
    acc[lc.collection.name] = lc
    for c in lc.children:
        layer_collection_map(c, acc)
    return acc


LC = layer_collection_map(view_layer.layer_collection, {})


def collection_renderable(col):
    while col is not None:
        if col.hide_render:
            return False
        lc = LC.get(col.name)
        if lc is not None and lc.exclude:
            return False
        col = parent_of.get(col.name)
    return True


def renderable(ob):
    if ob.hide_render:
        return False
    return any(c == scene.collection or collection_renderable(c) for c in ob.users_collection)


def ancestors(ob):
    p = ob.parent
    while p is not None:
        yield p
        p = p.parent


# ---------------------------------------------------------------------------
# Web için hafifletme: eğri/yazı çözünürlüğü ve görünmeyecek kadar ince pahlar
# ---------------------------------------------------------------------------
curve_done = set()
for ob in scene.objects:
    if ob.type in {"CURVE", "FONT"} and ob.data.name not in curve_done:
        curve_done.add(ob.data.name)
        c = ob.data
        if ob.type == "FONT":
            c.resolution_u = min(c.resolution_u, 5)
            c.bevel_resolution = min(c.bevel_resolution, 1)
        else:
            thin = c.bevel_depth < 0.02
            c.resolution_u = min(c.resolution_u, 8 if thin else 12)
            c.bevel_resolution = min(c.bevel_resolution, 1 if thin else 2)
        c.render_resolution_u = 0
    for md in ob.modifiers:
        if md.type == "BEVEL":
            if md.width < 0.015:
                md.segments = 1
            elif md.width < 0.04:
                md.segments = min(md.segments, 2)

# Bitki örtüsü ve kıyı kayaları: çok sayıda yüksek bölümlü küçük küre. Uzaktan görünen
# biçim korunarak üçgen sayısı azaltılır (adanın toplam üçgeninin yaklaşık yarısıydı).
SEYRELTME = {
    "Bahçe • küçük çiçek": 0.35,
    "Peyzaj • çalı yaprağı": 0.5,
    "Ağaç • yoğun iç yaprak": 0.5,
    "Ağaç • ince dal": 0.5,
    "Kıyı • aşınmış kaya": 0.5,
    "Palmiye • gövde boğumu": 0.5,
}
seyreltilen = 0
for ob in scene.objects:
    if ob.type != "MESH":
        continue
    oran = next((v for k, v in SEYRELTME.items() if ob.name.startswith(k)), None)
    if oran is None:
        continue
    md = ob.modifiers.new("web_seyreltme", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = oran
    md.use_collapse_triangulate = True
    seyreltilen += 1

bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

# ---------------------------------------------------------------------------
# Malzemeler: prosedürel Cycles ağlarından web malzemesine yaklaşık değerler
# ---------------------------------------------------------------------------


def principled(mat):
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None


def socket_color(sock, depth=0):
    if not sock.is_linked or depth > 4:
        v = sock.default_value
        return list(v)[:3] if hasattr(v, "__len__") else [v, v, v]
    node = sock.links[0].from_node
    if node.type == "VALTORGB":
        ramp = node.color_ramp
        samples = [ramp.evaluate(0.3 + 0.4 * i / 8) for i in range(9)]
        return [sum(s[k] for s in samples) / len(samples) for k in range(3)]
    if node.type == "RGB":
        return list(node.outputs[0].default_value)[:3]
    if node.type in {"MIX", "MIX_RGB"}:
        cols = [i for i in node.inputs if i.type == "RGBA"]
        vals = [socket_color(i, depth + 1) for i in cols[:2]]
        if vals:
            return [sum(v[k] for v in vals) / len(vals) for k in range(3)]
    for inp in node.inputs:
        if inp.type == "RGBA":
            return socket_color(inp, depth + 1)
    v = sock.default_value
    return list(v)[:3] if hasattr(v, "__len__") else [0.8, 0.8, 0.8]


def socket_value(node, name, default):
    s = node.inputs.get(name)
    if s is None:
        return default
    if s.is_linked:
        return default if not hasattr(s.default_value, "__float__") else float(s.default_value)
    return float(s.default_value)


MATERIAL_INFO = {}
EXPORT_MATS = {}


def material_kind(name, info):
    low = name.lower()
    if low.startswith("cam") or info["transmission"] > 0.2:
        return "glass"
    if info["emission_strength"] > 0.05:
        return "emissive"
    if low.startswith("deniz") or "su aynası" in low or low.startswith("su "):
        return "water"
    if info["metallic"] > 0.5:
        return "metal"
    if low.startswith(("yaprak", "çim", "çiçek")):
        return "foliage"
    return "solid"


def export_material(src):
    if src is None:
        key = "__none__"
    else:
        key = src.name
    if key in EXPORT_MATS:
        return EXPORT_MATS[key]
    node = principled(src)
    if node is None:
        base = list(src.diffuse_color)[:3] if src else [0.8, 0.8, 0.8]
        info = {"base": base, "metallic": 0.0, "roughness": 0.6, "alpha": 1.0, "transmission": 0.0,
                "emission": [0, 0, 0], "emission_strength": 0.0}
    else:
        em_col = node.inputs.get("Emission Color")
        info = {
            "base": socket_color(node.inputs["Base Color"]),
            "metallic": socket_value(node, "Metallic", 0.0),
            "roughness": socket_value(node, "Roughness", 0.5),
            "alpha": socket_value(node, "Alpha", 1.0),
            "transmission": socket_value(node, "Transmission Weight", 0.0),
            "emission": list(em_col.default_value)[:3] if em_col is not None else [0, 0, 0],
            "emission_strength": socket_value(node, "Emission Strength", 0.0),
        }
    name = src.name if src else "Varsayılan"
    info["kind"] = material_kind(name, info)
    MATERIAL_INFO[name] = {k: ([round(x, 4) for x in v] if isinstance(v, list) else (round(v, 4) if isinstance(v, float) else v))
                           for k, v in info.items()}

    m = bpy.data.materials.new("W|" + name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*info["base"], 1.0)
    bsdf.inputs["Metallic"].default_value = info["metallic"]
    bsdf.inputs["Roughness"].default_value = info["roughness"]
    if info["emission_strength"] > 0:
        bsdf.inputs["Emission Color"].default_value = (*info["emission"], 1.0)
        bsdf.inputs["Emission Strength"].default_value = info["emission_strength"]
    m["kind"] = info["kind"]
    m["source"] = name
    EXPORT_MATS[key] = m
    return m


# ---------------------------------------------------------------------------
# Sahne bilgisi: ada kökleri, sınıf erişimleri, tabelalar
# ---------------------------------------------------------------------------
STAGE_IDS = {"ilkokul": "ilkokul", "ortaokul": "ortaokul", "lise": "lise"}


def stage_of_root(root):
    s = slug(root.get("school_stage", root.name))
    for k in STAGE_IDS:
        if k in s:
            return k
    return s


island_roots = [o for o in scene.objects if o.type == "EMPTY" and o.name.startswith("ADA_") and renderable(o)]
grade_roots = [o for o in scene.objects if o.type == "EMPTY" and o.name.startswith("ERISIM_")]


def grade_id(root):
    g = root.get("grade")
    return str(g) if g is not None else slug(root.name.replace("ERISIM_", ""))


def group_for(ob):
    anc = list(ancestors(ob))
    chain = [ob] + anc
    if ob.name.startswith("Okyanus"):
        return None
    for a in chain:
        if a.name.startswith("Yelkenli") and a.type == "EMPTY":
            # Köpük izi tekneyle birlikte ilerler ama sallanmaz (sallanırsa suya gömülüyor)
            if "köpük izi" in ob.name:
                return f"iz:{slug(a.name)}"
            return f"float:{slug(a.name)}"
    if ob.name.startswith("Şamandıra"):
        m = re.search(r"\.(\d+)$", ob.name)
        return f"float:samandira-{m.group(1) if m else '000'}"
    if IS_HOME:
        for a in chain:
            if a.type == "EMPTY" and a.name.startswith("ADA_"):
                return f"stage:{stage_of_root(a)}"
        return "static"
    for a in chain:
        if a.type == "EMPTY" and a.name.startswith("ERISIM_"):
            return f"grade:{grade_id(a)}"
    return "static"


# ---------------------------------------------------------------------------
# Geometriyi değerlendir ve grup bazında birleştir
# ---------------------------------------------------------------------------
export_col = bpy.data.collections.new("__WEB_EXPORT__")
scene.collection.children.link(export_col)

GEOM_TYPES = {"MESH", "CURVE", "FONT", "SURFACE", "META"}
groups = {}
tri_count = {}
skipped = 0
for ob in list(scene.objects):
    if ob.type not in GEOM_TYPES or not renderable(ob):
        continue
    key = group_for(ob)
    if key is None:
        continue
    ev = ob.evaluated_get(dg)
    try:
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    except RuntimeError:
        skipped += 1
        continue
    if me is None or len(me.polygons) == 0:
        skipped += 1
        continue
    # materials.clear() yüz başına material_index bilgisini sildiği için yuvalar yerinde değiştirilir
    slots = [s.material for s in ob.material_slots] or [None]
    for i, mat in enumerate(slots):
        if i < len(me.materials):
            me.materials[i] = export_material(mat)
        else:
            me.materials.append(export_material(mat))
    # Aynalanmış (negatif ölçekli) nesnelerde join yüz sarımını çevirmiyor; normaller içe dönük kalıyor
    if ob.matrix_world.determinant() < 0:
        me.flip_normals()
    for uv in list(me.uv_layers):
        me.uv_layers.remove(uv)
    for attr in [a for a in me.color_attributes]:
        me.color_attributes.remove(attr)
    tmp = bpy.data.objects.new("tmp", me)
    tmp.matrix_world = ob.matrix_world.copy()
    export_col.objects.link(tmp)
    groups.setdefault(key, []).append(tmp)
    tri_count[key] = tri_count.get(key, 0) + sum(len(p.vertices) - 2 for p in me.polygons)

log("geometri hazır:", {k: len(v) for k, v in groups.items()}, "atlanan:", skipped, "seyreltilen:", seyreltilen)

joined = {}
for key, objs in groups.items():
    target = objs[0]
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=target, object=target,
                                       selected_objects=objs, selected_editable_objects=objs):
            bpy.ops.object.join()
    # Dünya uzayına uygula; kayan nesneler için pivot grup merkezine taşınır
    me = target.data
    me.transform(target.matrix_world)
    target.matrix_world.identity()
    safe = key.replace(":", "|")
    target.name = safe
    me.name = safe
    joined[key] = target

log("birleştirme bitti:", len(joined), "grup")


def world_bbox_of_mesh(obj):
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx


group_meta = []
from mathutils import Matrix

# Yüzen gruplar önce işlenir; köpük izleri tekne pivotunu kullanır
for key, obj in sorted(joined.items(), key=lambda kv: (kv[0].startswith("iz:"), kv[0])):
    kind, _, gid = key.partition(":")
    mn, mx = world_bbox_of_mesh(obj)
    center = (mn + mx) / 2
    entry = {"key": key, "node": obj.name, "kind": kind, "id": gid or key,
             "bbox": {"min": to_three(Vector((mn.x, mn.y, mn.z))), "max": to_three(Vector((mx.x, mx.y, mx.z)))},
             "triangles": tri_count.get(key, 0)}
    # Three.js'te Y yukarı olduğu için min/max z değişimi düzeltilir
    bmin, bmax = entry["bbox"]["min"], entry["bbox"]["max"]
    entry["bbox"] = {"min": [min(bmin[i], bmax[i]) for i in range(3)], "max": [max(bmin[i], bmax[i]) for i in range(3)]}
    if kind == "float":
        pivot = Vector((center.x, center.y, 0.0))
        obj.data.transform(Matrix.Translation(-pivot))
        obj.location = pivot
        entry["pivot"] = to_three(pivot)
        entry["halfLength"] = round(max(mx.x - mn.x, mx.y - mn.y) / 2, 4)
    elif kind == "iz":
        tekne = next((e for e in group_meta if e["key"] == f"float:{gid}"), None)
        if tekne is not None:
            pivot = Vector((tekne["pivot"][0], -tekne["pivot"][2], 0.0))
            obj.data.transform(Matrix.Translation(-pivot))
            obj.location = pivot
            entry["pivot"] = tekne["pivot"]
            # Köpük izi teknenin arkasında kalır: izden tekneye yön = teknenin ilerleme yönü
            yon = Vector((pivot.x - center.x, pivot.y - center.y, 0.0))
            if yon.length > 1e-4:
                yon.normalize()
                tekne["heading"] = [round(yon.x, 5), round(-yon.y, 5)]  # Three.js XZ
                tekne["wake"] = key
    obj["group"] = key
    group_meta.append(entry)

# Etiket bağlantı noktaları
if IS_HOME:
    for root in island_roots:
        sid = stage_of_root(root)
        sign = next((c for c in root.children_recursive if c.name.startswith("Ada adı") and "tabela" in c.name), None)
        anchor = sign.matrix_world.translation if sign else root.matrix_world.translation
        for e in group_meta:
            if e["key"] == f"stage:{sid}":
                e.update({
                    "label": {"ilkokul": "İlkokul Adası", "ortaokul": "Ortaokul Adası", "lise": "Lise Adası"}.get(sid, root.name),
                    "short": {"ilkokul": "İlkokul", "ortaokul": "Ortaokul", "lise": "Lise"}.get(sid, sid),
                    "range": {"ilkokul": "1–4. sınıf", "ortaokul": "5–8. sınıf", "lise": "Hazırlık + 9–12. sınıf"}.get(sid, ""),
                    "anchor": to_three(anchor),
                    "center": to_three(root.matrix_world.translation),
                })
else:
    for root in grade_roots:
        gid = grade_id(root)
        sign = next((c for c in root.children_recursive if "levhas" in c.name), None)
        anchor = sign.matrix_world.translation if sign else root.matrix_world.translation
        for e in group_meta:
            if e["key"] == f"grade:{gid}":
                g = root.get("grade")
                e.update({
                    "grade": gid if g is None else (g if isinstance(g, str) else int(g)),
                    "label": str(root.get("label", gid)),
                    "description": str(root.get("description", "")),
                    "anchor": to_three(anchor),
                    "center": to_three(root.matrix_world.translation),
                })

# ---------------------------------------------------------------------------
# Deniz: kıyıdan derine renk geçişini dokuya pişir
# ---------------------------------------------------------------------------
ocean_meta = None
ocean = next((o for o in scene.objects if o.name.startswith("Okyanus") and o.type == "MESH"), None)
if ocean is not None:
    src_mat = ocean.material_slots[0].material if ocean.material_slots else None
    bake_me = ocean.data.copy()
    bm = bmesh.new()
    bm.from_mesh(bake_me)
    bm.normal_update()
    top_z = max(v.co.z for v in bm.verts)
    for f in [f for f in bm.faces if any(abs(v.co.z - top_z) > 1e-4 for v in f.verts)]:
        bm.faces.remove(f)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    lmin = (min(xs), min(ys))
    lmax = (max(xs), max(ys))
    uv = bm.loops.layers.uv.new("bake")
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = ((loop.vert.co.x - lmin[0]) / (lmax[0] - lmin[0]), (loop.vert.co.y - lmin[1]) / (lmax[1] - lmin[1]))
    bm.to_mesh(bake_me)
    bm.free()
    bake_ob = bpy.data.objects.new("__ocean_bake__", bake_me)
    bake_ob.matrix_world = ocean.matrix_world.copy()
    export_col.objects.link(bake_ob)

    size = 1024
    img = bpy.data.images.new("deniz_bake", size, size, alpha=False, float_buffer=False)
    tex_node = src_mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex_node.image = img
    src_mat.node_tree.nodes.active = tex_node

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 8
    for o in scene.objects:
        o.select_set(False)
    bake_ob.select_set(True)
    view_layer.objects.active = bake_ob
    with bpy.context.temp_override(active_object=bake_ob, object=bake_ob, selected_objects=[bake_ob]):
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8, use_clear=True)
    tex_path = os.path.join(OUT_DIR, "textures", f"deniz-{PAGE}.png")
    img.filepath_raw = tex_path
    img.file_format = "PNG"
    img.save()
    wmin = ocean.matrix_world @ Vector((lmin[0], lmin[1], top_z))
    wmax = ocean.matrix_world @ Vector((lmax[0], lmax[1], top_z))
    # Kenar pikselleri: dokunun dışındaki açık deniz rengi
    px = list(img.pixels)
    edge = [0.0, 0.0, 0.0]
    n = 0
    for i in range(size):
        for j in (0, size - 1):
            for (x, y) in ((i, j), (j, i)):
                k = (y * size + x) * 4
                edge[0] += px[k]; edge[1] += px[k + 1]; edge[2] += px[k + 2]
                n += 1
    ocean_meta = {
        "texture": f"textures/deniz-{PAGE}.png",
        # UV (0,0) Blender'da -x,-y köşesi; Three.js'te x ve -z eksenlerine karşılık gelir
        "minX": round(min(wmin.x, wmax.x), 4), "maxX": round(max(wmin.x, wmax.x), 4),
        "minY": round(min(wmin.y, wmax.y), 4), "maxY": round(max(wmin.y, wmax.y), 4),
        "level": round(wmax.z, 4),
        "edgeColorSRGB": [round(c / n, 4) for c in edge],
        "sourceMaterial": src_mat.name if src_mat else None,
    }
    export_col.objects.unlink(bake_ob)
    log("deniz pişirildi:", tex_path)

# ---------------------------------------------------------------------------
# Kamera ve ışıklar
# ---------------------------------------------------------------------------
cam = scene.camera
cam_meta = None
if cam is not None:
    mw = cam.matrix_world
    pos = mw.translation
    fwd = (mw.to_quaternion() @ Vector((0, 0, -1))).normalized()
    up = (mw.to_quaternion() @ Vector((0, 1, 0))).normalized()
    t = -pos.z / fwd.z if abs(fwd.z) > 1e-6 else 40.0
    target = pos + fwd * t
    cam_meta = {
        "type": cam.data.type,
        "position": to_three(pos),
        "target": to_three(target),
        "up": to_three(up),
        "orthoScale": round(cam.data.ortho_scale, 4),
        "lens": cam.data.lens,
        "sensor": cam.data.sensor_width,
        "renderAspect": round(scene.render.resolution_x / scene.render.resolution_y, 5),
    }

lights = []
for ob in scene.objects:
    if ob.type != "LIGHT" or not renderable(ob):
        continue
    L = ob.data
    direction = (ob.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
    lights.append({
        "name": ob.name, "type": L.type, "energy": L.energy, "color": [round(c, 4) for c in L.color],
        "position": to_three(ob.matrix_world.translation), "direction": to_three(direction),
        "size": getattr(L, "size", None), "angle": getattr(L, "angle", None),
    })

world = None
if scene.world and scene.world.use_nodes:
    bg = next((n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        world = {"color": [round(c, 4) for c in list(bg.inputs["Color"].default_value)[:3]],
                 "strength": round(bg.inputs["Strength"].default_value, 4)}

# ---------------------------------------------------------------------------
# GLB dışa aktarımı
# ---------------------------------------------------------------------------
for o in scene.objects:
    o.select_set(False)
for obj in joined.values():
    obj.select_set(True)
view_layer.objects.active = next(iter(joined.values()))

glb_path = os.path.join(OUT_DIR, "models", f"{PAGE}.glb")
props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
opts = dict(
    filepath=glb_path, export_format="GLB", use_selection=True, export_apply=False,
    export_texcoords=False, export_normals=True, export_tangents=False, export_vertex_color="NONE",
    export_materials="EXPORT", export_cameras=False, export_lights=False, export_extras=True,
    export_yup=True, export_animations=False, export_skins=False, export_morph=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=11,
    export_draco_texcoord_quantization=12, export_draco_color_quantization=10,
    export_draco_generic_quantization=12,
)
opts = {k: v for k, v in opts.items() if k in props or k == "filepath"}
bpy.ops.export_scene.gltf(**opts)
log("GLB yazıldı:", glb_path, f"{os.path.getsize(glb_path) / 1e6:.2f} MB")

meta = {
    "page": PAGE,
    "source": os.path.basename(bpy.data.filepath),
    "units": "metre, Three.js Y yukarı",
    "camera": cam_meta,
    "lights": lights,
    "world": world,
    "viewTransform": [scene.view_settings.view_transform, scene.view_settings.look, scene.view_settings.exposure],
    "ocean": ocean_meta,
    "model": f"models/{PAGE}.glb",
    "groups": sorted(group_meta, key=lambda e: (e["kind"], str(e.get("grade", e["id"])))),
    "materials": MATERIAL_INFO,
    "triangles": sum(tri_count.values()),
}
with open(os.path.join(OUT_DIR, "data", f"{PAGE}.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
log("tamam. üçgen:", meta["triangles"])
