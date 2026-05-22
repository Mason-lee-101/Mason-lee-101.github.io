const themeToggle = document.getElementById("theme-toggle");
const postList = document.getElementById("post-list");
const postView = document.getElementById("post-view");
const blogListView = document.getElementById("blog-list-view");
const blogPostView = document.getElementById("blog-post-view");
const blogHeading = document.getElementById("blog-heading");
const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
const tabPanels = Array.from(document.querySelectorAll("[data-panel]"));
const fallbackPosts = Array.isArray(window.BLOG_POSTS_FALLBACK) ? window.BLOG_POSTS_FALLBACK : [];
const savedTheme = localStorage.getItem("theme");

function getCanonicalPagePath() {
  return window.location.pathname.replace(/(?:^|\/)index\.html$/i, (match) => {
    return match.startsWith("/") ? "/" : "";
  });
}

if (themeToggle && savedTheme === "dark") {
  document.body.dataset.theme = "dark";
  themeToggle.textContent = "Light mode";
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.dataset.theme === "dark";

    if (isDark) {
      delete document.body.dataset.theme;
      localStorage.setItem("theme", "light");
      themeToggle.textContent = "Dark mode";
    } else {
      document.body.dataset.theme = "dark";
      localStorage.setItem("theme", "dark");
      themeToggle.textContent = "Light mode";
    }
  });
}

function setActiveTab(tabName, updateHash = true) {
  if (!tabButtons.length || !tabPanels.length) {
    return;
  }

  const nextTab = tabPanels.some((panel) => panel.dataset.panel === tabName) ? tabName : "home";
  const selectedPost = new URLSearchParams(window.location.search).get("post");

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === nextTab;
    button.classList.toggle("is-current", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nextTab;
  });

  if (updateHash || nextTab !== "blog" || !selectedPost) {
    setBlogView("list");
  }

  if (updateHash) {
    const pagePath = getCanonicalPagePath();
    const nextUrl = nextTab === "home"
      ? pagePath
      : `${pagePath}#${nextTab}`;
    history.replaceState(null, "", nextUrl);
  }
}

if (tabButtons.length) {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveTab(window.location.hash.slice(1), false);
  });

  const initialTab = new URLSearchParams(window.location.search).get("post")
    ? "blog"
    : window.location.hash.slice(1);

  setActiveTab(initialTab, false);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isExternalUrl(url) {
  return /^(?:[a-z]+:|#|\/)/i.test(url);
}

function resolveMarkdownUrl(url, basePath) {
  if (!url || isExternalUrl(url) || !basePath) {
    return url;
  }

  return `${basePath}${url}`;
}

function parseInlineMarkdown(text, basePath = "") {
  const escaped = escapeHtml(text);

  return escaped
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const resolvedUrl = resolveMarkdownUrl(url, basePath);
      return `<img src="${resolvedUrl}" alt="${alt}" class="post-image">`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const resolvedUrl = resolveMarkdownUrl(url, basePath);
      return `<a href="${resolvedUrl}">${label}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(markdown, basePath = "") {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }

    html.push(`<p>${parseInlineMarkdown(paragraph.join(" "), basePath)}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) {
      return;
    }

    const items = listItems
      .map((item) => `<li>${parseInlineMarkdown(item, basePath)}</li>`)
      .join("");
    html.push(`<ul>${items}</ul>`);
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      html.push(`<h4>${parseInlineMarkdown(trimmed.slice(4).trim(), basePath)}</h4>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      html.push(`<h3>${parseInlineMarkdown(trimmed.slice(3).trim(), basePath)}</h3>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      html.push(`<h2>${parseInlineMarkdown(trimmed.slice(2).trim(), basePath)}</h2>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return html.join("");
}

function getMeaningfulLines(markdown) {
  return markdown
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseFrontMatter(markdown) {
  const normalized = markdown.replace(/\r/g, "");

  if (!normalized.startsWith("---\n")) {
    return { metadata: {}, body: markdown };
  }

  const endIndex = normalized.indexOf("\n---", 4);

  if (endIndex === -1) {
    return { metadata: {}, body: markdown };
  }

  const metadata = normalized
    .slice(4, endIndex)
    .split("\n")
    .reduce((fields, line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);

      if (match) {
        fields[match[1].trim().toLowerCase()] = match[2].trim();
      }

      return fields;
    }, {});

  return {
    metadata,
    body: normalized.slice(endIndex + 5).replace(/^\n+/, "")
  };
}

function getPostBody(markdown) {
  return parseFrontMatter(markdown).body;
}

function getPostMetadata(markdown) {
  return parseFrontMatter(markdown).metadata;
}

function getPreviewLines(markdown) {
  const description = getPostDescription(markdown);

  if (description) {
    return [getPostTitle(markdown, ""), description].filter(Boolean);
  }

  return getMeaningfulLines(removePostMetadata(markdown)).slice(0, 3);
}

function removePostMetadata(markdown) {
  return getPostBody(markdown)
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !/^(date|description):/i.test(trimmed);
    })
    .join("\n");
}

function removePostHeader(markdown, title) {
  let removedTitle = false;

  return removePostMetadata(markdown)
    .split("\n")
    .filter((line) => {
      if (!removedTitle && line.trim() === `# ${title}`) {
        removedTitle = true;
        return false;
      }

      return true;
    })
    .join("\n")
    .trimStart();
}

