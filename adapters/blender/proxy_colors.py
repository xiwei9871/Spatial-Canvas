"""Readable proxy colors only: no textures, original shader graphs or physical material intent."""
import hashlib
import math
import bpy

PALETTE=[
    (.20,.42,.50),(.54,.34,.23),(.40,.52,.30),(.51,.36,.52),
    (.55,.46,.23),(.30,.45,.58),(.57,.31,.30),(.32,.53,.47),
]
ZONING_COLORS={"floor":(.20,.22,.24),"furniture":(.60,.47,.32),"wall":(.82,.82,.79)}


def zoning_color(entity, source_object):
    """Presentation hints only. Native names/collections never establish semantic identity."""
    name=entity["native_object_id"].upper()
    semantic=entity["semantic_type"].lower()
    collections=[collection.name.upper() for collection in source_object.users_collection] if source_object else []
    if semantic in ["floor","floor_finish"] or "FLOOR" in name or name=="FASCIA_PLATFORM_CURVE":
        category="floor"
    elif semantic in ["wall","wall_header"] or any("WALL_CORNERS" in group for group in collections):
        category="wall"
    elif any(any(kind in group for kind in ["CORE_FURNITURE","STORAGE","KITCHEN","BATHROOMS","KITCHEN_ISLAND","WINDOW_AND_BUFFET"]) for group in collections) and "REAR_WALL" not in name:
        category="furniture"
    elif "WALL" in name or "PARTITION" in name or "HEADER" in name or "CONNECTED_RETURN" in name:
        category="wall"
    elif semantic in ["sofa","chair","chair_part","table","table_part","cabinet","bed","furniture","door","door_frame","door_handle","door_hinge"] or name.startswith(("FN_","B11_RECTANGLE","B11_CIRCLE")):
        category="furniture"
    else:
        category="wall"
    return ZONING_COLORS[category],"display_"+category


def base_color(material, entity):
    if material is not None:
        node=next((node for node in material.node_tree.nodes if node.type=="BSDF_PRINCIPLED"),None) if material.use_nodes and material.node_tree else None
        socket=node.inputs.get("Base Color") if node else None
        color=socket.default_value if socket and not socket.is_linked else material.diffuse_color
        if all(math.isfinite(value) for value in color[:3]):
            return tuple(round(max(0,min(1,float(value))),6) for value in color[:3]),"source_flat"
    # Only a presentation fallback, never semantic classification or identity inference.
    index=int.from_bytes(hashlib.sha256(entity["global_id"].encode()).digest()[:4],"big")%len(PALETTE)
    return PALETTE[index],"display_palette"


def assign_flat_colors(mesh, entity, cache, owned_materials, counts, mode="source-flat", source_object=None):
    sources=list(mesh.materials) or [None]
    indices=[polygon.material_index for polygon in mesh.polygons]
    mesh.materials.clear()
    for source in sources:
        rgb,origin=zoning_color(entity,source_object) if mode=="zoning-flat" else base_color(source,entity)
        counts[origin]=counts.get(origin,0)+1
        material=cache.get(rgb)
        if material is None:
            material=bpy.data.materials.new("SpatialCanvas_Flat_"+str(len(cache)))
            material.use_nodes=True
            material.diffuse_color=(*rgb,1)
            shader=material.node_tree.nodes.get("Principled BSDF")
            shader.inputs["Base Color"].default_value=(*rgb,1)
            shader.inputs["Metallic"].default_value=0
            shader.inputs["Roughness"].default_value=1
            # Opaque, double-sided flat colors; glass is represented as a color, not simulated.
            material.use_backface_culling=False
            cache[rgb]=material
            owned_materials.append(material)
        mesh.materials.append(material)
    # Clearing material slots resets Blender's polygon indices; restore original face regions.
    for polygon,index in zip(mesh.polygons,indices):
        polygon.material_index=min(index,len(sources)-1)
