import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("release_calendars", ROOT / "scripts/mt5-feeds/sync_calendar.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def nyfed_fixture(year=2026, month=10):
    days = {10: {2: "Employment Situation", 14: "Consumer Price Index", 15: "Producer Price Index (PPI)"},
            11: {6: "Employment Situation", 10: "Consumer Price Index", 13: "Producer Price Index (PPI)"}}[month]
    cells = []
    for day in range(1, C.calendar.monthrange(year, month)[1] + 1):
        if C.dt.date(year, month, day).weekday() >= 5:
            continue
        release = ''
        if day in days:
            release = '<span class="ts-accordion-content"><a href="https://www.example.org">Other release</a>(10:00)' \
                      f'<a href="https://www.bls.gov/news.release/">{days[day]}</a><br />(08:30)<br />' \
                      '<a href="https://www.example.org">Next release</a>(14:00)</span>'
        cells.append(f'<td class="somatdR"><div>{day:02d}<br />{release}</div></td>')
    return f'<p>{C.calendar.month_name[month]} {year} (all Eastern Time)</p><table class="research-table-1col greyborder">' \
           '<tr><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th></tr><tr>' + ''.join(cells) + '</tr></table>'


class CalendarTests(unittest.TestCase):
    def test_nyfed_uses_each_selected_clock_and_dst_with_original_event_ids(self):
        for month, expected_hour in ((10, 12), (11, 13)):
            events = C.parse_nyfed(nyfed_fixture(month=month), 2026, month, 'https://www.newyorkfed.org/research/calendars/')
            self.assertEqual(len(events), 3)
            self.assertEqual({event['id'].split('-')[0] for event in events}, {'nfp', 'cpi', 'ppi'})
            self.assertTrue(all(C.dt.datetime.fromtimestamp(event['release_utc'], C.UTC).hour == expected_hour for event in events))
            self.assertTrue(all(event['agency'] == 'BLS' for event in events))

    def test_nyfed_rejects_stale_ambiguous_or_incomplete_calendar(self):
        html = nyfed_fixture()
        for invalid in (
            html.replace('October 2026', 'September 2026'),
            html.replace('all Eastern Time', 'time unavailable'),
            html.replace('(08:30)', '(TBA)'),
            html.replace('Consumer Price Index', 'Unknown release'),
            html.replace('www.bls.gov', 'www.example.org'),
            html.replace('research-table-1col', 'new-layout'),
            html.replace('<div>02<br', '<div>03<br'),
            html.replace('<div>01<br', '<div>02<br'),
        ):
            with self.subTest(invalid=invalid[:60]):
                with self.assertRaises(ValueError): C.parse_nyfed(invalid, 2026, 10, 'test')

    def test_unavailable_official_source_does_not_become_an_empty_calendar(self):
        failure = C.urllib.error.HTTPError("https://www.bls.gov", 403, "Forbidden", None, None)
        with patch.object(C.urllib.request, "urlopen", side_effect=failure):
            with self.assertRaisesRegex(ValueError, r"www\.bls\.gov/schedule/2026/10_sched\.htm.*HTTP 403"):
                C.sync(1792431758)

    def test_us_dst_is_not_a_fixed_utc_offset(self):
        summer = C.release_epoch(2026, 10, 14, "08:30 AM")
        winter = C.release_epoch(2026, 11, 10, "08:30 AM")
        self.assertEqual(C.dt.datetime.fromtimestamp(summer, C.UTC).hour, 12)
        self.assertEqual(C.dt.datetime.fromtimestamp(winter, C.UTC).hour, 13)
        with self.assertRaises(ValueError): C.release_epoch(2026, 11, 1, "01:30 AM")
        with self.assertRaises(ValueError): C.release_epoch(2026, 3, 8, "02:30 AM")

    def test_bls_requires_all_supported_release_types_and_real_clock(self):
        html = ''.join(f'<td id="d10{day}"><p><strong>{name}<br></strong>September 2026<br>08:30 AM</p></td>'
                       for day, name in [("02", "Employment Situation"), ("14", "Consumer Price Index"), ("15", "Producer Price Index")])
        result = C.parse_bls(html, 2026, 10, "https://www.bls.gov/schedule/2026/10_sched.htm")
        self.assertEqual([event["id"] for event in result], ["nfp-20261002", "cpi-20261014", "ppi-20261015"])
        with self.assertRaises(ValueError): C.parse_bls(html.replace("08:30 AM", "TBA"), 2026, 10, "test")
        with self.assertRaises(ValueError): C.parse_bls("<table>layout changed</table>", 2026, 10, "test")

    def test_fed_release_day_is_explicit(self):
        html = '<div class="cal-nojs__rowTitle">FOMC Meetings</div><div class="row">' \
               '<div class="col-xs-2"><p>2:30 p.m.</p></div><div class="col-xs-7"><p>FOMC Press Conference</p></div>' \
               '<div class="col-xs-3"><p>28</p></div></div>'
        result = C.parse_fed(html, 2026, 10, "test")
        self.assertEqual(result[0]["id"], "fed-pc-20261028")
        self.assertEqual(C.dt.datetime.fromtimestamp(result[0]["release_utc"], C.UTC).hour, 18)
        with self.assertRaises(ValueError): C.parse_fed(html.replace("<p>28</p>", "<p>27-28</p>"), 2026, 10, "test")
        with self.assertRaises(ValueError): C.parse_fed(html.replace('col-xs-3', 'new-layout-date'), 2026, 10, "test")

    def test_bea_unknown_release_and_active_overlay_are_not_invented(self):
        html = '<table id="release-schedule-table"><tr><th>Year 2026</th></tr>' \
               '<tr><td class="scheduled-date"><div class="release-date">October 29</div><small>8:30 AM</small></td>' \
               '<td class="release-title">GDP (Advance Estimate), 3rd Quarter 2026</td></tr>' \
               '<tr><td class="scheduled-date">To Be Announced</td><td class="release-title">Personal Income and Outlays, November 2026</td></tr></table>'
        events, unknown, year = C.parse_bea(html, "test")
        self.assertEqual((len(events), len(unknown), year), (1, 1, 2026))
        cosmetic = '<script>const x=[{"target-date":"October 29","replacement-topText":"New Date","apply-to":["Upcoming Releases"]}];</script>'
        C.parse_bea(html + cosmetic, "test")
        overlay = '<script>const x=[{"target-date":"October 29","replacement-releaseText":"To Be Rescheduled","apply-to":["Upcoming Releases"]}];</script>'
        with self.assertRaises(ValueError): C.parse_bea(html + overlay, "test")
        C.parse_bea(html + overlay.replace('"Upcoming Releases"', '"2025 Schedule"'), "test")


if __name__ == "__main__":
    unittest.main()
