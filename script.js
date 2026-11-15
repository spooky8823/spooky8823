const GITHUB_USER = "spooky8823";
const API_ROOT = "https://api.github.com";
const API_HEADERS = { Accept: "application/vnd.github+json" };
let portfolioRepos = [];
let githubEvents = [];
let githubCommits = [];

document.getElementById("year").textContent = new Date().getFullYear();

let revealObserver;
if ("IntersectionObserver" in window) {
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
}
function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.visible)").forEach((element) => {
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add("visible");
  });
}
observeReveals();

async function github(path) {
  const response = await fetch(`${API_ROOT}${path}`, { headers: API_HEADERS });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}
function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function repoIsMinecraft(repo) {
  const searchable = [repo.name, repo.description, ...(repo.topics || [])].join(" ").toLowerCase();
  return /minecraft|fabric|forge|modrinth|spigot|paper.?mc/.test(searchable);
}
async function loadPortfolio() {
  const projects = document.getElementById("projects-grid");
  const activity = document.getElementById("latest-activity");
  try {
    const response = await fetch("./data/github-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Portfolio data returned ${response.status}`);
    const data = await response.json();
    const languageResults = Array.isArray(data.repositories) ? data.repositories : [];
    portfolioRepos = languageResults.map((item) => item.repo);
    githubEvents = Array.isArray(data.events) ? data.events : [];
    githubCommits = Array.isArray(data.commits) ? data.commits : [];
    if (!languageResults.length) {
      projects.innerHTML = '<p class="empty-state">Repository data is being prepared. Please refresh in a few minutes.</p>';
    } else {
      renderProjects(languageResults);
      observeReveals(projects);
    }
    await loadLatestCommits();
  } catch (error) {
    console.error("Could not load the published GitHub data:", error);
    projects.innerHTML = '<p class="empty-state">GitHub data is temporarily unavailable. The site will update when its scheduled data refresh succeeds.</p>';
    if (activity) activity.innerHTML = '<p class="empty-state">GitHub activity data is temporarily unavailable. Please try again after the next data refresh.</p>';
  }
}
function languageBreakdown(languages) {
  const entries = Object.entries(languages || {}).filter(([, bytes]) => Number(bytes) > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + Number(bytes), 0);
  if (!total) return { bar: '<div class="language-bar language-bar-empty"></div>', labels: '<span class="language-empty">No language data</span>' };
  const segments = entries.map(([name, bytes]) => ({ name, percentage: Number(bytes) / total * 100, color: LANGUAGE_COLORS[name] || "#8b949e" }));
  const bar = `<div class="language-bar" role="img" aria-label="${segments.map(item => `${escapeHTML(item.name)} ${item.percentage.toFixed(1)} percent`).join(", ")}">${segments.map(item => `<span class="language-segment" style="width:${item.percentage}%;background-color:${item.color}" title="${escapeHTML(item.name)} ${item.percentage.toFixed(1)}%"></span>`).join("")}</div>`;
  const labels = `<div class="language-legend">${segments.map(item => `<span class="language-legend-item"><i style="--language-color:${item.color}"></i><b>${escapeHTML(item.name)}</b><small>${item.percentage.toFixed(1)}%</small></span>`).join("")}</div>`;
  return { bar, labels };
}
const LANGUAGE_COLORS = {
  "Rust": "#dea584", "JavaScript": "#f1e05a", "TypeScript": "#3178c6", "C++": "#f34b7d", "C": "#555555", "C#": "#178600", "CSS": "#563d7c",
  "HTML": "#e34c26", "Python": "#3572A5", "Java": "#b07219", "Shell": "#89e051", "CMake": "#DA3434", "Batchfile": "#C1F12E",
  "Inno Setup": "#264b99", "Go": "#00ADD8", "Kotlin": "#A97BFF", "Swift": "#F05138", "Ruby": "#701516", "PHP": "#4F5D95",
  "Dart": "#00B4AB", "Lua": "#000080", "PowerShell": "#012456", "Markdown": "#083fa1", "Vue": "#41b883", "Svelte": "#ff3e00",
  "Objective-C": "#438eff", "Makefile": "#427819", "Perl": "#0298c3", "R": "#198CE7", "Scala": "#c22d40", "Dockerfile": "#384d54",
  "Jupyter Notebook": "#DA5B0B", "Assembly": "#6E4C13"
};
function renderProjects(items) {
  const container = document.getElementById("projects-grid");
  container.innerHTML = items.map(({ repo, languages }, index) => {
    const minecraft = repoIsMinecraft(repo);
    const breakdown = languageBreakdown(languages);
    const description = repo.description || "An open-source project. Check the repository for its current README, source code, and development details.";
    const topics = (repo.topics || []).slice(0, 5);
    const topicTags = topics.map((topic) => `<span class="tag topic-tag">${escapeHTML(topic)}</span>`).join("");
    const projectClass = minecraft ? "project project-minecraft reveal" : "project reveal";
    const minecraftArt = minecraft ? '<div class="grass-block" role="img" aria-label="Pixel-art Minecraft grass block"><span class="grass-top"></span><span class="grass-side"></span><span class="grass-front"></span></div>' : "";
    const heading = minecraft ? `<div class="minecraft-heading"><div><h3>${escapeHTML(repo.name)}</h3><p>${escapeHTML(description)}</p></div>${minecraftArt}</div>` : `<h3>${escapeHTML(repo.name)}</h3><p>${escapeHTML(description)}</p>`;
    const updated = formatDate(repo.pushed_at);
    const url = repo.html_url || `https://github.com/${GITHUB_USER}/${encodeURIComponent(repo.name)}`;
    return `<article class="${projectClass}"><div class="project-top"><span>${minecraft ? "Minecraft project" : "Public repository"}</span><span class="project-mark">${String(index + 1).padStart(2, "0")}</span></div>${heading}<div class="project-details"><span class="detail-label">Languages</span>${breakdown.bar}${breakdown.labels}${topicTags ? `<span class="detail-label">Topics</span><div class="tags">${topicTags}</div>` : ""}<span class="repo-updated">Last pushed ${escapeHTML(updated)}</span></div><div class="project-bottom"><a class="project-link" href="${escapeHTML(url)}" target="_blank" rel="noreferrer">Explore repository ↗</a></div></article>`;
  }).join("");
}
// Technologies are intentionally a static Skill Icons grid matching the profile README.
function renderStack() {}
function renderCommitItems(container, commits, emptyMessage) {
  if (!commits.length) {
    container.innerHTML = `<p class="empty-state">${escapeHTML(emptyMessage)}</p>`;
    return;
  }
  container.innerHTML = commits.map((item) => {
    const message = item.message || item.commit?.message?.split("\n")[0] || "Commit";
    const date = item.date || item.commit?.committer?.date || item.commit?.author?.date;
    const url = item.url || item.html_url || item.repository?.html_url || "#";
    const repo = item.repo || item.repository?.full_name || item.repository?.name || "";
    return `<article class="activity-item"><a href="${escapeHTML(url)}" target="_blank" rel="noreferrer"><div class="activity-meta"><span>COMMIT</span><time>${escapeHTML(formatDate(date))}</time></div><div class="activity-title">${escapeHTML(message)}</div><div class="activity-repo">${escapeHTML(repo)}</div></a></article>`;
  }).join("");
}
let latestCommitsRefreshStarted = false;
let latestCommitsRequestInFlight = false;

async function loadLatestCommits() {
  const container = document.getElementById("latest-activity");
  const heading = document.getElementById("activity-heading");
  if (!container || latestCommitsRequestInFlight) return;
  latestCommitsRequestInFlight = true;

  // This panel is specifically the latest commits in this portfolio repository.
  // Read the commits endpoint directly so the scheduled JSON snapshot cannot
  // leave the list showing yesterday's commit messages.
  if (heading) heading.textContent = "Latest 4 commits.";
  try {
    const commits = await github(`/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_USER)}/commits?per_page=10`);
    const ownCommits = (Array.isArray(commits) ? commits : [])
      .filter((item) => {
        const author = item.author?.login || item.committer?.login;
        return !author || author.toLowerCase() === GITHUB_USER.toLowerCase();
      })
      .map((item) => ({
        message: item.commit?.message?.split("\\n")[0] || "Commit",
        date: item.commit?.committer?.date || item.commit?.author?.date,
        url: item.html_url,
        repo: `${GITHUB_USER}/${GITHUB_USER}`
      }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 4);

    if (ownCommits.length) {
      renderCommitItems(container, ownCommits, "No public commits were found.");
    } else {
      renderCommitItems(container, githubCommits.slice(0, 4), "No public commits were found.");
    }
  } catch (error) {
    console.warn("Could not load live repository commits; using the saved snapshot.", error);
    const fallback = [...githubCommits]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 4);
    renderCommitItems(container, fallback, "Live commits are temporarily unavailable. Check GitHub for the latest history.");
  } finally {
    latestCommitsRequestInFlight = false;
  }

  if (!latestCommitsRefreshStarted) {
    latestCommitsRefreshStarted = true;
    window.setInterval(() => {
      if (document.visibilityState === "visible") loadLatestCommits();
    }, 120000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") loadLatestCommits();
    });
  }
}
async function loadCommitsForDate(dateKey, selectedCell) {
  const container = document.getElementById("latest-activity");
  const heading = document.getElementById("activity-heading");
  if (!container) return;

  document.querySelectorAll("#grid-cells .cell[aria-pressed='true']").forEach((cell) => {
    cell.setAttribute("aria-pressed", "false");
    cell.classList.remove("selected");
  });
  selectedCell?.setAttribute("aria-pressed", "true");
  selectedCell?.classList.add("selected");

  const [year, month, day] = dateKey.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const label = selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (heading) heading.textContent = `Activity on ${label}.`;
  container.innerHTML = '<p class="empty-state">Loading activity for this date…</p>';

  // Use local calendar-day boundaries, converted to UTC for GitHub's API.
  // The published snapshot is intentionally not the source of truth for today's commits.
  const dayStart = new Date(year, month - 1, day).toISOString();
  const dayEnd = new Date(year, month - 1, day + 1).toISOString();
  const activities = githubCommits
    .filter((commit) => commit.date && new Date(commit.date) >= new Date(dayStart) && new Date(commit.date) < new Date(dayEnd))
    .map((commit) => ({
      type: "COMMIT", title: commit.message || "Commit", date: commit.date,
      url: commit.url, repo: commit.repo || ""
    }));

  githubEvents.filter((event) => {
    if (!event.created_at) return false;
    const eventDate = new Date(event.created_at);
    return eventDate >= new Date(dayStart) && eventDate < new Date(dayEnd);
  }).forEach((event) => {
    const repo = event.repo?.name || "";
    const repoUrl = repo ? `https://github.com/${repo}` : `https://github.com/${GITHUB_USER}`;
    if (event.type === "PushEvent") {
      (event.payload?.commits || []).forEach((commit) => {
        const url = commit.sha ? `${repoUrl}/commit/${commit.sha}` : repoUrl;
        if (!activities.some((item) => item.url === url)) activities.push({
          type: "COMMIT", title: commit.message?.split("\n")[0] || "Commit",
          date: event.created_at, url, repo
        });
      });
    } else if (event.type === "IssuesEvent" && event.payload?.action === "opened") {
      const issue = event.payload.issue;
      activities.push({ type: "ISSUE", title: issue?.title || "Opened an issue", date: event.created_at, url: issue?.html_url || repoUrl, repo });
    } else if (event.type === "PullRequestEvent" && event.payload?.action === "opened") {
      const pull = event.payload.pull_request;
      activities.push({ type: "PULL REQUEST", title: pull?.title || "Opened a pull request", date: event.created_at, url: pull?.html_url || repoUrl, repo });
    } else if (event.type === "PullRequestReviewEvent") {
      const pull = event.payload?.pull_request;
      activities.push({ type: "PULL REQUEST REVIEW", title: `Reviewed: ${pull?.title || "Pull request"}`, date: event.created_at, url: pull?.html_url || repoUrl, repo });
    }
  });

  // Fetch the selected day directly so commits made after the last JSON snapshot appear.
  try {
    const liveCommits = await github(
      `/repos/${encodeURIComponent(GITHUB_USER)}/${encodeURIComponent(GITHUB_USER)}/commits?since=${encodeURIComponent(dayStart)}&until=${encodeURIComponent(dayEnd)}&per_page=100`
    );
    (Array.isArray(liveCommits) ? liveCommits : []).forEach((item) => {
      const date = item.commit?.committer?.date || item.commit?.author?.date;
      const url = item.html_url;
      if (!date || !url || activities.some((activity) => activity.url === url)) return;
      activities.push({
        type: "COMMIT",
        title: item.commit?.message?.split("\n")[0] || "Commit",
        date,
        url,
        repo: `${GITHUB_USER}/${GITHUB_USER}`
      });
    });
  } catch (error) {
    console.warn("Live daily commit lookup failed; showing available snapshot activity.", error);
  }

  activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (!activities.length) {
    container.innerHTML = '<p class="empty-state">No public commits or recorded public activity were found for this date.</p>';
    return;
  }
  container.innerHTML = activities.map((item) =>
    `<article class="activity-item"><a href="${escapeHTML(item.url || "https://github.com/" + GITHUB_USER)}" target="_blank" rel="noreferrer"><div class="activity-meta"><span>${escapeHTML(item.type)}</span><time>${escapeHTML(formatDate(item.date))}</time></div><div class="activity-title">${escapeHTML(item.title)}</div><div class="activity-repo">${escapeHTML(item.repo)}</div></a></article>`
  ).join("");
}
async function loadContributionGraph() {
  const container = document.getElementById("contribution-graph");
  const gridEl = document.getElementById("grid-cells");
  const monthsEl = document.getElementById("months-row");
  const tooltipEl = document.getElementById("graph-tooltip");
  if (!container || !gridEl || !monthsEl) return;
  if (tooltipEl && tooltipEl.parentElement !== document.body) document.body.appendChild(tooltipEl);
  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`);
    if (!response.ok) throw new Error("Contribution data unavailable");
    const payload = await response.json();
    const contributions = payload.contributions || [];
    if (!contributions.length) throw new Error("No contribution days returned");
    const byDate = new Map(contributions.map(day => [day.date, day]));
    const WEEKS = 53, DAYS = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Anchor the final column to the current Sunday-Saturday week.
    // Starting 52 weeks before this Sunday keeps exactly 53 columns
    // while ensuring today's square is always included at the far right.
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    const startDate = new Date(currentWeekStart);
    startDate.setDate(currentWeekStart.getDate() - (WEEKS - 1) * DAYS);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let lastMonth = -1;
    monthsEl.innerHTML = "";
    gridEl.innerHTML = "";
    for (let week = 0; week < WEEKS; week++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + week * DAYS);
      const monthSpan = document.createElement("span");
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const firstOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
      const nextMonthFirst = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
      const labelMonth = week === 0 ? weekStart.getMonth() : firstOfMonth >= weekStart && firstOfMonth <= weekEnd ? weekStart.getMonth() : nextMonthFirst >= weekStart && nextMonthFirst <= weekEnd ? nextMonthFirst.getMonth() : null;
      if (labelMonth !== null && labelMonth !== lastMonth) {
        monthSpan.textContent = monthNames[labelMonth];
        lastMonth = labelMonth;
      }
      monthsEl.appendChild(monthSpan);
      for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const contribution = byDate.get(dateKey);
        const count = date > today ? 0 : Number(contribution?.count) || 0;
        const level = date > today ? 0 : Math.max(0, Math.min(4, Number(contribution?.level) || 0));
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.level = String(level);
        cell.setAttribute("role", "button");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("aria-pressed", "false");
        const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const message = `${count} contribution${count === 1 ? "" : "s"} on ${formattedDate}`;
        cell.setAttribute("aria-label", message);
        const positionTooltip = (pointerEvent) => {
          if (!tooltipEl) return;
          const rect = cell.getBoundingClientRect();
          const x = pointerEvent?.clientX ?? (rect.left + rect.width / 2);
          const y = pointerEvent?.clientY ?? (rect.top + rect.height / 2);
          tooltipEl.textContent = message;
          tooltipEl.classList.add("visible");
          tooltipEl.style.left = "0px";
          tooltipEl.style.top = "0px";
          const tipRect = tooltipEl.getBoundingClientRect();
          const gap = 14;
          let left = x + gap, top = y + gap;
          if (left + tipRect.width > window.innerWidth - 10) left = x - tipRect.width - gap;
          if (top + tipRect.height > window.innerHeight - 10) top = y - tipRect.height - gap;
          tooltipEl.style.left = `${Math.max(10, left)}px`;
          tooltipEl.style.top = `${Math.max(10, top)}px`;
        };
        const hideTooltip = () => {
          if (cell.getAttribute("aria-pressed") !== "true") tooltipEl?.classList.remove("visible");
        };
        const selectCell = () => {
          // A graph selection must update the activity panel as well as the tooltip.
          loadCommitsForDate(dateKey, cell);
          positionTooltip();
        };
        cell.addEventListener("mouseenter", positionTooltip);
        cell.addEventListener("mousemove", positionTooltip);
        cell.addEventListener("focus", () => positionTooltip());
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("blur", hideTooltip);
        cell.addEventListener("click", selectCell);
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectCell();
          }
        });
        gridEl.appendChild(cell);
      }
    }
    const graphWrapper = gridEl.closest(".graph-wrapper");
    if (graphWrapper) {
      const scrollToLatest = () => {
        const maxScroll = Math.max(0, graphWrapper.scrollWidth - graphWrapper.clientWidth);
        graphWrapper.scrollTo({ left: maxScroll, behavior: "instant" });
      };
      requestAnimationFrame(() => requestAnimationFrame(scrollToLatest));
      setTimeout(scrollToLatest, 120);
    }
    const total = Number(payload.total?.lastYear) || contributions.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
    container.setAttribute("aria-label", `${total} GitHub contributions in the last year`);
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Contribution graph is temporarily unavailable. View the live graph on GitHub.</p>';
  }
}
loadContributionGraph();
loadPortfolio();
