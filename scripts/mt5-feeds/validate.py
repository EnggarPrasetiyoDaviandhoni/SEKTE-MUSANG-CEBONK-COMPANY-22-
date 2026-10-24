#!/usr/bin/env python3
"""Strict JSON/EA contract checks; no order logic and no direction generation."""
import argparse
import datetime as dt
import json
import re
from pathlib import Path

UTC = dt.timezone.utc
WIB = dt.timezone(dt.timedelta(hours=7))
MIN_EPOCH, MAX_EPOCH = 1577836800, 2240697600
CONTRACTS = {
    "news": {"schema_version": 1, "model": "CEBONK_NEWS_ASTROLOGY_V1",
             "engine_version": "1.0.0", "strategy_mode": "BBMA_3TF_NEWS",
             "source_timezone": "Asia/Jakarta"},
    "moments": {"schema_version": 2, "model": "CEBONK_FOUR_MOMENTS_ASTROLOGY_V1",
                "engine_version": "2.1.0", "bias_engine_version": "1.0.0",
                "strategy_mode": "BBMA_3TF_FOUR_MOMENTS", "source_timezone": "Asia/Jakarta",
                "window_policy": "WIB_CONTEXT_DAY_FRI_CLOSE_0400_V1"},
}


def need(condition, reason):
    if not condition:
        raise ValueError(reason)


