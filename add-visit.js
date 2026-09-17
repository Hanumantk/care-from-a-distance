/* ============================================================
   Add-visit form controller
   Every control writes straight into the draft, and the draft is
   saved on each change — leave the screen, come back, it's all there.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;
  var d = P.getDraft();

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function save() { P.setDraft(d); validate(); }

  /* ---- generic pickers ----------------------------------------- */
  // One-of-many within a container
  function single(container, key, read) {
    $$('[data-val]', container).forEach(function (el) {
      el.addEventListener('click', function () {
        $$('[data-val]', container).forEach(function (o) {
          o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false');
        });
        el.classList.add('is-on'); el.setAttribute('aria-pressed', 'true');
        d[key] = read ? read(el) : el.getAttribute('data-val');
        save();
        if (key === 'time') { d.pickup = P.pickupFor(d.time); renderPickup(); save(); }
      });
    });
  }

  /* ---- hospital + doctor --------------------------------------- */
  var DOCTORS = {
    'Hedgewar Hospital': [
      { name: 'Dr Ranjana Deshmukh', sub: 'Seen on 28 Sep and 4 Sep' },
      { name: 'Dr Nikhil Kulkarni', sub: 'Seen on 4 Sep' }
    ],
    'Sai Clinic': [
      { name: 'Dr Meera Joshi', sub: 'Seen on 12 Jul' }
    ]
  };

  function renderHospitals(filter) {
    var list = $('#hospitalList');
    var rows = [
      { name: 'Hedgewar Hospital', sub: 'Garkheda · 3 past visits' },
      { name: 'Sai Clinic', sub: 'Jalna Road · 1 past visit' }
    ].filter(function (h) {
      return !filter || h.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    });

    if (!rows.length) {
      list.innerHTML = '<p class="av-empty">No match. Try another name.</p>';
      return;
    }
    list.innerHTML = rows.map(function (h, i) {
      var on = h.name === d.hospital;
      return (i ? '<div class="av-divider"></div>' : '') +
        '<button class="av-pick' + (on ? ' is-on' : '') + '" type="button" data-val="' + P.esc(h.name) + '">' +
          '<div class="av-pick__body">' +
            '<p class="av-pick__name">' + P.esc(h.name) + '</p>' +
            '<p class="av-pick__sub">' + P.esc(h.sub) + '</p>' +
          '</div>' + (on ? '<span class="av-tick" aria-hidden="true"></span>' : '') +
        '</button>';
    }).join('');

    $$('[data-val]', list).forEach(function (el) {
      el.addEventListener('click', function () {
        d.hospital = el.getAttribute('data-val');
        var docs = DOCTORS[d.hospital] || [];
        if (docs.length) { d.doctor = docs[0].name; d.doctorSeen = docs[0].sub; }
        renderHospitals($('#hospitalSearch').value.trim());
        renderDoctors();
        save();
      });
    });
  }

  function renderDoctors() {
    var list = $('#doctorList');
    var docs = DOCTORS[d.hospital] || [];
    list.innerHTML = docs.map(function (doc, i) {
      var on = doc.name === d.doctor;
      return (i ? '<div class="av-divider"></div>' : '') +
        '<button class="av-pick' + (on ? ' is-on' : '') + '" type="button" data-val="' + P.esc(doc.name) + '">' +
          '<img class="av-pick__avatar" src="' + (on ? 'assets/set-avatar-blue.svg' : 'assets/set-avatar.svg') + '" alt="" />' +
          '<div class="av-pick__body">' +
            '<p class="av-pick__name">' + P.esc(doc.name) + '</p>' +
            '<p class="av-pick__sub">' + P.esc(doc.sub) + '</p>' +
          '</div>' + (on ? '<span class="av-tick" aria-hidden="true"></span>' : '') +
        '</button>';
    }).join('');

    $$('[data-val]', list).forEach(function (el) {
      el.addEventListener('click', function () {
        var name = el.getAttribute('data-val');
        var doc = (DOCTORS[d.hospital] || []).filter(function (x) { return x.name === name; })[0];
        d.doctor = name; d.doctorSeen = doc ? doc.sub : '';
        renderDoctors(); save();
      });
    });
  }

  /* ---- calendar ------------------------------------------------- */
  var view = (function () {
    var base = d.date ? P.parseYmd(d.date) : P.parseYmd(P.TODAY);
    return { y: base.getFullYear(), m: base.getMonth() };
  })();

  function renderCalendar() {
    var first = new Date(view.y, view.m, 1);
    var days = new Date(view.y, view.m + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7;              // Monday-first
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push(null);
    for (var n = 1; n <= days; n++) cells.push(n);
    while (cells.length % 7) cells.push(null);

    var rows = '';
    for (var r = 0; r < cells.length; r += 7) {
      rows += '<tr>' + cells.slice(r, r + 7).map(function (n) {
        if (!n) return '<td></td>';
        var ds = P.ymd(new Date(view.y, view.m, n));
        var free = P.isBookable(ds);
        var on = ds === d.date;
        if (!free) return '<td><span class="av-day">' + n + '</span></td>';
        return '<td><button class="av-day is-free' + (on ? ' is-on' : '') + '" type="button" data-date="' +
               ds + '"' + (on ? ' aria-pressed="true"' : '') + '>' + n + '</button></td>';
      }).join('') + '</tr>';
    }

    $('#calMonth').textContent = P.MONTH_LONG[view.m] + ' ' + view.y;
    $('#calBody').innerHTML = rows;

    // can't page back before the current month
    var atStart = (view.y === P.parseYmd(P.TODAY).getFullYear() && view.m === P.parseYmd(P.TODAY).getMonth());
    $('#calPrev').disabled = atStart;

    $$('#calBody [data-date]').forEach(function (el) {
      el.addEventListener('click', function () {
        d.date = el.getAttribute('data-date');
        if (d.time && !P.SLOTS.length) d.time = '';
        renderCalendar(); renderSlots(); save();
      });
    });
  }

  function renderSlots() {
    var wrap = $('#slotList');
    if (!d.date) {
      wrap.innerHTML = '<p class="av-empty">Pick a date to see slots.</p>';
      $('#slotNote').textContent = '';
      return;
    }
    wrap.innerHTML = P.SLOTS.map(function (t) {
      var on = t === d.time;
      return '<button class="av-chip' + (on ? ' is-on' : '') + '" type="button" data-val="' + t + '"' +
             (on ? ' aria-pressed="true"' : '') + '>' + t + '</button>';
    }).join('');
    $('#slotNote').textContent = 'Slots shown are ' + d.doctor.replace(/^Dr /, 'Dr ') +
                                 '’s on ' + P.longLabel(d.date) + '.';
    single(wrap, 'time');
  }

  function renderPickup() {
    $('#pickupTime').textContent = d.pickup || '—';
    $('#pickupNote').textContent = d.time
      ? 'Suggested from a 45 min drive, so Aai reaches ' + d.time + ' with time to spare.'
      : 'Set once you choose a time.';
  }

  /* ---- questions ------------------------------------------------ */
  function renderQuestions() {
    var wrap = $('#questionList');
    if (!d.questions.length) {
      wrap.innerHTML = '<p class="av-empty">None yet. Add what you want to ask.</p>';
    } else {
      wrap.innerHTML = d.questions.map(function (q, i) {
        return '<div class="av-field av-card av-q">' +
          '<div class="av-q__row">' +
            '<p class="av-q__text">“' + P.esc(q.text) + '”</p>' +
            '<button class="av-q__del" type="button" data-i="' + i + '" aria-label="Remove question">&times;</button>' +
          '</div>' +
          '<span class="av-q__by">Added by ' + P.esc(q.by) + '</span>' +
        '</div>';
      }).join('');
      $$('.av-q__del', wrap).forEach(function (b) {
        b.addEventListener('click', function () {
          d.questions.splice(+b.getAttribute('data-i'), 1);
          renderQuestions(); save();
        });
      });
    }
  }

  function addQuestion(text, by) {
    text = (text || '').trim();
    if (!text) return;
    d.questions.push({ text: text, by: by || 'you' });
    renderQuestions(); save();
  }

  function openComposer(by) {
    var box = $('#composer');
    box.hidden = false;
    box.querySelector('textarea').value = '';
    box.querySelector('textarea').focus();
    box.setAttribute('data-by', by || 'you');
  }

  /* ---- tests ---------------------------------------------------- */
  var TEST_POOL = ['HbA1c', 'Kidney function', 'Lipid profile', 'Vitamin D', 'Thyroid (TSH)', 'CBC'];
  function renderTests() {
    var wrap = $('#testList');
    wrap.innerHTML = TEST_POOL.map(function (t) {
      var on = d.tests.indexOf(t) !== -1;
      return '<button class="av-chip' + (on ? ' is-on' : '') + '" type="button" data-test="' + P.esc(t) + '"' +
             (on ? ' aria-pressed="true"' : '') + '>' + P.esc(t) + '</button>';
    }).join('');
    $$('[data-test]', wrap).forEach(function (el) {
      el.addEventListener('click', function () {
        var t = el.getAttribute('data-test');
        var i = d.tests.indexOf(t);
        if (i === -1) d.tests.push(t); else d.tests.splice(i, 1);
        renderTests(); save();
      });
    });
  }

  /* ---- validation ------------------------------------------------ */
  function validate() {
    var missing = [];
    if (!d.hospital) missing.push('hospital');
    if (!d.doctor)   missing.push('doctor');
    if (!d.date)     missing.push('date');
    if (!d.time)     missing.push('time');
    if (!d.reason)   missing.push('reason');

    var cta = $('#reviewCta');
    var hint = $('#ctaHint');
    if (missing.length) {
      cta.setAttribute('aria-disabled', 'true');
      cta.classList.add('is-off');
      hint.textContent = 'Still needed: ' + missing.join(', ');
    } else {
      cta.removeAttribute('aria-disabled');
      cta.classList.remove('is-off');
      hint.textContent = P.longLabel(d.date) + ' · ' + d.time + ' with ' + d.doctor;
    }
    return missing.length === 0;
  }

  /* Push saved values back onto the groups that live in static markup.
     Without this the draft persists correctly but the chips and
     segments reopen showing their authored defaults. */
  function syncStatic() {
    var groups = [
      ['#reasonChips',  d.reason],
      ['#helperNeed',   d.helperNeeded ? 'yes' : 'no'],
      ['#helperType',   d.helperType],
      ['#helperPref',   d.helperPref],
      ['#genderSeg',    d.gender],
      ['#buyMeds',      d.buyMeds ? 'yes' : 'no'],
      ['#recordingSeg', d.recording]
    ];
    groups.forEach(function (g) {
      var box = $(g[0]);
      if (!box) return;
      $$('[data-val]', box).forEach(function (el) {
        var on = el.getAttribute('data-val') === String(g[1]);
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  /* ---- wire up ---------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderHospitals('');
    renderDoctors();
    renderCalendar();
    renderSlots();
    renderPickup();
    renderQuestions();
    renderTests();
    syncStatic();

    $('#hospitalSearch').addEventListener('input', function () {
      renderHospitals(this.value.trim());
    });

    $('#calPrev').addEventListener('click', function () {
      if (--view.m < 0) { view.m = 11; view.y--; }
      renderCalendar();
    });
    $('#calNext').addEventListener('click', function () {
      if (++view.m > 11) { view.m = 0; view.y++; }
      renderCalendar();
    });

    single($('#reasonChips'), 'reason');
    $('#reasonNote').value = d.note;
    $('#reasonNote').addEventListener('input', function () { d.note = this.value; save(); });

    single($('#helperNeed'), 'helperNeeded', function (el) { return el.getAttribute('data-val') === 'yes'; });
    single($('#helperType'), 'helperType');
    single($('#helperPref'), 'helperPref');
    single($('#genderSeg'), 'gender');
    single($('#buyMeds'), 'buyMeds', function (el) { return el.getAttribute('data-val') === 'yes'; });
    single($('#recordingSeg'), 'recording');

    // helper block collapses when no helper is wanted. Since the Figma
    // sync moved the pickup rows out into their own group, that group has
    // to collapse with it — they only exist because a helper is coming.
    function syncHelper() {
      $('#helperDetails').hidden = !d.helperNeeded;
      $('#pickupSection').hidden = !d.helperNeeded;
    }
    // Registered after single()'s handler, so by the time this runs the
    // draft is already updated — no timeout needed.
    $$('#helperNeed [data-val]').forEach(function (el) {
      el.addEventListener('click', syncHelper);
    });
    syncHelper();

    // address + pickup, editable in place
    $('#addressText').textContent = d.address;
    $('#addressEdit').addEventListener('click', function () {
      var v = window.prompt('Pickup address', d.address);
      if (v !== null && v.trim()) { d.address = v.trim(); $('#addressText').textContent = d.address; save(); }
    });
    $('#pickupEdit').addEventListener('click', function () {
      var v = window.prompt('Pickup time (e.g. 10:15 am)', d.pickup || '');
      if (v !== null && P.toMinutes(v)) { d.pickup = P.fromMinutes(P.toMinutes(v)); renderPickup(); save(); }
      else if (v !== null) window.alert('Use a time like 10:15 am');
    });

    // questions
    $('#qType').addEventListener('click', function () { openComposer('you'); });
    $('#qRecord').addEventListener('click', function () {
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { openComposer('voice'); return; }           // no engine: fall back to typing
      var rec = new SR();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      $('#qRecord').classList.add('is-rec');
      $('#qRecord').lastChild.textContent = ' Listening…';
      rec.onresult = function (e) { addQuestion(e.results[0][0].transcript, 'voice'); };
      rec.onerror = function () { openComposer('voice'); };
      rec.onend = function () {
        $('#qRecord').classList.remove('is-rec');
        $('#qRecord').lastChild.textContent = ' Record';
      };
      try { rec.start(); } catch (err) { openComposer('voice'); }
    });
    $('#composerSave').addEventListener('click', function () {
      var box = $('#composer');
      addQuestion(box.querySelector('textarea').value, box.getAttribute('data-by'));
      box.hidden = true;
    });
    $('#composerCancel').addEventListener('click', function () { $('#composer').hidden = true; });

    $('#addTest').addEventListener('click', function () {
      var v = window.prompt('Add a test');
      if (v && v.trim()) {
        if (TEST_POOL.indexOf(v.trim()) === -1) TEST_POOL.push(v.trim());
        if (d.tests.indexOf(v.trim()) === -1) d.tests.push(v.trim());
        renderTests(); save();
      }
    });

    $('#reviewCta').addEventListener('click', function (e) {
      if (!validate()) {
        e.preventDefault();
        var first = !d.date ? '#dateSection' : !d.time ? '#timeSection' : '#hospitalSection';
        var el = document.querySelector(first);
        if (el) document.querySelector('.screen__scroll').scrollTop = el.offsetTop - 80;
      }
    });

    validate();
  });
})();