function getPostTitle(markdown, fallbackTitle) {
  const metadataTitle = getPostMetadata(markdown).title;

  if (metadataTitle) {
    return metadataTitle;
  }

  const titleLine = getMeaningfulLines(getPostBody(markdown)).find((line) => line.startsWith("# "));
  return titleLine ? titleLine.slice(2).trim() : fallbackTitle;
}

function getPostDescription(markdown) {
  const metadataDescription = getPostMetadata(markdown).description;

  if (metadataDescription) {
    return metadataDescription;
  }

  const descriptionLine = getMeaningfulLines(getPostBody(markdown)).find((line) => /^description:/i.test(line));

  if (!descriptionLine) {
    return "";
  }

  return descriptionLine.replace(/^description:\s*/i, "").trim();
}

function getRawPostDate(markdown) {
  const metadataDate = getPostMetadata(markdown).date;

  if (metadataDate) {
    return metadataDate;
  }

  const dateLine = getMeaningfulLines(getPostBody(markdown)).find((line) => /^date:/i.test(line));

  if (!dateLine) {
    return "";
  }

  return dateLine.replace(/^date:\s*/i, "").trim();
}

function formatDateParts(year, month, day) {
  return [
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
    String(year)
  ].join("/");
}

function formatPostDate(rawDate) {
  if (!rawDate) {
    return "";
  }

  const usDateMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (usDateMatch) {
    const [, month, day, year] = usDateMatch;
    return formatDateParts(year, month, day);
  }

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return formatDateParts(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + 1,
    parsedDate.getDate()
  );
}

function getPostDateValue(markdown) {
  const rawDate = getRawPostDate(markdown);

  if (!rawDate) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedDate = Date.parse(rawDate);

  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  const usDateMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!usDateMatch) {
    return Number.NEGATIVE_INFINITY;
  }

  const [, month, day, year] = usDateMatch;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

async function loadRepoPublishDate(folderRecord) {
  const repoInfo = inferGitHubRepo();

  if (!repoInfo || !folderRecord.file) {
    return "";
  }

  const postPath = `blogs_posts/${folderRecord.folder}/${folderRecord.file}`;
  const response = await fetch(
    `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/commits?path=${encodeURIComponent(postPath)}&per_page=100`
  );

  if (!response.ok) {
    return "";
  }

  const commits = await response.json();

  if (!Array.isArray(commits) || commits.length === 0) {
    return "";
  }

  const firstCommit = commits[commits.length - 1];
  return formatPostDate(firstCommit?.commit?.author?.date);
}