def strict_load(path):
    text = Path(path).read_bytes().decode("utf-8")
    need(len(text.encode("utf-16-le")) // 2 <= 2000000, "JSON exceeds EA character limit")

    def pairs(items):
        result = {}
        for key, value in items:
            need(key not in result, "Duplicate JSON key: " + key)
            result[key] = value
        return result

    def constant(value):
        raise ValueError("Non-JSON constant: " + value)

    value = json.loads(text, object_pairs_hook=pairs, parse_constant=constant)

    def bounds(node, depth=0):
        need(depth <= 32, "JSON exceeds EA depth limit")
        if isinstance(node, str):
            node.encode("utf-16-le")  # Reject unpaired surrogate escapes.
        if isinstance(node, dict):
            return 1 + sum(bounds(key, depth) + bounds(child, depth + 1) for key, child in node.items())
        if isinstance(node, list):
            return 1 + sum(bounds(child, depth + 1) for child in node)
        return 1

    need(bounds(value) <= 200000, "JSON exceeds EA token limit")
    return value


def integer(value, digits=11):
    return type(value) is int and value >= 0 and len(str(value)) <= digits


def epoch(value):
    return integer(value) and MIN_EPOCH <= value <= MAX_EPOCH


def identity(value, maximum):
    return isinstance(value, str) and 1 <= len(value) <= maximum and re.fullmatch(r"[A-Za-z0-9_.:-]+", value)


def local(epoch_value):
    return dt.datetime.fromtimestamp(epoch_value, WIB)


def session(signal, kind):
    return signal["session_id"] if kind == "news" else signal["moment_id"] + "_" + signal["context"]


def signature(signal, kind):
    return tuple(signal[k] for k in ["signal_id", "date_wib", "direction", "start_utc", "core_utc", "end_utc"]) + (session(signal, kind),)


def validate(feed, kind, now, instrument="XAUUSD"):
    need(kind in CONTRACTS and isinstance(feed, dict), "Feed root must be an object")
    for key, expected in CONTRACTS[kind].items():
        need(type(feed.get(key)) is type(expected) and feed[key] == expected, "Header mismatch: " + key)
    need(feed.get("instrument") == instrument, "Instrument mismatch")
    need(identity(feed.get("revision"), 96), "Invalid revision")
    for key in ["generated_at_utc", "expires_at_utc", "schedule_from_utc", "schedule_to_utc"]:
        need(epoch(feed.get(key)), "Epoch must be integer seconds: " + key)
    generated, expires = feed["generated_at_utc"], feed["expires_at_utc"]
    start, end = feed["schedule_from_utc"], feed["schedule_to_utc"]
    need(generated < expires and start < end and end - start <= (31 if kind == "news" else 64) * 86400, "Invalid lifetime/coverage")
    need(generated <= now < expires and start <= now < end, "Feed is not available at requested UTC time")
    signals = feed.get("signals")
    need(isinstance(signals, list) and len(signals) <= 4096, "signals must be a bounded array")
    seen = set()
    slots = {}
    for signal in signals:
        need(isinstance(signal, dict) and identity(signal.get("signal_id"), 160), "Invalid signal identity")
        need(signal["signal_id"] not in seen, "Duplicate signal ID")
        seen.add(signal["signal_id"])
        need(isinstance(signal.get("date_wib"), str), "date_wib must be a string")
        sides = ("BUY", "SELL") if kind == "news" else ("BUY", "SELL", "NEUTRAL")
        need(signal.get("direction") in sides, "Unsupported direction")
        for key in ["start_utc", "core_utc", "end_utc"]:
            need(epoch(signal.get(key)), "Invalid signal epoch: " + key)
        a, core, b = signal["start_utc"], signal["core_utc"], signal["end_utc"]
        need(start <= a < b <= end, "Window outside coverage")
        date = local(a)
        need(signal["date_wib"] == date.strftime("%Y-%m-%d"), "WIB date mismatch")
        if kind == "news":
            need(signal.get("session_id") == "news" and a <= core < b, "Invalid news window/session")
            need(date.weekday() < 5, "News windows cannot start on a WIB weekend")
        else:
            need(signal.get("moment_id") in ("baru", "kuartal1", "purnama", "kuartal3"), "Invalid lunar phase")
            context = signal.get("context")
            need(context in ("event", "friday", "monday"), "Invalid moment context")
            event_ms = signal.get("event_time_utc_ms")
            need(integer(event_ms, 15) and event_ms // 1000 == core, "event_time_utc_ms must preserve astronomical core")
            event = local(core)
            expected = event.replace(hour=0, minute=0, second=0, microsecond=0)
            need(date.hour == date.minute == date.second == 0, "Context must begin at WIB midnight")
            need(b - a == 86400 + (14400 if date.weekday() == 4 else 0), "Friday context must end Saturday 04:00 WIB")
            if context != "event":
                need(event.weekday() in (5, 6), "Bridges require a real weekend event")
                if context == "friday":
                    expected -= dt.timedelta(days=1 if event.weekday() == 5 else 2)
                else:
                    expected += dt.timedelta(days=2 if event.weekday() == 5 else 1)
            need(a == int(expected.timestamp()), "Context does not match astronomical event date")
        key = (signal["date_wib"], session(signal, kind))
        need(all(not (a < old_b and old_a < b) for old_a, old_b in slots.get(key, [])), "Overlapping windows in the same session")
        slots.setdefault(key, []).append((a, b))
    return feed


def validate_update(previous, current, kind, now):
    """Conservative publication guard; a live terminal's spent ledger is not accessible."""
    need(current["generated_at_utc"] >= previous["generated_at_utc"], "Rollback rejected")
    if current["generated_at_utc"] == previous["generated_at_utc"]:
        need(current == previous, "Conflicting publication in the same second")
    old = {s["signal_id"]: s for s in previous["signals"]}
    new = {s["signal_id"]: s for s in current["signals"]}
    for signal in current["signals"]:
        if signal["signal_id"] in old:
            need(signature(signal, kind) == signature(old[signal["signal_id"]], kind), "Existing signal identity mutated")
        for prior in previous["signals"]:
            if signal["signal_id"] != prior["signal_id"] and signal["date_wib"] == prior["date_wib"] and session(signal, kind) == session(prior, kind):
                need(not (signal["start_utc"] < prior["end_utc"] and prior["start_utc"] < signal["end_utc"]), "Replacement of an existing slot needs review")
    for key, signal in old.items():
        if signal["end_utc"] > now and current["schedule_from_utc"] <= signal["start_utc"] and signal["end_utc"] <= current["schedule_to_utc"]:
            need(key in new, "Unexpired window removed; explicit cancellation needs review")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=CONTRACTS, required=True)
    parser.add_argument("--file", type=Path, required=True)
    parser.add_argument("--now", type=int, default=None)
    parser.add_argument("--instrument", default="XAUUSD")
    parser.add_argument("--previous", type=Path)
    args = parser.parse_args()
    now = args.now if args.now is not None else int(dt.datetime.now(UTC).timestamp())
    feed = validate(strict_load(args.file), args.kind, now, args.instrument)
    if args.previous and args.previous.exists():
        previous = strict_load(args.previous)
        validate(previous, args.kind, previous["generated_at_utc"], args.instrument)
        validate_update(previous, feed, args.kind, now)
    print(json.dumps({"valid": True, "kind": args.kind, "signals": len(feed["signals"]), "checked_at_utc": now}))


if __name__ == "__main__":
    main()
