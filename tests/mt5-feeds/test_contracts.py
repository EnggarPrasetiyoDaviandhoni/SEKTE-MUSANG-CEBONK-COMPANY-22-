"""Malformed payload fixtures are local tests only; never publication inputs."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("feed_validation", ROOT / "scripts/mt5-feeds/validate.py")
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)
NOW = 1792368000  # 2026-10-19 00:00 UTC


def payload(kind="news"):
    start = int(V.dt.datetime(2026, 10, 19, tzinfo=V.WIB).timestamp())
    result = dict(V.CONTRACTS[kind], instrument="XAUUSD", revision="test-only-revision",
                  generated_at_utc=NOW - 60, expires_at_utc=NOW + 3600,
                  schedule_from_utc=start - 86400, schedule_to_utc=start + 10 * 86400, signals=[])
    if kind == "news":
        result["signals"] = [{"signal_id": "test-only-news", "date_wib": "2026-10-19", "session_id": "news",
                              "direction": "BUY", "start_utc": start, "core_utc": start + 60, "end_utc": start + 600}]
    else:
        # Actual event time is not asserted by these malformed-input fixtures.
        result["signals"] = [{"signal_id": "test-only-moment", "date_wib": "2026-10-19", "moment_id": "kuartal1",
                              "context": "monday", "direction": "NEUTRAL", "start_utc": start,
                              "core_utc": start - 86400 + 3600, "end_utc": start + 86400,
                              "event_time_utc_ms": (start - 86400 + 3600) * 1000 + 123}]
    return result


class ContractTests(unittest.TestCase):
    def test_exact_headers_and_empty_array_are_valid(self):
        for kind in V.CONTRACTS:
            feed = payload(kind)
            V.validate(feed, kind, NOW)
            feed["signals"] = []
            V.validate(feed, kind, NOW)

    def test_header_epoch_direction_and_overlap_rejections(self):
        cases = [
            ("schema_version", True), ("schema_version", 1.0), ("schema_version", 99),
            ("model", "wrong"), ("engine_version", "wrong"), ("instrument", "XAGUSD"),
            ("revision", "unsafe/revision"), ("generated_at_utc", NOW + 1),
            ("generated_at_utc", str(NOW)), ("generated_at_utc", NOW * 1000),
            ("expires_at_utc", NOW), ("schedule_to_utc", NOW + 90 * 86400),
            ("signals", None),
        ]
        for key, value in cases:
            with self.subTest(key=key, value=value):
                feed = payload()
                feed[key] = value
                with self.assertRaises(ValueError):
                    V.validate(feed, "news", NOW)
        for change in [
            {"direction": "NEUTRAL"}, {"session_id": "london"}, {"start_utc": NOW * 1000},
            {"core_utc": payload()["signals"][0]["end_utc"]}, {"date_wib": "2026-10-20"},
        ]:
            feed = payload()
            feed["signals"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                V.validate(feed, "news", NOW)
        feed = payload()
        other = copy.deepcopy(feed["signals"][0])
        other["signal_id"] += "-different-id"
        feed["signals"].append(other)
        with self.assertRaisesRegex(ValueError, "Overlapping"):
            V.validate(feed, "news", NOW)

    def test_moment_neutral_bridge_milliseconds_and_friday_policy(self):
        feed = payload("moments")
        V.validate(feed, "moments", NOW)
        for change in [{"event_time_utc_ms": 1}, {"context": "event"}, {"end_utc": feed["signals"][0]["end_utc"] + 14400}]:
            bad = copy.deepcopy(feed)
            bad["signals"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                V.validate(bad, "moments", NOW)
        friday = copy.deepcopy(feed)
        signal = friday["signals"][0]
        signal.update(context="friday", date_wib="2026-10-16", start_utc=signal["start_utc"] - 3 * 86400)
        signal["end_utc"] = signal["start_utc"] + 86400 + 14400
        friday["schedule_from_utc"] -= 5 * 86400
        V.validate(friday, "moments", NOW)
        signal["end_utc"] -= 14400
        with self.assertRaises(ValueError):
            V.validate(friday, "moments", NOW)

    def test_strict_json_duplicates_surrogates_depth_and_trailing_bytes(self):
        strings = ['{"model":1,"model":2}', '{"m\\u006fdel":1,"model":2}',
                   '{"text":"\\ud800"}', '{"x":NaN}', '{} trailing', '[' * 34 + '0' + ']' * 34]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "local-test-only.json"
            for text in strings:
                path.write_text(text)
                with self.subTest(text=text), self.assertRaises((ValueError, UnicodeError)):
                    V.strict_load(path)

    def test_refresh_cannot_reset_identity_rollback_or_revoke_window(self):
        old = payload()
        old["signals"][0]["start_utc"] = NOW + 100
        old["signals"][0]["core_utc"] = NOW + 200
        old["signals"][0]["end_utc"] = NOW + 600
        new = copy.deepcopy(old)
        new.update(generated_at_utc=NOW, expires_at_utc=NOW + 7200, revision="new-publication")
        V.validate_update(old, new, "news", NOW)
        for mutation in ["rollback", "same_second", "id", "direction", "revoke"]:
            bad = copy.deepcopy(new)
            if mutation == "rollback": bad["generated_at_utc"] = old["generated_at_utc"] - 1
            if mutation == "same_second": bad["generated_at_utc"] = old["generated_at_utc"]
            if mutation == "id": bad["signals"][0]["signal_id"] += "-another"
            if mutation == "direction": bad["signals"][0]["direction"] = "SELL"
            if mutation == "revoke": bad["signals"] = []
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                V.validate_update(old, bad, "news", NOW)


if __name__ == "__main__":
    unittest.main()