async function getPublishDate(folderRecord, markdown) {
  try {
    const repoPublishDate = await loadRepoPublishDate(folderRecord);

    if (repoPublishDate) {
      return repoPublishDate;
    }
  } catch (error) {
    console.error(error);
  }

  return formatPostDate(getRawPostDate(markdown));
}

function normalizeFolderRecord(record) {
  const folder = record.folder || record.name || "";
  const file = record.file || record.entry || "";

  return {
    folder,
    file,
    title: record.title || "",
    date: record.date || record.Date || "",
    description: record.description || "",
    markdown: record.markdown || ""
  };
}

function buildFallbackMarkdown(record) {
  const fields = [
    ["title", record.title],
    ["Date", record.date],
    ["description", record.description]
  ].filter(([, value]) => value);

  if (!fields.length) {
    return record.markdown || "";
  }

  const frontMatter = fields
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `---\n${frontMatter}\n---\n`;
}

function shouldIgnorePostFolder(folder) {
  return String(folder).trim().toLowerCase() === "template";
}

function getFallbackFolderPosts() {
  return fallbackPosts
    .map(normalizeFolderRecord)
    .filter((post) => post.folder && post.file)
    .filter((post) => !shouldIgnorePostFolder(post.folder))
    .sort((a, b) => a.folder.localeCompare(b.folder));
}

function inferGitHubRepo() {
  const { hostname, pathname } = window.location;

  if (!hostname.endsWith(".github.io")) {
    return null;
  }

  const owner = hostname.replace(/\.github\.io$/, "");
  const pathParts = pathname.split("/").filter(Boolean);
  const repo = pathParts.length > 0 ? pathParts[0] : `${owner}.github.io`;

  return { owner, repo };
}

async function discoverFolderEntry(repoInfo, folder) {
  const response = await fetch(
    `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/blogs_posts/${encodeURIComponent(folder)}`
  );

  if (!response.ok) {
    throw new Error(`Could not load folder ${folder}.`);
  }

  const items = await response.json();
  const markdownFile = items.find((item) => {
    const name = item.name.toLowerCase();
    return item.type === "file" && name.endsWith(".md") && name !== "header.md";
  });

  if (!markdownFile) {
    return null;
  }

  return {
    folder,
    file: markdownFile.name
  };
}

async function loadManifest() {
  try {
    const repoInfo = inferGitHubRepo();

    if (repoInfo) {
      const response = await fetch(
        `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/blogs_posts`
      );

      if (!response.ok) {
        throw new Error("Could not load blog folder from GitHub.");
      }

      const items = await response.json();
      const folders = items
        .filter((item) => item.type === "dir")
        .filter((item) => !shouldIgnorePostFolder(item.name))
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b));

      const records = await Promise.all(
        folders.map((folder) => discoverFolderEntry(repoInfo, folder))
      );

      return records.filter(Boolean);
    }
  } catch (error) {
    const fallbackRecords = getFallbackFolderPosts();

    if (fallbackRecords.length > 0) {
      return fallbackRecords.map(({ folder, file }) => ({ folder, file }));
    }
  }

  const fallbackRecords = getFallbackFolderPosts();

  if (fallbackRecords.length > 0) {
    return fallbackRecords.map(({ folder, file }) => ({ folder, file }));
  }

  throw new Error("No dynamic post source is available.");
}

async function loadMarkdownFile(folderRecord) {
  const { folder, file } = folderRecord;

  try {
    const response = await fetch(`blogs_posts/${folder}/${file}`);

    if (!response.ok) {
      throw new Error(`Could not load ${folder}/${file}`);
    }

    return await response.text();
  } catch (error) {
    const fallbackPost = getFallbackFolderPosts().find(
      (post) => post.folder === folder && post.file === file
    );

    if (fallbackPost?.markdown) {
      return fallbackPost.markdown;
    }

    throw error;
  }
}

