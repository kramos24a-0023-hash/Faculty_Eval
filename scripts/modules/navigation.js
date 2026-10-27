(function attachNavigation(global) {
  const app = (global.FacultyEvaluation = global.FacultyEvaluation || {});

  function initialize() {
    const navItems = document.querySelectorAll(".nav-item[data-page]");
    const pageControls = document.querySelectorAll("[data-page]");
    const breadcrumb = document.getElementById("crumb");
    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.getElementById("menuToggle");

    function selectPage(page) {
      if (breadcrumb) breadcrumb.textContent = page;

      navItems.forEach((item) => {
        const isActive = item.dataset.page === page;
        item.classList.toggle("is-active", isActive);

        if (isActive) {
          item.setAttribute("aria-current", "page");
        } else {
          item.removeAttribute("aria-current");
        }
      });

      sidebar?.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");

      if (page !== "Dashboard") {
        app.notifications.show(`${page} workspace selected`);
      }
    }

    pageControls.forEach((control) => {
      control.addEventListener("click", () => selectPage(control.dataset.page));
    });

    menuToggle?.addEventListener("click", () => {
      const isOpen = sidebar?.classList.toggle("is-open") ?? false;
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  app.navigation = { initialize };
})(window);
