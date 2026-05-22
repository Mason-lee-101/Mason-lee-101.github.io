const themeToggle = document.getElementById("theme-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const routeSections = Array.from(document.querySelectorAll("[data-route-section]"));
const preferredDarkMode = window.matchMedia("(prefers-color-scheme: dark)");
const savedTheme = localStorage.getItem("theme");

function setTheme(isDark) {
  if (isDark) {
    document.body.dataset.theme = "dark";
    themeToggle.textContent = "Light mode";
  } else {
    delete document.body.dataset.theme;
    themeToggle.textContent = "Dark mode";
  }
}

if (themeToggle) {
  setTheme(savedTheme ? savedTheme === "dark" : preferredDarkMode.matches);

  themeToggle.addEventListener("click", () => {
    const isDark = document.body.dataset.theme === "dark";
    const nextIsDark = !isDark;
    localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setTheme(nextIsDark);
  });

  preferredDarkMode.addEventListener("change", (event) => {
    if (!localStorage.getItem("theme")) {
      setTheme(event.matches);
    }
  });
}

function setActiveNavFromHash() {
  if (!navLinks.length) {
    return;
  }

  const activeTarget = document.body.dataset.pageLayout === "post" || window.location.hash === "#blog"
    ? "blog"
    : "home";

  navLinks.forEach((link) => {
    link.classList.toggle("is-current", link.dataset.navLink === activeTarget);
  });

  routeSections.forEach((section) => {
    section.hidden = section.dataset.routeSection !== activeTarget;
  });
}

setActiveNavFromHash();
window.addEventListener("hashchange", setActiveNavFromHash);
