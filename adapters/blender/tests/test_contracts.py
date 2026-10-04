import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from contracts import ProtocolError, validate_request, proxy_to_source, source_to_proxy


def request():
    return {
        "schema": "spatial-canvas.intent.v1", "request_id": "req_test", "design_id": "design_test",
        "resource_id": "proxy", "source_resource_id": "source", "source_revision": "rev-00001",
        "source_sha256": "a" * 64, "targets": [{"global_id": "ent_sofa", "native_object_id": "Sofa"}],
        "intent": "request_transform", "authority": "request_only",
        "payload": {"translation": [0.5, 0, 0], "space": "world", "unit": "meter", "coordinate_frame": "proxy_world"},
        "timestamp": "2026-10-04T06:00:00.000Z",
    }


class Contracts(unittest.TestCase):
    def test_supported_request(self):
        self.assertEqual(validate_request(request())["request_id"], "req_test")

    def test_missing_empty_and_wrong_typed_fields(self):
        for field in ["schema", "request_id", "design_id", "resource_id", "source_resource_id", "source_revision", "source_sha256", "timestamp"]:
            for value in [None, "", 7]:
                with self.subTest(field=field, value=value), self.assertRaises(ProtocolError):
                    validate_request({**request(), field: value})

    def test_unsupported_and_invalid_payload(self):
        for patch in [{"schema": "v2"}, {"intent": "rotate"}, {"authority": "authoritative"},
                      {"targets": []}, {"targets": [request()["targets"][0]] * 2}, {"timestamp": "today"}]:
            with self.subTest(patch=patch), self.assertRaises(ProtocolError):
                validate_request({**request(), **patch})
        for translation in [[0, 0], [math.nan, 0, 0], [math.inf, 0, 0], [True, 0, 0], ["1", 0, 0]]:
            with self.subTest(translation=translation), self.assertRaises(ProtocolError):
                validate_request({**request(), "payload": {**request()["payload"], "translation": translation}})
        with self.assertRaises(ProtocolError):
            validate_request({**request(), "payload": {**request()["payload"], "coordinate_frame": ""}})

    def test_axes_and_non_unit_scale(self):
        for scale in [1, 0.01, 2]:
            for proxy, source in [([1, 0, 0], [1/scale, 0, 0]), ([0, 1, 0], [0, 0, 1/scale]),
                                  ([0, 0, 1], [0, -1/scale, 0])]:
                self.assertEqual(proxy_to_source(proxy, scale), source)
                self.assertEqual(source_to_proxy(source, scale), proxy)

    def test_invalid_unit_scale(self):
        for scale in [0, -1, math.inf, math.nan, True]:
            with self.subTest(scale=scale), self.assertRaises(ProtocolError):
                proxy_to_source([1, 0, 0], scale)


if __name__ == "__main__":
    unittest.main()
