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
      P.removeVisit(v.id);
      window.location.href = 'visits.html?deleted=1';
    });
  });
})();
