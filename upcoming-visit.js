/* ============================================================
   Upcoming visit detail.

   Reads ?id= from the URL so any upcoming card opens its own view —
   the one drawn in Figma (seed-1, 24 OCT) and anything booked through
   the Add-visit form alike. Every block hides itself when the visit
   carries no data for it, so a visit booked without a helper, or with
   no questions, doesn't leave an empty heading behind.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;
  var $ = function (s) { return document.querySelector(s); };

  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                  'Thursday', 'Friday', 'Saturday'];

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* "In 4 days" reads better than "4 days away" on a card that already
     says the date, and matches the tense of "22 days ago" opposite. */
  function awayLabel(date) {
    var n = P.dayDiff(date, P.TODAY);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n < 0) return Math.abs(n) + ' days ago';
    return 'In ' + n + ' days';
  }

  function longDate(date) {
    var d = P.parseYmd(date);
    return DAY_LONG[d.getDay()] + ', ' + d.getDate() + ' ' + P.MONTH_LONG[d.getMonth()];
  }

  function set(sel, text) {
    var el = $(sel);
    if (el) el.textContent = text;
  }
  function hide(sel) {
    var el = $(sel);
    if (el) el.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var id = param('id');
    var v = id ? P.getVisit(id) : null;

    // No id, or an id that no longer exists (deleted in another tab):
    // fall back to the soonest upcoming visit rather than a blank screen.
    if (!v) {
      var up = P.allVisits().filter(function (x) { return x.status !== 'done'; });
      v = up.length ? up[0] : null;
    }
    if (!v) { window.location.replace('visits.html'); return; }

    /* ---- Header ---------------------------------------------- */
    set('#ago', awayLabel(v.date));
    set('#date', P.dateLabel(v.date));
    set('#hospital', v.hospital);
    set('#doctor', v.doctor);
    set('#reason', v.reason);
    if (!v.helperNeeded) hide('#helperChip');

    /* ---- When ------------------------------------------------- */
    set('#whenLong', longDate(v.date));
    if (v.time) {
      set('#whenSub', v.time + ' at the clinic');
    } else {
      hide('#whenSub');
    }

    /* ---- Helper ----------------------------------------------- */
    if (v.helperNeeded && v.helperName) {
      set('#helperName', v.helperName);
      set('#helperRole', v.helperType || 'Escort to hospital');
      set('#pickup', v.pickup || P.pickupFor(v.time) || '—');
      set('#address', v.address || '—');
    } else {
      hide('#helperBlock');
    }

    /* ---- Questions -------------------------------------------- */
    var qs = v.questions || [];
    if (qs.length) {
      $('#questions').innerHTML = qs.map(function (q) {
        return '<li>&ldquo;' + P.esc(q.text) + '&rdquo;</li>';
      }).join('');
    } else {
      hide('#questionsBlock');
    }

    /* ---- Tests ------------------------------------------------- */
    var tests = v.tests || [];
    if (tests.length) {
      $('#tests').innerHTML = tests.map(function (t) {
        return '<li>' + P.esc(t) + '</li>';
      }).join('');
    } else {
      hide('#testsBlock');
    }

    /* ---- After the visit --------------------------------------- */
    if (v.buyMeds) {
      set('#afterText', 'Medicines will be bought on the way back.');
    } else {
      hide('#afterBlock');
    }

    /* ---- Care circle ------------------------------------------- */
    if (v.notified && v.notified.length) set('#notified', v.notified.join(', '));

    /* ---- Delete ------------------------------------------------ */
    var sheet = $('#deleteSheet');

    $('#sheetBody').textContent =
      'The ' + P.dateLabel(v.date) + ' appointment will be removed.' +
      (v.helperNeeded && v.helperName
        ? ' ' + v.helperName + ' and the Care Circle will be told it is cancelled.'
        : ' The Care Circle will be told it is cancelled.');

    function close() { sheet.hidden = true; }

    $('#deleteVisit').addEventListener('click', function () { sheet.hidden = false; });
    Array.prototype.forEach.call(sheet.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) close();
    });

    $('#confirmDelete').addEventListener('click', function () {
      if (v.id === P.LIVE_ID) P.setLive({ stage: 0 });
      P.removeVisit(v.id);
      window.location.href = 'visits.html?deleted=1';
    });

    /* ---- Visit in progress (24 OCT only) ----------------------- */
    if (v.id === P.LIVE_ID && window.PHALive) window.PHALive.init(v);
  });
})();

