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
  });
})();
