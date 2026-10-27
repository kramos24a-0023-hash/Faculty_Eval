(function attachModal(global) {
  const app = (global.FacultyEvaluation = global.FacultyEvaluation || {});

  function initialize() {
    const backdrop = document.getElementById("modal");
    const form = document.getElementById("modalForm");
    const closeButton = document.querySelector("[data-modal-close]");
    const openButtons = document.querySelectorAll('[data-modal="period"]');
    let previousFocus = null;

    if (!backdrop || !form || !closeButton) return;

    function open() {
      previousFocus = document.activeElement;
      backdrop.hidden = false;
      document.getElementById("periodName")?.focus();
    }

    function close() {
      backdrop.hidden = true;
      form.reset();
      previousFocus?.focus();
    }

    openButtons.forEach((button) => button.addEventListener("click", open));
    closeButton.addEventListener("click", close);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.hidden) close();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close();
      app.notifications.show("Demo form submitted. Changes are not saved.");
    });
  }

  app.modal = { initialize };
})(window);
