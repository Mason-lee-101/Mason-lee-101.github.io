const themeToggle = document.getElementById("theme-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
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
  setTheme(savedTheme === "dark");

  themeToggle.addEventListener("click", () => {
    const isDark = document.body.dataset.theme === "dark";
    const nextIsDark = !isDark;
    localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setTheme(nextIsDark);
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
}

setActiveNavFromHash();
window.addEventListener("hashchange", setActiveNavFromHash);