/* ============================================================
   Visit in progress — seed-1 (24 OCT) only.

   From the day before until the summary lands, this page shows the
   visit as it happens instead of the booking. The stage and any
   exception come from ?stage= and ?issue= when present (so any moment
   can be opened directly), otherwise from PHA.getLive(), which Home
   reads too. stage 0 means "not started": the normal upcoming view.

   Privacy rule: Maa's location is never shown. The only map is the
   helper's route to her door, and it disappears at pickup.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;
  var $ = function (s) { return document.querySelector(s); };

  var ICON = {
    tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" /></svg>',
    bell: '<svg class="lv-bell" viewBox="0 0 256 256" aria-label="Sends a notification" role="img"><path d="M168,224a8,8,0,0,1-8,8H96a8,8,0,1,1,0-16h64A8,8,0,0,1,168,224Zm53.85-48.11C216.31,166.34,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H208a16,16,0,0,0,13.85-24.11Z" /></svg>',
    sparkle: '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" /></svg>',
    phone: '<svg viewBox="0 0 256 256" aria-hidden="true"><use href="#lvPhone" /></svg>'
  };

  /* One entry per stage, 1-based to match ?stage=. `text` and `sub` are
     the exact timeline copy; `head` is the short version for the big
     status line. `bell` marks the three that send a push. */
  var STAGES = [
    null,
    { name: 'Day before', head: 'Pickup tomorrow at 8:30', time: '6:10 pm', doneTime: 'Yesterday',
      text: 'Sunita will pick Maa up at 8:30 tomorrow', sub: 'Maa said OK' },
    { name: 'On the way', head: 'Sunita is 10 min away', time: '8:24 am',
      text: 'Sunita is 10 min away', map: true, eta: 'ETA 8:34 · 2.1 km',
      late: { head: 'Rekha arrives at 8:50', text: 'Rekha is on the way · arriving 8:50',
              time: '8:30 am', eta: 'ETA 8:50 · 3.4 km' } },
    { name: 'Picked up', head: 'Maa left home with Sunita', time: '8:34 am', bell: true,
      text: 'Maa left home with Sunita · 8:34', sub: 'Confirmed with pickup code',
      late: { head: 'Maa left home with Rekha', text: 'Maa left home with Rekha · 8:54', time: '8:54 am' } },
    { name: 'At hospital', head: 'At Hedgewar hospital', time: '9:12 am',
      text: 'At Hedgewar hospital · Token 23 · about 14 ahead' },
    { name: 'With doctor', head: 'With Dr Deshmukh', time: '10:05 am',
      text: 'With Dr Deshmukh · recording with consent' },
    { name: 'After doctor', head: 'Done with the doctor', time: '10:58 am',
      text: 'Blood test done · medicines ₹640 · report ready Thursday' },
    { name: 'Home', head: 'Maa is home', time: '11:52 am', bell: true,
      text: 'Maa is home · 11:52', sub: 'Confirmed by Maa' },
    { name: 'Summary ready', head: 'Visit summary is ready', time: '12:20 pm', bell: true,
      summary: true }
  ];
  var LAST = STAGES.length - 1;
  var ASKED_AT = 6;                       // both questions tick here

  var QUESTIONS = ['Ask about knee pain', 'Is the BP tablet dose still right?'];

  /* Each line appears at the stage it was paid in. */
  var SPEND = [
    { at: 4, label: 'Auto to hospital', amount: 120, time: '9:12 am', how: 'UPI' },
    { at: 4, label: 'OPD card', amount: 50, time: '9:15 am', how: 'Cash' },
    { at: 6, label: 'Blood test', amount: 450, time: '10:40 am', how: 'UPI' },
    { at: 6, label: 'Medicines', amount: 640, time: '10:58 am', how: 'UPI' },
    { at: 7, label: 'Auto back home', amount: 120, time: '11:50 am', how: 'UPI' }
  ];

  var SUMMARY = ['BP tablet raised to 80 mg after breakfast', 'Knee X-ray advised', 'Next visit in 4 weeks'];

  /* Exceptions. Every one gets a bell: each would push to Hanu's phone. */
  var ISSUES = {
    'helper-late': {
      title: 'Sunita is running late',
      text: 'Backup helper Rekha assigned · arriving 8:50',
      actions: [['Call Rekha', 'call:Rekha', 1], ['Call Sunita', 'call:Sunita']]
    },
    'doctor-absent': {
      title: 'Dr Deshmukh is not in today',
      actions: [['Choose another doctor here', 'toast:Asking the OPD desk who else is seeing patients today…', 1],
                ['Pick a new date', 'go:add-visit.html']]
    },
    'not-ready': {
      title: 'Maa isn’t ready to go',
      note: 'Says she feels fine, wants to go next week',
      actions: [['Call Maa', 'call:Maa', 1], ['Reschedule', 'go:add-visit.html'], ['Cancel visit', 'cancel']]
    },
    'emergency': {
      title: 'Taking Maa to casualty',
      severe: true,
      actions: [['Call Sunita', 'call:Sunita', 1], ['Call Maa', 'call:Maa']],
      foot: 'Live updates shared with everyone in the Care Circle'
    }
  };

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function rupees(n) { return '₹' + n.toLocaleString('en-IN'); }

  var state, v, firstPaint = true, lastStage = null, lastIssue = null, toastTimer;

  /* While Sunita is late, Rekha does the run from the door onwards, so
     the two stages that name the helper carry their own copy and times. */
  function helper() { return state.issue === 'helper-late' ? 'Rekha' : 'Sunita'; }
  function stage(i) {
    var s = STAGES[i];
    if (state.issue !== 'helper-late' || !s.late) return s;
    var out = {};
    Object.keys(s).forEach(function (k) { out[k] = s[k]; });
    Object.keys(s.late).forEach(function (k) { out[k] = s.late[k]; });
    return out;
  }

  /* ---- Timeline, built once; render() only moves classes ------- */
  function mapCard() {
    return '' +
      '<div class="lv-map">' +
        '<div class="lv-map__frame">' +
          '<svg viewBox="0 0 280 128" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
            '<rect x="0" y="0" width="280" height="128" fill="#eef1f6" />' +
            '<rect x="12" y="10" width="70" height="40" rx="4" fill="#e3e7f0" />' +
            '<rect x="152" y="76" width="64" height="40" rx="4" fill="#e3e7f0" />' +
            '<rect x="226" y="72" width="48" height="50" rx="4" fill="#dcefe1" />' +
            '<rect x="94" y="8" width="44" height="44" rx="4" fill="#e3e7f0" />' +
            '<path d="M0 100 H280 M140 0 V128 M0 64 H280 M236 0 V128 M60 64 V128" stroke="#ffffff" stroke-width="8" fill="none" />' +
            '<path d="M60 100 H140 V64 H236 V40" stroke="#4d76ff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />' +
            '<circle class="lv-map__pulse" cx="60" cy="100" r="7" fill="#4d76ff" />' +
            '<circle cx="60" cy="100" r="6" fill="#4d76ff" stroke="#ffffff" stroke-width="2.5" />' +
            '<circle cx="236" cy="34" r="9" fill="#1a1a1a" />' +
            '<path d="M231.5 35.5 L236 31 L240.5 35.5 V39 H231.5 Z" fill="#ffffff" />' +
          '</svg>' +
          '<span class="lv-map__eta" id="lvEta"></span>' +
        '</div>' +
        '<p class="lv-map__cap" id="lvMapCap">Sunita’s location, shared only until she picks Maa up.</p>' +
      '</div>';
  }

  function summaryCard() {
    return '' +
      '<div class="lv-sum">' +
        '<p class="lv-sum__label">' + ICON.sparkle + 'AI summary</p>' +
        '<ul class="lv-sum__list">' + SUMMARY.map(function (s) { return '<li>' + P.esc(s) + '</li>'; }).join('') + '</ul>' +
        '<button class="lv-sum__link" type="button" id="lvRx">View prescription</button>' +
        '<div class="lv-follow" id="lvFollow"></div>' +
      '</div>';
  }

  function buildSteps() {
    var html = '';
    for (var i = 1; i <= LAST; i++) {
      var s = STAGES[i];
      html += '<li class="lv-step" data-i="' + i + '">' +
        '<div class="lv-step__rail"><span class="lv-dot"><svg class="lv-dot__tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" /></svg></span></div>' +
        '<div class="lv-step__main">' +
          '<div class="lv-step__top">' +
            '<p class="lv-step__name">' + s.name + '</p>' + (s.bell ? ICON.bell : '') +
            '<p class="lv-step__time"></p>' +
          '</div>' +
          '<div class="lv-step__body">' +
            (s.text ? '<p class="lv-step__text"></p>' : '') +
            (s.sub ? '<p class="lv-step__sub">' + ICON.tick + P.esc(s.sub) + '</p>' : '') +
            (s.map ? mapCard() : '') +
            (s.summary ? summaryCard() : '') +
          '</div>' +
        '</div>' +
      '</li>';
    }
    $('#lvSteps').innerHTML = html;
  }

  /* ---- Pieces -------------------------------------------------- */
  function renderBanner(prevIssue) {
    var el = $('#lvBanner');
    var is = ISSUES[state.issue];
    if (!is) { el.hidden = true; el.innerHTML = ''; return; }
    el.className = 'lv-banner' + (is.severe ? ' lv-banner--severe' : '') +
                   (prevIssue !== null && prevIssue !== state.issue ? ' just-in' : '');
    el.innerHTML =
      '<div class="lv-banner__top">' + ICON.bell +
        '<div><p class="lv-banner__title">' + P.esc(is.title) + '</p>' +
        (is.text ? '<p class="lv-banner__text">' + P.esc(is.text) + '</p>' : '') + '</div>' +
      '</div>' +
      (is.note ? '<p class="lv-banner__note"><b>Note from Sunita</b>“' + P.esc(is.note) + '”</p>' : '') +
      '<div class="lv-banner__actions">' + is.actions.map(function (a) {
        return '<button class="lv-btn lv-btn--sm' + (a[2] ? ' lv-btn--primary' : '') + '" type="button" data-act="' + P.esc(a[1]) + '">' +
               (a[1].indexOf('call:') === 0 ? ICON.phone : '') + '<span>' + P.esc(a[0]) + '</span></button>';
      }).join('') + '</div>' +
      (is.foot ? '<p class="lv-banner__foot">' + P.esc(is.foot) + '</p>' : '');
    el.hidden = false;
  }

  function renderStatus() {
    var s = stage(state.stage);
    $('#lvEyebrow').textContent = (state.stage === 1 ? 'Tomorrow' : 'Today') + ' · ' + v.hospital;
    var line = $('#lvLine'), text = s.head;
    if (line.textContent !== text) {
      line.textContent = text;
      line.classList.remove('is-changed');
      if (!firstPaint) {
        void line.offsetWidth;                  // restart the fade
        line.classList.add('is-changed');
      }
    }
    $('#lvUpdated').textContent = 'Updated ' + s.time;
    var st = $('.lv-status');
    st.classList.toggle('is-ongoing', state.stage >= 2 && state.stage <= 6);
    st.classList.toggle('is-settled', state.stage >= 7);
  }

  function renderHelper() {
    var late = state.issue === 'helper-late';
    $('#lvHelperName').textContent = helper();
    var tag = $('#lvHelperTag');
    tag.textContent = late ? 'Backup' : 'Favourite';
    tag.classList.toggle('lv-tag--backup', late);
    $('#lvCallHelper').setAttribute('data-call', helper());
    $('#lvCallHelperLabel').textContent = 'Call ' + helper();
  }

  function renderSteps(prev) {
    Array.prototype.forEach.call(document.querySelectorAll('.lv-step'), function (li) {
      var i = +li.getAttribute('data-i'), s = stage(i);
      var moved = prev !== null && prev !== state.stage;
      li.classList.toggle('just-done', moved && i < state.stage && i >= prev);
      li.classList.toggle('just-current', moved && i === state.stage);
      li.classList.toggle('is-done', i < state.stage);
      li.classList.toggle('is-current', i === state.stage);
      li.classList.toggle('is-future', i > state.stage);
      if (i === state.stage) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.querySelector('.lv-step__time').textContent = (i < state.stage && s.doneTime) ? s.doneTime : s.time;
      var t = li.querySelector('.lv-step__text');
      if (t) t.textContent = s.text;
    });
    $('#lvEta').textContent = stage(2).eta;
    var cap = $('#lvMapCap');
    if (cap) cap.textContent = helper() + '’s location, shared only until she picks Maa up.';

    var follow = $('#lvFollow');
    follow.innerHTML = state.approved
      ? '<p class="lv-follow__done">' + ICON.tick + 'Follow-up on 21 Nov approved</p>'
      : '<p class="lv-follow__q">Approve follow-up on 21 Nov?</p>' +
        '<div class="lv-follow__actions">' +
          '<button class="lv-btn lv-btn--sm lv-btn--primary" type="button" data-act="approve">Approve</button>' +
          '<a class="lv-btn lv-btn--sm" href="add-visit.html">Change</a>' +
        '</div>';
  }

  function renderQuestions(prev) {
    var asked = state.stage >= ASKED_AT;
    var justAsked = asked && prev !== null && prev < ASKED_AT;
    $('#lvQuestions').innerHTML = QUESTIONS.map(function (q) {
      return '<li class="lv-q' + (asked ? ' is-asked' : '') + (justAsked ? ' just-asked' : '') + '">' +
        '<span class="lv-q__box">' + ICON.tick + '</span>' +
        '<div><p class="lv-q__text">' + P.esc(q) + '</p>' +
        (asked ? '<p class="lv-q__when">Asked · ' + STAGES[ASKED_AT].time + '</p>' : '') + '</div>' +
      '</li>';
    }).join('');
    $('#lvQNote').textContent = asked
      ? 'Both asked. Answers are in the summary.'
      : helper() + ' ticks each one when she asks it.';
  }

  function renderSpend(prev) {
    var items = SPEND.filter(function (x) { return x.at <= state.stage; });
    var total = items.reduce(function (n, x) { return n + x.amount; }, 0);
    $('#lvTotal').textContent = rupees(total);
    $('#lvSpendBy').textContent = items.length
      ? 'Paid by ' + helper() + ' · tap a line for the receipt'
      : 'Nothing spent yet';
    $('#lvSpend').innerHTML = items.map(function (x) {
      var fresh = prev !== null && x.at > prev;
      return '<li><button class="lv-spend__row' + (fresh ? ' is-new' : '') + '" type="button" data-receipt="' + SPEND.indexOf(x) + '">' +
        '<span class="lv-spend__label">' + P.esc(x.label) + ' <span class="lv-spend__time">' + x.time + '</span></span>' +
        '<span class="lv-spend__amt">' + rupees(x.amount) + '</span>' +
        '<img src="assets/set-chevron.svg" alt="" />' +
      '</button></li>';
    }).join('');
  }

  /* ---- Whole page ---------------------------------------------- */
  function render(opts) {
    opts = opts || {};
    var screen = $('.screen'), live = $('#live'), prev = lastStage;
    var on = state.stage > 0;

    screen.classList.toggle('is-live', on);
    live.hidden = !on;

    if (on) {
      if (firstPaint) live.classList.add('no-anim');
      var p = firstPaint ? null : prev;
      renderBanner(firstPaint ? null : lastIssue);
      renderStatus();
      renderHelper();
      renderSteps(p);
      renderQuestions(p);
      renderSpend(p);
      if (firstPaint) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { live.classList.remove('no-anim'); }); });
      }
      firstPaint = false;
    } else {
      firstPaint = true;                       // next entry paints still
    }
    lastStage = state.stage;
    lastIssue = state.issue;

    state = P.setLive(state);
    var q = '?id=' + encodeURIComponent(v.id) + '&stage=' + state.stage + '&issue=' + state.issue;
    if (window.location.search !== q) history.replaceState(null, '', q);
    renderDemo();

    var scroller = $('.screen__scroll');
    if (opts.toTop || !on) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (opts.follow) {
      var cur = $('.lv-step.is-current');
      if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ---- Sheets & toast ----------------------------------------- */
  function toast(msg) {
    var t = $('#lvToast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function openDoc(eyebrow, title, rows, photo) {
    $('#docEyebrow').textContent = eyebrow;
    $('#docTitle').textContent = title;
    $('#docRows').innerHTML = rows.map(function (r) {
      return '<dt>' + P.esc(r[0]) + '</dt><dd>' + P.esc(r[1]) + '</dd>';
    }).join('');
    $('#docPhotoLabel').textContent = photo;
    $('#docSheet').hidden = false;
  }

  function act(a) {
    if (!a) return;
    if (a.indexOf('call:') === 0) { toast('Calling ' + a.slice(5) + '…'); return; }
    if (a.indexOf('toast:') === 0) { toast(a.slice(6)); return; }
    if (a.indexOf('go:') === 0) { window.location.href = a.slice(3); return; }
    if (a === 'cancel') { $('#deleteSheet').hidden = false; return; }
    if (a === 'approve') { state.approved = true; render(); toast('Follow-up on 21 Nov sent to the hospital'); }
  }

  /* ---- Demo panel ---------------------------------------------- */
  function renderDemo() {
    $('#demoStage').textContent = state.stage
      ? 'Stage ' + state.stage + ' of ' + LAST + ' · ' + STAGES[state.stage].name
      : 'Not started · upcoming view';
    $('#demoPrev').disabled = state.stage === 0;
    $('#demoNext').disabled = state.stage === LAST;
    $('#demoIssue').value = state.issue;
  }

  /* The stages each exception can actually happen in, and where to jump
     when it is picked outside them: a late helper or Maa not ready
     happen before pickup, an absent doctor once she is at the hospital,
     an emergency any time she is out of the house. */
  var ISSUE_STAGES = { 'helper-late': [1, 2, 2], 'not-ready': [1, 2, 2],
                       'doctor-absent': [4, 4, 4], 'emergency': [3, 6, 5] };

  function go(stage) {
    state.stage = Math.max(0, Math.min(LAST, stage));
    if (!state.stage) state.issue = 'none';
    render({ follow: true });
  }

  function initDemo() {
    var demo = $('#demo'), pill = $('#demoPill'), panel = $('#demoPanel');
    demo.hidden = false;
    pill.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      pill.setAttribute('aria-expanded', String(open));
    });
    $('#demoNext').addEventListener('click', function () { go(state.stage + 1); });
    $('#demoPrev').addEventListener('click', function () { go(state.stage - 1); });
    $('#demoIssue').addEventListener('change', function (e) {
      state.issue = e.target.value;
      var range = ISSUE_STAGES[state.issue];
      if (range && (state.stage < range[0] || state.stage > range[1])) state.stage = range[2];
      render({ toTop: true });
    });
    $('#demoReset').addEventListener('click', function () {
      state = { stage: 0, issue: 'none', approved: false };
      render();
    });
    // Arrow keys step through stages while presenting.
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'select' || tag === 'input' || tag === 'textarea') return;
      if (!$('#deleteSheet').hidden || !$('#docSheet').hidden) return;
      if (e.key === 'ArrowRight') go(state.stage + 1);
      if (e.key === 'ArrowLeft') go(state.stage - 1);
    });
  }

  /* ---- Entry ---------------------------------------------------- */
  window.PHALive = {
    init: function (visit) {
      v = visit;
      var fromUrl = param('stage') !== null || param('issue') !== null;
      state = fromUrl
        ? P.cleanLive({ stage: param('stage'), issue: param('issue') || 'none', approved: P.getLive().approved })
        : P.getLive();

      $('#lvReason').textContent = v.reason;
      buildSteps();
      initDemo();

      document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (b) { act(b.getAttribute('data-act')); return; }
        var c = e.target.closest('[data-call]');
        if (c) { act('call:' + c.getAttribute('data-call')); return; }
        var r = e.target.closest('[data-receipt]');
        if (r) {
          var x = SPEND[+r.getAttribute('data-receipt')];
          openDoc('Receipt', x.label, [['Amount', rupees(x.amount)], ['Paid', x.time + ', 24 Oct'],
                  ['Paid by', helper() + ' · ' + x.how]], 'Photo of the bill, uploaded by ' + helper());
          return;
        }
        if (e.target.closest('#lvRx')) {
          openDoc('Prescription', 'Dr Ranjana Deshmukh', [['Visit', '24 Oct · ' + v.hospital],
                  ['Changes', 'BP tablet raised to 80 mg'], ['Tests', 'Knee X-ray']],
                  'Photo of the prescription, uploaded by ' + helper());
          return;
        }
        if (e.target.closest('[data-close-doc]')) $('#docSheet').hidden = true;
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') $('#docSheet').hidden = true;
      });

      render();
    }
  };
})();
