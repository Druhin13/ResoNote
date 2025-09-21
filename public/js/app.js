// public/js/app.js
// Small bootstrapping helper for the client app

(function () {
  function safeCreateLucide() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons();
      } catch (err) {
        // ignore icon initialization issues
        // console.warn('lucide.createIcons error', err);
      }
    }
  }

  // Global error reporting for uncaught errors (optional)
  window.addEventListener('error', (ev) => {
    // You can hook this to remote logging if desired
    // console.error('Uncaught error:', ev.error || ev.message);
  });

  window.addEventListener('unhandledrejection', (ev) => {
    // console.warn('Unhandled rejection', ev.reason);
  });

  document.addEventListener('DOMContentLoaded', () => {
    safeCreateLucide();
  });
})();