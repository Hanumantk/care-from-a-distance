/* ============================================================
   Home — the Upcoming visit card follows whatever is actually next.
   Only the strings change; the card keeps its Figma geometry.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;
  document.addEventListener('DOMContentLoaded', function () {
    var next = P.allVisits().filter(function (v) { return v.status !== 'done'; })[0];
    if (!next) return;
    var set = function (sel, text) {
      var el = document.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('.visit-card__date', P.dateLabel(next.date));
    set('.visit-card__place', next.hospital);
    set('.visit-card__doctor', next.doctor);
    set('.visit-card__reason', next.reason);
    var chip = document.querySelector('.chip--helper');
    if (chip) chip.style.display = next.helperNeeded === false ? 'none' : '';

    var link = document.querySelector('.visit-card__link');
    if (link) {
      link.href = 'upcoming-visit.html?id=' + encodeURIComponent(next.id);
      link.setAttribute('aria-label', 'Open upcoming visit: ' + P.dateLabel(next.date) + ', ' + next.hospital);
    }

    /* Visit in progress: the chip shows the stage, or the problem. */
    var live = P.getLive();
    if (chip && next.id === P.LIVE_ID && live.stage > 0) {
      var issue = P.ISSUE_CHIP[live.issue];
      chip.querySelector('.chip__label').textContent = issue || P.LIVE_CHIP[live.stage];
      chip.classList.add('chip--live');
      chip.classList.toggle('is-issue', !!issue);
      chip.classList.toggle('is-settled', !issue && live.stage >= 7);
      chip.style.display = '';
    }
  });
})();
