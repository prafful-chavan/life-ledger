/* Life Ledger — UI polish helpers (no dependencies, Safari/Chrome/Firefox safe).
   Keeps big money values inside their cards on every screen size. CSS does the heavy lifting
   (container-query fluid type); this is the safety net for browsers/values CSS can't cover. */
(function () {
  'use strict';

  var SELECTOR = '.metric-card .value, .nwh-banner-value, [data-fit]';
  var MIN_PX = 11;
  var scheduled = false;

  var range = document.createRange ? document.createRange() : null;

  // Space the number may use: its own box, but never more than the card's content area
  function availableWidth(el) {
    var own = el.clientWidth;
    var card = el.closest ? el.closest('.metric-card') : null;
    if (!card) return own;
    var cs = window.getComputedStyle(card);
    var inner = card.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    return own ? Math.min(own, inner) : inner;
  }

  function textWidth(el) {
    if (!range) return el.scrollWidth;
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  }

  function fit(el) {
    if (!el || !el.isConnected) return;
    if (el.hasAttribute('data-fit-shrunk')) {
      el.style.fontSize = '';
      el.removeAttribute('data-fit-shrunk');
    }
    var avail = availableWidth(el);
    if (!avail) return;
    var guard = 0;
    while (textWidth(el) > avail + 0.5 && guard < 40) {
      var size = parseFloat(window.getComputedStyle(el).fontSize);
      if (!size || size <= MIN_PX) break;
      el.style.fontSize = (size - 0.5) + 'px';
      el.setAttribute('data-fit-shrunk', '1');
      guard++;
    }
  }

  // Long text cells (company / fund names, notes) may wrap; everything else stays on one line
  function tagWrapCells() {
    var cells = document.querySelectorAll('.table-wrap td:not(.cell-wrap)');
    for (var i = 0; i < cells.length; i++) {
      var text = (cells[i].textContent || '').trim();
      if (text.length > 26 && text.indexOf(' ') > -1 && cells[i].children.length < 3) {
        cells[i].classList.add('cell-wrap');
      }
    }
  }

  function fitAll() {
    scheduled = false;
    tagWrapCells();
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) fit(nodes[i]);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(function () { window.setTimeout(fitAll, 30); });
  }

  function start() {
    schedule();
    if ('MutationObserver' in window) {
      // childList/characterData: re-rendered values. hidden/class: a tab or section was just shown
      // (values measured while hidden have no width, so they must be fitted again once visible).
      new MutationObserver(schedule).observe(document.body, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['hidden', 'class']
      });
    }
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
