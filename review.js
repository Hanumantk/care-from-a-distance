/* ============================================================
   Review — renders the draft, then writes a real visit on Confirm.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;

  document.addEventListener('DOMContentLoaded', function () {
    var d = P.getDraft();
    var $ = function (s) { return document.querySelector(s); };

    // Arriving here without a date/time means the form was never filled.
    if (!d.date || !d.time) {
      $('#summary').innerHTML =
        '<div class="av-summary__row"><p class="av-summary__k">Nothing to review yet</p>' +
        '<p class="av-summary__extra">Go back and pick a date and time.</p></div>';
      $('#confirmCta').setAttribute('aria-disabled', 'true');
      $('#confirmCta').classList.add('is-off');
      $('#notice').hidden = true;
      return;
    }

    function row(k, v, extras, cls) {
      return '<div class="av-summary__row">' +
        '<p class="av-summary__k">' + P.esc(k) + '</p>' +
        '<p class="av-summary__v' + (cls || '') + '">' + P.esc(v) + '</p>' +
        (extras || []).map(function (e) {
          return '<p class="av-summary__extra">' + P.esc(e) + '</p>';
        }).join('') + '</div>';
    }

    var parts = [];
    parts.push(row('Hospital', d.hospital, [d.doctor], ' av-summary__v--lg'));
    parts.push(row('Date and time', P.longLabel(d.date) + ' · ' + d.time,
                   [d.reason + (d.note ? ' · ' + d.note : '')]));

    if (d.helperNeeded) {
      parts.push(row('Helper', d.helperName,
                     [d.helperType + ' · ' + d.gender.toLowerCase() + ' preference']));
      parts.push(row('Pickup', d.pickup || '—', [d.address]));
    } else {
      parts.push(row('Helper', 'Not needed', ['You are taking Aai yourself']));
    }

    if (d.questions.length) {
      parts.push('<div class="av-summary__row"><p class="av-summary__k">Questions for the doctor</p>' +
        d.questions.map(function (q) {
          return '<p class="av-summary__q">“' + P.esc(q.text) + '”</p>';
        }).join('') + '</div>');
    }

    var also = [];
    if (d.tests.length) also.push('Tests: ' + d.tests.join(', '));
    also.push(d.buyMeds ? 'Medicines bought after the visit' : 'No medicine run');
    also.push(d.recording === 'Notes only' ? 'Notes only, no recording'
                                           : 'Recording with the doctor’s consent');
    if (d.notified.length) also.push(d.notified.join(' and ') + ' are notified');
    parts.push('<div class="av-summary__row"><p class="av-summary__k">Also arranged</p>' +
      also.map(function (t) {
        return '<p class="av-summary__extra">' + P.esc(t) + '</p>';
      }).join('') + '</div>');

    $('#summary').innerHTML = parts.join('<div class="av-divider"></div>');

    $('#confirmCta').addEventListener('click', function (e) {
      e.preventDefault();
      P.addVisit({
        id: 'v' + Date.now(),
        date: d.date,
        time: d.time,
        hospital: d.hospital,
        doctor: d.doctor,
        reason: d.note || d.reason,
        helperNeeded: !!d.helperNeeded,
        helperName: d.helperName,
        pickup: d.pickup,
        address: d.address,
        questions: d.questions,
        tests: d.tests,
        status: 'upcoming',
        createdAt: new Date().toISOString()
      });
      P.clearDraft();
      window.location.href = 'visits.html?created=1';
    });
  });
})();
