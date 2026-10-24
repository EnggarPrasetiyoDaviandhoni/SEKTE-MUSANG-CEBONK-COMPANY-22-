#!/usr/bin/env python3
"""Local-only parity checks against the uploaded originals, without publishing EA source."""
import argparse
import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts/mt5-feeds" / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


V = module("strict_feed_validation", "validate.py")
N = module("original_decoder_harness", "check_original_ea.py")


def cases(feed, kind, now):
    result = [("real generated payload", json.dumps(feed), True)]

    def changed(name, callback, accepted=False):
        value = copy.deepcopy(feed)
        callback(value)
        result.append((name, json.dumps(value), accepted))

    for key, value in [("model", "WRONG"), ("schema_version", 99), ("schema_version", True),
                       ("schema_version", float(feed["schema_version"])), ("instrument", "XAGUSD"),
                       ("generated_at_utc", now + 1), ("generated_at_utc", now * 1000),
                       ("generated_at_utc", str(now)), ("expires_at_utc", now),
                       ("schedule_to_utc", now + 90 * 86400), ("revision", "unsafe/id")]:
        changed("root " + key + "=" + repr(value), lambda value_feed, k=key, x=value: value_feed.update({k: x}))
    changed("duplicate signal IDs", lambda x: x["signals"].append(copy.deepcopy(x["signals"][0])))
    changed("window out of coverage", lambda x: x["signals"][0].update(end_utc=x["schedule_to_utc"] + 1))
    changed("overlap with another ID", lambda x: x["signals"].append(dict(x["signals"][0], signal_id="local-test-only-another-id")))
    changed("bad direction", lambda x: x["signals"][0].update(direction="WAIT"))
    changed("wrong WIB date", lambda x: x["signals"][0].update(date_wib="2020-01-01"))
    changed("empty signals allowed by original", lambda x: x.update(signals=[]), True)
    if kind == "news":
        changed("news rejects neutral", lambda x: x["signals"][0].update(direction="NEUTRAL"))
        changed("news rejects session alias", lambda x: x["signals"][0].update(session_id="london"))
        changed("news core at exclusive end", lambda x: x["signals"][0].update(core_utc=x["signals"][0]["end_utc"]))
    else:
        changed("moment neutral is valid", lambda x: x["signals"][0].update(direction="NEUTRAL"), True)
        changed("millisecond timestamp mismatch", lambda x: x["signals"][0].update(event_time_utc_ms=x["signals"][0]["core_utc"]))
        changed("moment wrong midnight", lambda x: x["signals"][0].update(start_utc=x["signals"][0]["start_utc"] + 60))
        index = next((i for i, s in enumerate(feed["signals"]) if s["context"] == "friday"), None)
        if index is not None:
            changed("Friday must carry until 04 WIB", lambda x: x["signals"][index].update(end_utc=x["signals"][index]["end_utc"] - 14400))
    text = json.dumps(feed)
    result.extend([
        ("duplicate root key", '{"model":"duplicate",' + text[1:], False),
        ("escaped duplicate root key", '{"\\u006dodel":"duplicate",' + text[1:], False),
        ("trailing bytes", text + " trailing", False),
        ("unpaired surrogate", '{"bad":"\\ud800",' + text[1:], False),
        ("excessive JSON nesting", '{"bad":' + '[' * 34 + '0' + ']' * 34 + ',' + text[1:], False),
    ])
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--news-ea", type=Path, required=True)
    parser.add_argument("--moments-ea", type=Path, required=True)
    parser.add_argument("--generated-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = {"scope": "C++ compatibility harness for unchanged original decoder; not a live MT5 terminal", "results": []}
    with tempfile.TemporaryDirectory(prefix="private-ea-parity-") as directory:
        for kind, ea, filename in [("news", args.news_ea, "news-astrology-mt5.json"),
                                   ("moments", args.moments_ea, "astro-4momen-mt5.json")]:
            build = Path(directory) / kind
            build.mkdir()
            binary, digest = N.compile_decoder(ea, build)
            feed = V.strict_load(args.generated_dir / filename)
            now = feed["generated_at_utc"] + 1
            for name, text, expected in cases(feed, kind, now):
                path = build / "local-only-test.json"
                path.write_text(text)
                try:
                    V.validate(V.strict_load(path), kind, now)
                    python_ok = True
                except (ValueError, UnicodeError):
                    python_ok = False
                native = subprocess.run([str(binary), str(path), str(now), "XAUUSD"], capture_output=True, text=True)
                native_ok = native.returncode == 0
                result = {"kind": kind, "case": name, "expected": expected,
                          "python_accepted": python_ok, "original_decoder_accepted": native_ok,
                          "pass": python_ok == native_ok == expected, "ea_sha256": digest}
                report["results"].append(result)
    report["passed"] = sum(x["pass"] for x in report["results"])
    report["total"] = len(report["results"])
    report["checked_at_utc"] = dt.datetime.now(dt.timezone.utc).isoformat()
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "total": report["total"]}))
    for item in report["results"]:
        if not item["pass"]:
            print(json.dumps(item))
    raise SystemExit(report["passed"] != report["total"])
