const themeToggle = document.getElementById("theme-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const routeSections = Array.from(document.querySelectorAll("[data-route-section]"));
const codeBlocks = Array.from(document.querySelectorAll(".post-content pre"));
const postLinks = Array.from(document.querySelectorAll(".post-content a[href]"));
const postContent = document.querySelector(".post-content");
const postToc = document.querySelector("[data-post-toc]");
const postTocList = document.querySelector("[data-post-toc-list]");
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

postLinks.forEach((link) => {
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  } finally {
    textarea.remove();
  }
}

function enhanceCodeBlocks() {
  codeBlocks.forEach((pre) => {
    if (pre.closest(".code-frame")) {
      return;
    }

    const code = pre.querySelector("code");
    const existingHighlight = pre.closest(".highlight");
    const frame = existingHighlight || document.createElement("div");

    if (!existingHighlight) {
      frame.className = "code-frame";
      pre.parentNode.insertBefore(frame, pre);
      frame.appendChild(pre);
    } else {
      frame.classList.add("code-frame");
    }

    const scrollArea = document.createElement("div");
    scrollArea.className = "code-scroll";
    pre.parentNode.insertBefore(scrollArea, pre);
    scrollArea.appendChild(pre);

    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";

    const copyButton = document.createElement("button");
    copyButton.className = "code-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy";

    const wrapButton = document.createElement("button");
    wrapButton.className = "code-button";
    wrapButton.type = "button";
    wrapButton.textContent = "No wrap";
    wrapButton.setAttribute("aria-pressed", "false");

    toolbar.append(copyButton, wrapButton);
    frame.insertBefore(toolbar, frame.firstChild);

    copyButton.addEventListener("click", () => {
      copyText((code || pre).textContent).then(() => {
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 1600);
      }).catch(() => {
        copyButton.textContent = "Copy failed";
        window.setTimeout(() => {
          copyButton.textContent = "Copy";
        }, 1600);
      });
    });

    function updateOverflowState() {
      const wasWrapped = frame.classList.contains("is-wrapped");
      const codeLines = (code || pre).textContent
        .trim()
        .split(/\r?\n/);
      const longestLineLength = codeLines
        .reduce((longest, line) => Math.max(longest, line.length), 0);
      const isLongLine = longestLineLength > 100;

      frame.classList.remove("is-wrapped");
      frame.classList.toggle("is-single-line", codeLines.length === 1);
      const hasOverflow = isLongLine && pre.scrollWidth > pre.clientWidth + 1;
      frame.classList.toggle("has-overflow", hasOverflow);

      if (!hasOverflow) {
        frame.classList.remove("is-wrapped");
        frame.classList.remove("is-nowrap");
        wrapButton.hidden = true;
        wrapButton.setAttribute("aria-pressed", "false");
        wrapButton.textContent = "No wrap";
        return;
      }

      wrapButton.hidden = false;

      if (wasWrapped || !frame.classList.contains("is-nowrap")) {
        frame.classList.add("is-wrapped");
        wrapButton.textContent = "No wrap";
        wrapButton.setAttribute("aria-pressed", "false");
      }
    }

    wrapButton.addEventListener("click", () => {
      const isWrapped = frame.classList.toggle("is-wrapped");

      if (isWrapped) {
        frame.classList.remove("is-nowrap");
        wrapButton.textContent = "No wrap";
        wrapButton.setAttribute("aria-pressed", "false");
      } else {
        frame.classList.add("is-nowrap");
        wrapButton.textContent = "Wrap";
        wrapButton.setAttribute("aria-pressed", "true");
      }
    });

    window.addEventListener("resize", () => {
      updateOverflowState();
    });

    window.requestAnimationFrame(updateOverflowState);
  });

}

enhanceCodeBlocks();

function slugifyHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function enhancePostToc() {
  if (!postContent || !postToc || !postTocList) {
    return;
  }

  const headings = Array.from(postContent.querySelectorAll("h2, h3"))
    .filter((heading) => heading.textContent.trim());

  if (!headings.length) {
    return;
  }

  const usedIds = new Map();
  const tocLinks = headings.map((heading) => {
    if (!heading.id) {
      const baseId = slugifyHeading(heading.textContent);
      const usedCount = usedIds.get(baseId) || 0;
      usedIds.set(baseId, usedCount + 1);
      heading.id = usedCount ? `${baseId}-${usedCount + 1}` : baseId;
    }

    const item = document.createElement("li");
    item.className = `toc-level-${heading.tagName.toLowerCase()}`;

    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent.trim();
    link.dataset.tocTarget = heading.id;

    item.appendChild(link);
    postTocList.appendChild(item);
    return link;
  });

  postToc.hidden = false;

  const observer = new IntersectionObserver((entries) => {
    const visibleEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

    if (!visibleEntry) {
      return;
    }

    tocLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.tocTarget === visibleEntry.target.id);
    });
  }, {
    rootMargin: "-20% 0px -65% 0px",
    threshold: 0
  });

  headings.forEach((heading) => observer.observe(heading));
}

enhancePostToc();
