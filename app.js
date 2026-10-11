/* ============================================================
   Parent health app — prototype behaviour

   Everything lives client-side in localStorage. Two keys:
     pha.draft.v1   the Add-visit form in progress
     pha.visits.v1  visits the user has actually confirmed

   The three visits drawn in Figma stay in the HTML as static markup,
   so the screens still match the design with JavaScript disabled.
   When JS runs it merges those with the saved ones, sorts by date and
   re-renders — a new visit slots into the right place rather than
   being bolted on top.
   ============================================================ */
(function () {
  'use strict';

  /* The app's "today". The design says 28 Sep was "22 days ago" and
     4 Sep was "46 days ago" — both resolve to 20 Oct 2026, and the
     upcoming visit is 24 Oct, four days out. Anchoring here keeps
     every relative label agreeing with the drawn screens. */
  var TODAY = '2026-10-20';

  var K_DRAFT = 'pha.draft.v1';
  var K_VISITS = 'pha.visits.v1';
  /* Seed visits live in code, not storage, so "delete" can't just splice
     a list. It records the id here and allVisits() filters it out. */
  var K_DELETED = 'pha.deleted.v1';
  /* The visit-in-progress demo: which stage the 24 OCT visit has reached
     and whether something has gone wrong. Shared so Home's card chip can
     follow the same state the visit page shows. */
  /* v2: the visit now opens in progress by default. A new key so a
     "not started" saved under v1 doesn't hide the status screen. */
  var K_LIVE = 'pha.live.v2';
  var LIVE_ID = 'seed-1';

  /* Chip copy, one per stage (index 0 = not started). Short enough for
     the 20px status chip on Home. */
  var LIVE_CHIP = ['', 'Pickup tomorrow', 'Helper on the way', 'Picked up',
                   'At hospital', 'With doctor', 'After doctor', 'Maa is home',
                   'Summary ready'];
  /* What the prototype shows before anyone touches the Demo controls:
     mid-visit, so tapping Home's card lands on the status screen. */
  var LIVE_DEFAULT = { stage: 5, issue: 'none' };
  var ISSUES = ['none', 'helper-late', 'doctor-absent', 'not-ready', 'emergency'];
  var ISSUE_CHIP = { 'helper-late': 'Helper late', 'doctor-absent': 'Doctor absent',
                     'not-ready': 'Maa not ready', 'emergency': 'Emergency' };

  function cleanLive(s) {
    s = s || {};
    var stage = Math.max(0, Math.min(LIVE_CHIP.length - 1, parseInt(s.stage, 10) || 0));
    var issue = ISSUES.indexOf(s.issue) === -1 ? 'none' : s.issue;
    return { stage: stage, issue: stage ? issue : 'none', approved: !!(stage && s.approved) };
  }

  /* ---- storage, defensively ------------------------------------
     localStorage throws in private mode and can be disabled outright,
     so every read and write is guarded. The prototype degrades to
     in-memory state rather than breaking. */
  var memory = {};
  function read(key) {
    try {
      var v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return memory[key] || null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { memory[key] = value; }
  }
  function drop(key) {
    try { window.localStorage.removeItem(key); } catch (e) { delete memory[key]; }
  }

  /* ---- dates --------------------------------------------------- */
  var MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var MONTH_LONG = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
  var DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseYmd(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);   // local, no UTC drift
  }
  function dayDiff(a, b) {
    return Math.round((parseYmd(a) - parseYmd(b)) / 86400000);
  }
  function dateLabel(s) {                        // "24 OCT"
    var d = parseYmd(s);
    return d.getDate() + ' ' + MON[d.getMonth()];
  }
  function longLabel(s) {                        // "Sat 24 Oct"
    var d = parseYmd(s);
    return DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' +
           MONTH_LONG[d.getMonth()].slice(0, 3);
  }

  /* Minutes since midnight <-> "11:00 am" */
  function toMinutes(t) {
    var m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(t).trim());
    if (!m) return null;
    var h = +m[1] % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + (+m[2]);
  }
  function fromMinutes(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60), mm = mins % 60;
    var ap = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(mm).padStart(2, '0') + ' ' + ap;
  }
  /* Pickup is the appointment minus the drive. 11:00 am - 45 = 10:15 am,
     which is the number the brief asks for. */
  var TRAVEL_MIN = 45;
  function pickupFor(time) {
    var m = toMinutes(time);
    return m === null ? '' : fromMinutes(m - TRAVEL_MIN);
  }

  /* ---- the doctor's availability ------------------------------
     Dr Deshmukh sits Tue / Thu / Sat, and nothing can be booked in
     the past. Same rule drives the calendar dots and the slot list. */
  var CLINIC_DAYS = [2, 4, 6];
  var SLOTS = ['9:00 am', '10:30 am', '11:00 am', '12:15 pm', '4:00 pm'];
  function isBookable(dateStr) {
    var d = parseYmd(dateStr);
    return CLINIC_DAYS.indexOf(d.getDay()) !== -1 && dayDiff(dateStr, TODAY) > 0;
  }

  /* ---- defaults ------------------------------------------------ */
  function blankDraft() {
    return {
      hospital: 'Hedgewar Hospital',
      hospitalArea: 'Garkheda',
      doctor: 'Dr Ranjana Deshmukh',
      doctorSeen: 'Seen on 28 Sep and 4 Sep',
      date: '',
      time: '',
      reason: 'Follow-up',
      note: 'Monthly follow-up',
      helperNeeded: true,
      helperType: 'Escort to hospital',
      helperPref: 'Same as last time',
      helperName: 'Suresh Patil',
      gender: 'Female',
      address: '12 Shivaji Nagar, Garkheda',
      pickup: '',
      questions: [{ text: 'BP rising in the last 2 weeks, is 80 mg enough?', by: 'you' }],
      tests: ['HbA1c', 'Kidney function'],
      buyMeds: true,
      recording: 'Ask doctor for consent',
      notified: ['Hanu', 'Abhishek']
    };
  }

  /* The three visits drawn in Figma. Kept in sync with the static
     markup in visits.html so the screen is identical either way. */
  var SEED = [
    { id: 'seed-1', date: '2026-10-24', time: '11:00 am', hospital: 'Hedgewar hospital',
      doctor: 'Dr Ranjana Deshmukh', reason: 'Monthly follow up appointment',
      helperNeeded: true, status: 'upcoming', seed: true,
      /* Everything below is already stated somewhere in the designs: the
         helper and tests on the 28 Sep follow-up card (4:341), the rest
         on the Add-visit form. */
      helperName: 'Sunita', helperType: 'Escort to hospital', gender: 'Female',
      pickup: '8:30 am', address: '12 Shivaji Nagar, Garkheda',
      /* Helper, pickup and questions match the visit-in-progress flow on
         upcoming-visit.html, so the booking and the live view agree. */
      questions: [{ text: 'Ask about knee pain', by: 'You' },
                  { text: 'Is the BP tablet dose still right?', by: 'You' }],
      tests: ['HbA1c', 'Kidney function'],
      buyMeds: true, notified: ['Hanu', 'Abhishek'] },
    { id: 'seed-2', date: '2026-09-28', time: '', hospital: 'Hedgewar hospital',
      doctor: 'Dr Ranjana Deshmukh', reason: 'Monthly follow up appointment',
      status: 'done', seed: true, href: 'visit-detail.html' },
    { id: 'seed-3', date: '2026-09-04', time: '', hospital: 'Hedgewar hospital',
      doctor: 'Dr Nikhil Kulkarni', reason: 'Cold and fever viral infection',
      status: 'done', seed: true }
  ];

  function allVisits() {
    var saved = read(K_VISITS) || [];
    var gone = read(K_DELETED) || [];
    var all = SEED.concat(saved).filter(function (v) {
      return gone.indexOf(v.id) === -1;
    });
    // upcoming first (soonest first), then past (most recent first)
    var up = all.filter(function (v) { return v.status !== 'done'; })
                .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var past = all.filter(function (v) { return v.status === 'done'; })
                  .sort(function (a, b) { return a.date > b.date ? -1 : 1; });
    return up.concat(past);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.PHA = {
    TODAY: TODAY, SLOTS: SLOTS, MONTH_LONG: MONTH_LONG, DAY_SHORT: DAY_SHORT,
    ymd: ymd, parseYmd: parseYmd, dayDiff: dayDiff, dateLabel: dateLabel,
    longLabel: longLabel, pickupFor: pickupFor, isBookable: isBookable,
    toMinutes: toMinutes, fromMinutes: fromMinutes, esc: esc,
    blankDraft: blankDraft, allVisits: allVisits,
    getDraft: function () {
      var d = read(K_DRAFT);
      if (!d) return blankDraft();
      var base = blankDraft();
      Object.keys(d).forEach(function (k) { base[k] = d[k]; });
      return base;
    },
    setDraft: function (d) { write(K_DRAFT, d); },
    clearDraft: function () { drop(K_DRAFT); },
    addVisit: function (v) {
      var list = read(K_VISITS) || [];
      list.push(v);
      write(K_VISITS, list);
      return v;
    },
    savedCount: function () { return (read(K_VISITS) || []).length; },
    getVisit: function (id) {
      var hit = allVisits().filter(function (v) { return v.id === id; });
      return hit.length ? hit[0] : null;
    },
    /* Works for both kinds: a saved visit is spliced out, a seeded one is
       remembered as deleted. Either way allVisits() stops returning it. */
    removeVisit: function (id) {
      var saved = read(K_VISITS) || [];
      var kept = saved.filter(function (v) { return v.id !== id; });
      if (kept.length !== saved.length) { write(K_VISITS, kept); return true; }
      var gone = read(K_DELETED) || [];
      if (gone.indexOf(id) === -1) { gone.push(id); write(K_DELETED, gone); }
      return true;
    },
    LIVE_ID: LIVE_ID, LIVE_CHIP: LIVE_CHIP, ISSUES: ISSUES, ISSUE_CHIP: ISSUE_CHIP,
    cleanLive: cleanLive,
    getLive: function () { return cleanLive(read(K_LIVE) || LIVE_DEFAULT); },
    setLive: function (s) { s = cleanLive(s); write(K_LIVE, s); return s; },
    resetAll: function () { drop(K_VISITS); drop(K_DRAFT); drop(K_DELETED); drop(K_LIVE); }
  };
})();
