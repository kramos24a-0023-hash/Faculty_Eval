(function attachSearch(global) {
  const app = (global.FacultyEvaluation = global.FacultyEvaluation || {});

  function initialize() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      const query = input.value.trim();
      if (event.key === "Enter" && query) {
        app.notifications.show(`Searching for “${query}”`);
      }
    });
  }

  app.search = { initialize };
})(window);
