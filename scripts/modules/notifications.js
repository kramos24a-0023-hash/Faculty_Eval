(function attachNotifications(global) {
  const app = (global.FacultyEvaluation = global.FacultyEvaluation || {});
  const toast = document.getElementById("toast");
  let timeoutId;

  function show(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("is-visible");
    global.clearTimeout(timeoutId);
    timeoutId = global.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  app.notifications = { show };
})(window);
