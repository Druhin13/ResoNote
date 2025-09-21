// Small bootstrapping helper for the client app

/**
 * @file Bootstrapping helpers for the ResoNote client app.
 * Initializes icon rendering, sets up global error/rejection listeners,
 * and ensures safe execution on DOM load.
 */

(function () {
  /**
   * Initialize Lucide icons safely if available on window.
   * Protects against runtime errors during icon creation.
   * @private
   */
  function safeCreateLucide() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      try {
        window.lucide.createIcons();
      } catch (err) {
        // Icon initialization errors are intentionally ignored
      }
    }
  }

  /**
   * Global uncaught error listener.
   * Extend this to forward errors to a remote logging service.
   */
  window.addEventListener("error", (ev) => {
    // Example: console.error('Uncaught error:', ev.error || ev.message);
  });

  /**
   * Global unhandled Promise rejection listener.
   * Extend this to forward rejection reasons to monitoring tools.
   */
  window.addEventListener("unhandledrejection", (ev) => {
    // Example: console.warn('Unhandled rejection', ev.reason);
  });

  /**
   * DOM ready entrypoint.
   * Ensures Lucide icons are created after the document is loaded.
   */
  document.addEventListener("DOMContentLoaded", () => {
    safeCreateLucide();
  });
})();
