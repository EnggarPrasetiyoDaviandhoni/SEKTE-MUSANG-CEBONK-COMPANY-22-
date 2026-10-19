#!/usr/bin/env python3
"""Fetch release times from primary calendars. Never infer missing release dates."""
import argparse
import calendar
import concurrent.futures
import datetime as dt
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request
import urllib.parse
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc
WIB = dt.timezone(dt.timedelta(hours=7))
NEW_YORK = ZoneInfo("America/New_York")
ALLOWED_HOSTS = {"www.bls.gov", "www.bea.gov", "www.federalreserve.gov"}


def need(condition, message):
    if not condition:
        raise ValueError(message)


class Node:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def all(self, tag=None, **attrs):
        result = []
        if (tag is None or self.tag == tag) and all(self.attrs.get(k) == v for k, v in attrs.items()):
            result.append(self)
        for child in self.children:
            if isinstance(child, Node):
                result.extend(child.all(tag, **attrs))
        return result

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def text(self):
        if self.tag in ("script", "style"):
            return ""
        return " ".join(" ".join(x.text() if isinstance(x, Node) else x for x in self.children).split())


class Document(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def release_epoch(year, month, day, time):
    match = re.fullmatch(r"\s*(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*", time, re.I)
    need(match is not None, "Unconfirmed release time: " + time)
    hour, minute = int(match[1]), int(match[2])
    need(1 <= hour <= 12 and 0 <= minute < 60, "Invalid release clock")
    hour = hour % 12 + (12 if match[3].lower() == "p" else 0)
    local = dt.datetime(year, month, day, hour, minute, tzinfo=NEW_YORK)
    need(local.replace(fold=0).utcoffset() == local.replace(fold=1).utcoffset(), "Ambiguous DST release clock")
    need(local.astimezone(UTC).astimezone(NEW_YORK) == local, "Ambiguous/nonexistent local clock")
    return int(local.timestamp())


def event(prefix, name, agency, year, month, day, time, source):
    return {"id": f"{prefix}-{year:04d}{month:02d}{day:02d}", "name": name,
            "agency": agency, "release_utc": release_epoch(year, month, day, time), "source": source}


def parse_bls(html, year, month, source):
    root = Document(html).root
    names = {"Employment Situation": ("nfp", "NFP / Employment Situation"),
             "Consumer Price Index": ("cpi", "CPI"), "Producer Price Index": ("ppi", "PPI")}
    events = []
    for cell in root.all("td"):
        identifier = cell.attrs.get("id", "")
        if not re.fullmatch(r"d\d{4}", identifier) or cell.has_class("other-month"):
            continue
        if int(identifier[1:3]) != month:
            continue
        day = int(identifier[3:5])
        for paragraph in cell.all("p"):
            titles = paragraph.all("strong")
            if not titles or titles[0].text() not in names:
                continue
            times = re.findall(r"\d{1,2}:\d{2}\s*[AP]M", paragraph.text(), re.I)
            need(len(times) == 1, "BLS selected event is missing an unambiguous time")
            prefix, name = names[titles[0].text()]
            events.append(event(prefix, name, "BLS", year, month, day, times[0], source))
    need({e["id"].split("-")[0] for e in events} == {"nfp", "cpi", "ppi"}, "BLS calendar layout/coverage changed")
    return events


def parse_fed(html, year, month, source):
    root = Document(html).root
    need(any(node.has_class("cal-nojs__rowTitle") for node in root.all("div")), "Fed calendar layout changed")
    events = []
    for row in root.all("div"):
        children = [node for node in row.children if isinstance(node, Node) and node.tag == "div"]
        columns = {size: [n for n in children if n.has_class("col-xs-" + size)] for size in ("2", "7", "3")}
        if not all(len(value) == 1 for value in columns.values()):
            continue
        title = columns["7"][0].text()
        if title.startswith("FOMC Press Conference"):
            prefix, name = "fed-pc", "FOMC Press Conference"
        elif title.startswith("FOMC Minutes"):
            prefix, name = "minutes", "FOMC Minutes"
        elif title.startswith("FOMC Meeting"):
            prefix, name = "fomc", "FOMC Statement"
        else:
            continue
        day = columns["3"][0].text()
        need(re.fullmatch(r"\d{1,2}", day), "Fed release day is ambiguous; do not infer a meeting end")
        events.append(event(prefix, name, "FED", year, month, int(day), columns["2"][0].text(), source))
    labels = [node for node in root.all("p") if node.text().startswith(("FOMC Minutes", "FOMC Press Conference", "FOMC Meeting"))]
    need(len(labels) == len(events), "Fed event rows were not completely decoded; stop rather than drop risk events")
    # An empty recognized month is allowed; no release date is manufactured.
    return events


def parse_bea(html, source):
    root = Document(html).root
    tables = root.all("table", id="release-schedule-table")
    need(len(tables) == 1, "BEA calendar layout changed")
    years = re.findall(r"Year\s+(20\d{2})", tables[0].text())
    need(len(set(years)) == 1, "BEA schedule year is missing/ambiguous")
    year = int(years[0])
    events, unconfirmed = [], []
    for row in tables[0].all("tr"):
        titles = [n for n in row.all("td") if n.has_class("release-title")]
        dates = [n for n in row.all("td") if n.has_class("scheduled-date")]
        if len(titles) != 1 or len(dates) != 1:
            continue
        title = titles[0].text()
        if title.startswith("GDP (Advance Estimate)"):
            prefix = "gdp"
        elif title.startswith("Personal Income and Outlays,"):
            prefix = "pce"
        else:
            continue
        date_nodes = [n for n in dates[0].all("div") if n.has_class("release-date")]
        times = dates[0].all("small")
        date = date_nodes[0].text() if len(date_nodes) == 1 else ""
        if re.search(r"announced|rescheduled", dates[0].text(), re.I):
            unconfirmed.append({"name": title, "source": source, "reason": "Official release date/time not confirmed"})
            continue
        need(len(times) == 1 and re.fullmatch(r"[A-Za-z]+\s+\d{1,2}", date), "BEA selected date/time is missing")
        # Ignore cosmetic badges and overlays scoped only to an older year's tab.
        # Active date/time changes require review, never evaluation of remote JS.
        for overlay in re.findall(r'\{[^{}]*"target-date"\s*:\s*"' + re.escape(date) + r'"[^{}]*\}', html, re.S):
            scope = re.search(r'"apply-to"\s*:\s*(null|\[[^\]]*\])', overlay)
            tabs = json.loads(scope[1]) if scope else None
            if tabs is not None and not ({"Upcoming Releases", f"{year} Schedule"} & set(tabs)):
                continue
            changes_clock = re.search(r'"replacement-(?:release|small)Text"\s*:\s*"', overlay)
            disables = re.search(r'"row-disable"\s*:\s*true', overlay)
            need(not (changes_clock or disables), "BEA date has an active client-side override; review required")
        parsed = dt.datetime.strptime(f"{date} {year}", "%B %d %Y")
        events.append(event(prefix, title, "BEA", year, parsed.month, parsed.day, times[0].text(), source))
    need(events, "No confirmed BEA supported releases found")
    labels = [node for node in tables[0].all("td") if node.text().startswith(("GDP (Advance Estimate)", "Personal Income and Outlays,"))]
    need(len(labels) == len(events) + len(unconfirmed), "BEA selected rows were not completely decoded")
    return events, unconfirmed, year


def fetch(url):
    need(urllib.parse.urlparse(url).hostname in ALLOWED_HOSTS, "Unapproved calendar source")
    request = urllib.request.Request(url, headers={"User-Agent": "Cebonk-MT5-Calendar-Audit/1.0", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=25) as response:
        final = urllib.parse.urlparse(response.url)
        need(response.status == 200 and final.scheme == "https" and final.hostname in ALLOWED_HOSTS, "Unverified calendar response")
        raw = response.read(4000001)
        need(len(raw) <= 4000000, "Calendar response too large")
    return raw.decode("utf-8-sig"), hashlib.sha256(raw).hexdigest()


def sync(now):
    date = dt.datetime.fromtimestamp(now, WIB).replace(hour=0, minute=0, second=0, microsecond=0)
    start = date - dt.timedelta(days=1)
    end = start + dt.timedelta(days=30)
    first = start.replace(day=1)
    months = []
    while first < end:
        months.append((first.year, first.month))
        first = (first.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    jobs = []
    for year, month in months:
        jobs.append(("BLS", year, month, f"https://www.bls.gov/schedule/{year}/{month:02d}_sched.htm"))
        jobs.append(("FED", year, month, f"https://www.federalreserve.gov/newsevents/{year}-{calendar.month_name[month].lower()}.htm"))
    jobs.append(("BEA", 0, 0, "https://www.bea.gov/news/schedule"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(fetch, [job[3] for job in jobs]))
    events, sources, unconfirmed = [], [], []
    for (agency, year, month, url), (html, digest) in zip(jobs, responses):
        sources.append({"agency": agency, "url": url, "sha256": digest, "checked_at_utc": now})
        if agency == "BLS":
            events.extend(parse_bls(html, year, month, url))
        elif agency == "FED":
            events.extend(parse_fed(html, year, month, url))
        else:
            bea, unknown, year = parse_bea(html, url)
            need(year == date.year, "BEA source does not cover the current year")
            events.extend(bea)
            unconfirmed.extend(unknown)
            end = min(end, dt.datetime(year + 1, 1, 1, tzinfo=WIB))
    unique = {}
    for item in events:
        if not int(start.timestamp()) - 86400 <= item["release_utc"] < int(end.timestamp()) + 86400:
            continue
        need(item["id"] not in unique or item == unique[item["id"]], "Conflicting official event identity")
        unique[item["id"]] = item
    return {"source": "OFFICIAL_BLS_BEA_FED", "checked_at_utc": now,
            "coverage_from_utc": int(start.timestamp()), "coverage_to_utc": int(end.timestamp()),
            "sources": sources, "unconfirmed_releases": unconfirmed,
            "events": sorted(unique.values(), key=lambda e: (e["release_utc"], e["id"]))}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    payload = sync(int(dt.datetime.now(UTC).timestamp()))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.out.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2) + "\n")
    temporary.replace(args.out)
    print(json.dumps({"official_events": len(payload["events"]), "sources": len(payload["sources"]), "checked_at_utc": payload["checked_at_utc"]}))
