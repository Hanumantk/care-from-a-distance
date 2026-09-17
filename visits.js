/* ============================================================
   Visits list — merges the three visits drawn in Figma with any the
   user has confirmed, sorts them, and re-renders the stack.

   The static cards stay in the HTML, so with JS off the screen is
   still the designed one. This only replaces them once it can render
   the full, correctly ordered list.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PHA;

  function card(v) {
    var upcoming = v.status !== 'done';
    var eyebrow, chip;

    if (upcoming) {
      var away = P.dayDiff(v.date, P.TODAY);
      eyebrow = away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : 'Upcoming visit';
      chip = v.helperNeeded
        ? '<div class="chip chip--helper"><span class="chip__label">Helper assigned</span></div>'
        : '';
    } else {
      eyebrow = Math.abs(P.dayDiff(v.date, P.TODAY)) + ' days ago';
      chip = '<div class="chip chip--done"><span class="chip__label">Completed</span></div>';
    }

    var cls = 'card visit ' + (upcoming ? 'visit--upcoming' : 'visit--past');
    var inner =
      '<p class="visit__eyebrow">' + P.esc(eyebrow) + '</p>' + chip +
      '<p class="visit__date">' + P.esc(P.dateLabel(v.date)) + '</p>' +
      '<p class="visit__place">' + P.esc(v.hospital) + '</p>' +
      '<p class="visit__doctor">' + P.esc(v.doctor) + '</p>' +
      '<img class="visit__divider" src="assets/divider-visit.svg" alt="" />' +
      '<p class="visit__reason-label">Reason</p>' +
      '<p class="visit__reason">' + P.esc(v.reason) + '</p>';

    // Every upcoming visit now opens its own detail view; past ones only
    // do if a screen was designed for them (28 SEP has one, 4 SEP doesn't).
    var href = v.href || (upcoming ? 'upcoming-visit.html?id=' + encodeURIComponent(v.id) : '');
    return href
      ? '<a class="' + cls + '" href="' + href + '">' + inner + '</a>'
      : '<section class="' + cls + '">' + inner + '</section>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('visitList');
    if (!list) return;

    var visits = P.allVisits();
    list.innerHTML = visits.map(card).join('');

    // Canvas has to grow with the list: first card at 161, 20px gaps,
    // then the same 88px of breathing room the design leaves at the end.
    var canvas = document.querySelector('.screen__canvas');
    if (canvas) {
      canvas.style.height = (161 + visits.length * 165 + (visits.length - 1) * 20 + 88) + 'px';
    }

    // A confirmation, only right after a visit is created or deleted.
    var made = /[?&]created=1/.test(window.location.search);
    var gone = /[?&]deleted=1/.test(window.location.search);
    if (made || gone) {
      var toast = document.getElementById('toast');
      if (toast) {
        if (gone) {
          toast.classList.add('toast--removed');
          toast.querySelector('span:last-child').textContent =
            'Visit deleted. Helper and Care Circle told.';
        }
        toast.hidden = false;

        // Holds for 30s, then fades. The 400ms second step matches the
        // CSS transition, so the node leaves the layout once it has
        // finished fading rather than snapping out mid-animation.
        var hold = setTimeout(dismiss, 30000);
        function dismiss() {
          clearTimeout(hold);
          toast.classList.add('is-out');
          setTimeout(function () { toast.hidden = true; }, 400);
        }
        // 30s is a long time to sit over the last card, so a tap clears it.
        toast.addEventListener('click', dismiss);
      }
      if (window.history.replaceState) {
        window.history.replaceState({}, '', 'visits.html');
      }
    }
  });
})();
