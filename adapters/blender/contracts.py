"""Renderer-independent V1 request validation and explicit glTF coordinate conversion."""
from datetime import datetime, timezone
import math
import re


class ProtocolError(RuntimeError):
    def __init__(self, message, code="validation_error"):
        super().__init__(message)
        self.code = code


def identifier(value, label):
    if not isinstance(value, str) or not value:
        raise ProtocolError(label + " must be a nonempty string")
    return value


def unit_scale(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ProtocolError("Unit scale must be positive and finite", "coordinate_error")
    return value


def vector(value):
    if not isinstance(value, (list, tuple)) or len(value) != 3:
        raise ProtocolError("translation must contain three finite numbers")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in value):
        raise ProtocolError("translation must contain three finite numbers")
    return value


def validate_request(value):
    if not isinstance(value, dict):
        raise ProtocolError("Intent must be an object")
    for field in ["schema", "request_id", "design_id", "resource_id", "source_resource_id", "source_revision", "source_sha256", "timestamp"]:
        identifier(value.get(field), field)
    if value["schema"] != "spatial-canvas.intent.v1" or value.get("intent") != "request_transform" or value.get("authority") != "request_only":
        raise ProtocolError("Unsupported schema, operation or authority", "unsupported_request")
    if not re.fullmatch(r"[a-f0-9]{64}", value["source_sha256"]):
        raise ProtocolError("Invalid source_sha256")
    try:
        stamp = value["timestamp"]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", stamp):
            raise ValueError("timestamp")
        datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except ValueError as error:
        raise ProtocolError("Invalid UTC timestamp") from error
    targets = value.get("targets")
    if not isinstance(targets, list) or not targets:
        raise ProtocolError("targets must be a nonempty array")
    ids = []
    for target in targets:
        if not isinstance(target, dict):
            raise ProtocolError("target must be an object")
        ids.append(identifier(target.get("global_id"), "global_id"))
        identifier(target.get("native_object_id"), "native_object_id")
    if len(set(ids)) != len(ids):
        raise ProtocolError("Duplicate target global_id", "duplicate_target")
    payload = value.get("payload")
    if not isinstance(payload, dict) or payload.get("space") != "world" or payload.get("unit") != "meter":
        raise ProtocolError("Only world-space meter translations are supported", "coordinate_error")
    identifier(payload.get("coordinate_frame"), "coordinate_frame")
    vector(payload.get("translation"))
    return value


def proxy_to_source(translation, meters_per_unit):
    x, y, z = vector(translation)
    scale = unit_scale(meters_per_unit)
    return [x / scale, -z / scale, y / scale]


def source_to_proxy(translation, meters_per_unit):
    x, y, z = vector(translation)
    scale = unit_scale(meters_per_unit)
    return [x * scale, z * scale, -y * scale]


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