function renderPreviewCard(folderRecord, markdown) {
  const { folder } = folderRecord;
  const lines = getPreviewLines(markdown);
  const title = getPostTitle(markdown, folder);
  const publishDate = formatPostDate(getRawPostDate(markdown));
  const publishDateHtml = publishDate
    ? `<p class="preview-date">publish date: ${publishDate}</p>`
    : "";
  const card = document.createElement("article");
  card.className = "preview-card";

  const linesHtml = lines
    .map((line) => `<p class="preview-line">${parseInlineMarkdown(line.replace(/^#\s+/, ""))}</p>`)
    .join("");

  card.innerHTML = `
    <a class="preview-link" href="${getCanonicalPagePath()}?post=${encodeURIComponent(folder)}" aria-label="Open ${escapeHtml(title)}">
      ${linesHtml}
      ${publishDateHtml}
    </a>
  `;

  return card;
}

function setBlogView(mode) {
  if (!blogListView || !blogPostView) {
    return;
  }

  const showPost = mode === "post";
  blogListView.hidden = showPost;
  blogPostView.hidden = !showPost;

  if (blogHeading) {
    blogHeading.hidden = showPost;
  }
}

async function loadBlogList() {
  if (!postList) {
    return;
  }

  try {
    const manifest = await loadManifest();

    if (manifest.length === 0) {
      postList.innerHTML = '<p class="status-message">No posts yet.</p>';
      return;
    }

    const loadedPosts = await Promise.all(
      manifest.map(async (record) => {
        let markdown = "";

        try {
          markdown = await loadMarkdownFile(record);
        } catch (error) {
          const fallbackPost = getFallbackFolderPosts().find(
            (post) => post.folder === record.folder && post.file === record.file
          );
          markdown = fallbackPost ? buildFallbackMarkdown(fallbackPost) : "";
        }

        return {
          record,
          markdown,
          dateValue: getPostDateValue(markdown)
        };
      })
    );

    loadedPosts.sort((a, b) => {
      if (b.dateValue !== a.dateValue) {
        return b.dateValue - a.dateValue;
      }

      return a.record.folder.localeCompare(b.record.folder);
    });

    const previews = loadedPosts.map(({ record, markdown }) => renderPreviewCard(record, markdown));

    postList.innerHTML = "";
    previews.forEach((preview) => postList.appendChild(preview));
  } catch (error) {
    postList.innerHTML = '<p class="status-message">Posts could not be loaded.</p>';
    console.error(error);
  }
}

async function loadSinglePost() {
  if (!postView) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const folder = params.get("post");

  if (!folder) {
    setBlogView("list");
    return;
  }

  try {
    setBlogView("post");
    setActiveTab("blog", false);
    const manifest = await loadManifest();
    const record = manifest.find((item) => item.folder === folder);

    if (!record) {
      throw new Error(`Could not find post folder ${folder}.`);
    }

    const markdown = await loadMarkdownFile(record);
    const title = getPostTitle(markdown, folder);
    const basePath = `blogs_posts/${record.folder}/`;
    const publishDate = await getPublishDate(record, markdown);
    const publishDateHtml = publishDate
      ? `<p class="post-meta">publish date: ${publishDate}</p>`
      : "";

    document.title = `${title} | Mason Lee`;
    postView.innerHTML = `
      <h2 class="post-title">${escapeHtml(title)}</h2>
      ${publishDateHtml}
      <p class="post-back"><a class="back-link" href="./#blog">Back to blog</a></p>
      <div class="post-content">${renderMarkdown(removePostHeader(markdown, title), basePath)}</div>
    `;
  } catch (error) {
    setBlogView("post");
    postView.innerHTML = '<p class="status-message">This post could not be loaded.</p>';
    console.error(error);
  }
}

loadBlogList();
loadSinglePost();
