/* ============================================================
   Screenshot button — a presenter tool, not part of the design.

   A camera button in the page corner, outside the phone, saves the
   current screen inside the iPhone frame as a PNG. It captures what is
   actually showing: the scroll position, an open sheet, the demo stage.
   It hides below 540px wide (shell.css), where it would have to sit on
   top of the app.

   html-to-image is only fetched on the first click, so pages don't pay
   for it on load.
   ============================================================ */
(function () {
  'use strict';

  var LIB = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
  /* The PNG is the phone alone on a transparent ground: no page colour,
     no drop shadow (on a slide or a dark board a baked-in shadow reads as
     a grey smudge). PAD only leaves room for the side buttons, which sit
     2px outside the bezel. */
  var PAD = 4;

  var CAMERA = '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z"/></svg>';

  var lib = null;
  function loadLib() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (lib) return lib;
    lib = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LIB;
      s.onload = function () { resolve(window.htmlToImage); };
      s.onerror = function () { lib = null; reject(new Error('Could not load the screenshot library')); };
      document.head.appendChild(s);
    });
    return lib;
  }

  /* Poppins comes from Google Fonts, a cross-origin stylesheet the
     library isn't allowed to read, so on its own it would draw the
     picture in a fallback font. Fetch that CSS ourselves (it allows
     CORS), keep the latin and latin-ext faces (latin-ext carries the
     rupee sign) and inline each font file as a data URL. Cached after
     the first screenshot. */
  var fonts = null;
  function fontCSS() {
    if (fonts) return fonts;
    var link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
    if (!link) return Promise.resolve('');
    fonts = fetch(link.href)
      .then(function (res) { return res.text(); })
      .then(function (css) {
        var blocks = css.split(/(?=\/\*\s*[a-z-]+\s*\*\/)/);
        var wanted = blocks.filter(function (b) { return /^\/\*\s*latin(-ext)?\s*\*\//.test(b); });
        return Promise.all((wanted.length ? wanted : blocks).map(function (block) {
          var m = /url\((https:[^)]+)\)/.exec(block);
          if (!m) return block;
          return fetch(m[1])
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
              return new Promise(function (resolve) {
                var fr = new FileReader();
                fr.onload = function () { resolve(block.replace(m[1], fr.result)); };
                fr.readAsDataURL(blob);
              });
            });
        }));
      })
      .then(function (parts) { return parts.join('\n'); })
      .catch(function () { fonts = null; return ''; });
    return fonts;
  }

  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
           p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* "Parent Health App — Upcoming visit" -> "upcoming-visit" */
  function screenName() {
    var t = document.title.split('—').pop() || 'screen';
    return t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen';
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  var busy = false;

  function capture(btn) {
    if (busy) return;
    var device = document.querySelector('.device');
    if (!device) return;
    busy = true;
    btn.setAttribute('aria-busy', 'true');

    // A clone never keeps its scroll position, so the scrolled amount is
    // moved onto a transform for the duration. It looks identical.
    var scroller = document.querySelector('.screen__scroll');
    var canvas = scroller && scroller.firstElementChild;
    var top = scroller ? scroller.scrollTop : 0;

    var shifted = false;

    loadLib()
      .then(function () {
        if (canvas && top) {
          scroller.scrollTop = 0;
          canvas.style.transform = 'translateY(' + (-top) + 'px)';
          shifted = true;
        }
        return fontCSS();
      })
      .then(function (css) {
        var w = device.offsetWidth, h = device.offsetHeight;
        // width/height size the picture, but the library also writes them
        // onto the device itself; style runs after, so it pins the device
        // back to its real size inside the slightly larger picture.
        return window.htmlToImage.toBlob(device, {
          fontEmbedCSS: css,
          pixelRatio: 2,
          width: w + PAD * 2,
          height: h + PAD * 2,
          style: {
            margin: PAD + 'px',
            width: w + 'px',
            height: h + 'px',
            transform: 'none',
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.10) inset'
          },
          // The Demo pill is for whoever is presenting, not the design.
          filter: function (node) {
            return !(node.classList && node.classList.contains('demo'));
          }
        });
      })
      .then(function (blob) {
        save(blob, 'care-from-a-distance-' + screenName() + '-' + stamp() + '.png');
      })
      .catch(function (err) {
        window.alert('Sorry, the screenshot didn’t work. ' + (err && err.message ? err.message : ''));
      })
      .then(function () {
        if (shifted) {
          canvas.style.transform = '';
          scroller.scrollTop = top;
        }
        btn.removeAttribute('aria-busy');
        busy = false;
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snap-btn';
    btn.setAttribute('aria-label', 'Download a screenshot of this screen');
    btn.title = 'Download a screenshot of this screen';
    btn.innerHTML = CAMERA;

    btn.addEventListener('click', function () { capture(btn); });
    document.body.appendChild(btn);
  });
})();
