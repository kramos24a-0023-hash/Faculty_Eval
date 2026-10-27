(function initializeDashboard(global) {
  const app = global.FacultyEvaluation;

  function initialize() {
    app.modal.initialize();
    app.navigation.initialize();
    app.search.initialize();

    document.querySelectorAll(".row-action").forEach((button) => {
      button.addEventListener("click", () => {
        app.notifications.show("Evaluation period details are a prototype preview.");
      });
    });

    document.querySelectorAll(".table-action").forEach((button) => {
      button.addEventListener("click", () => {
        app.notifications.show("Program actions are a prototype preview.");
      });
    });

    document.getElementById("notificationButton")?.addEventListener("click", () => {
      app.notifications.show("You’re all caught up on notifications.");
    });
  }

  initialize();
})(window);
