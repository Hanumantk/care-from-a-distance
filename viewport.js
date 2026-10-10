/* ============================================================
   Fit the design to the phone it is opened on.

   Five of these screens are traced from Figma with absolutely
   positioned children on a 393px grid, so they cannot reflow to an
   arbitrary width without being rebuilt. What they can do is scale:
   telling a mobile browser `width=393` makes it lay the page out at
   the design's native width and scale that to the physical screen.
   A 360px Android renders at 0.92x, a 430px Pro Max at 1.09x, and
   the proportions stay exactly as drawn.

   Only portrait phones get this. A tablet is wide enough to show the
   393 frame at 1:1 inside its device mock, and blowing the design up
   2x on an iPad would look broken. In landscape the short edge is too
   short to scale into, so that falls back to the mock as well.

   This has to run before first paint, so it is a plain script in
   <head> — no defer, no module.
   ============================================================ */
(function () {
  'use strict';

  var DESIGN_WIDTH = 393;
  var PHONE_MAX_EDGE = 500;   // short edge, in CSS px: phone vs tablet
  var DEFAULT = 'width=device-width, initial-scale=1';

  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta || !window.screen) return;

  function apply() {
    // screen.width/height are the device's own dimensions and do not
    // change with the viewport we set, so this can't feed back on itself.
    var shortEdge = Math.min(window.screen.width, window.screen.height);
    var portrait = window.innerHeight >= window.innerWidth;

    var fit = shortEdge <= PHONE_MAX_EDGE && portrait;
    meta.setAttribute('content', fit ? 'width=' + DESIGN_WIDTH : DEFAULT);
  }

  apply();

  // Rotating changes which branch applies. orientationchange fires before
  // the new dimensions settle on some browsers, so re-read on resize too.
  window.addEventListener('orientationchange', function () {
    setTimeout(apply, 50);
  });
  window.addEventListener('resize', apply);
})();
