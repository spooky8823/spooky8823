const GITHUB_USER = "spooky8823";
const API_ROOT = "https://api.github.com";
const API_HEADERS = { Accept: "application/vnd.github+json" };
let portfolioRepos = [];

document.getElementById("year").textContent = new Date().getFullYear();

// Reveal static and dynamically-added sections.
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
  const searchable = [
    repo.name,
    repo.description,
    ...(repo.topics || [])
  ].join(" ").toLowerCase();
  return /minecraft|fabric|forge|modrinth|spigot|paper.?mc/.test(searchable);
}

// Load actual repository metadata. Renames, new repositories, descriptions,
// default branches and detected language stacks all come from GitHub at runtime.
async function loadPortfolio() {
  const projects = document.getElementById("projects-grid");
  const stack = document.getElementById("stack-grid");

  try {
    const allRepos = await github(`/users/${GITHUB_USER}/repos?type=owner&sort=pushed&per_page=100`);
    const repos = allRepos
      .filter((repo) => !repo.fork && !repo.archived && !repo.private)
      .sort((a, b) => new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0));

    if (!repos.length) {
      projects.innerHTML = '<p class="empty-state">No public repositories found.</p>';
      stack.innerHTML = "";
      return;
    }

    // Language data is retrieved per repository, then combined for the overall stack.
    const languageResults = await Promise.all(repos.map(async (repo) => {
      try {
        const languages = await github(`/repos/${GITHUB_USER}/${encodeURIComponent(repo.name)}/languages`);
        return { repo, languages };
      } catch {
        return { repo, languages: {} };
      }
    }));

    portfolioRepos = repos;
    renderProjects(languageResults.slice(0, 8));
    renderStack(languageResults);
    await loadLatestCommits(repos);
    observeReveals(projects);
    observeReveals(stack);
  } catch (error) {
    projects.innerHTML = '<p class="empty-state">Could not load repositories from GitHub right now. Refresh the page to try again.</p>';
    stack.innerHTML = '<p class="empty-state">Repository language data is temporarily unavailable.</p>';
    document.getElementById("latest-activity").innerHTML =
      '<p class="empty-state">Could not load commits. Your GitHub profile is still available from the link above.</p>';
  }
}

// GitHub Linguist language colors for common repository languages.
const LANGUAGE_COLORS = {
  "Rust": "#dea584", "JavaScript": "#f1e05a", "TypeScript": "#3178c6",
  "C++": "#f34b7d", "C": "#555555", "C#": "#178600", "CSS": "#563d7c",
  "HTML": "#e34c26", "Python": "#3572A5", "Java": "#b07219",
  "Shell": "#89e051", "CMake": "#DA3434", "Batchfile": "#C1F12E",
  "Inno Setup": "#264b99", "Go": "#00ADD8", "Kotlin": "#A97BFF",
  "Swift": "#F05138", "Ruby": "#701516", "PHP": "#4F5D95",
  "Dart": "#00B4AB", "Lua": "#000080", "PowerShell": "#012456",
  "Markdown": "#083fa1", "Vue": "#41b883", "Svelte": "#ff3e00",
  "Objective-C": "#438eff", "Makefile": "#427819", "Perl": "#0298c3",
  "R": "#198CE7", "Scala": "#c22d40", "Dockerfile": "#384d54",
  "Jupyter Notebook": "#DA5B0B", "Assembly": "#6E4C13"
};

function languageBreakdown(languages) {
  const entries = Object.entries(languages || {})
    .filter(([, bytes]) => Number(bytes) > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + Number(bytes), 0);
  if (!total) return { bar: '<div class="language-bar language-bar-empty"></div>', labels: '<span class="language-empty">No language data</span>' };

  const segments = entries.map(([name, bytes]) => {
    const percentage = Number(bytes) / total * 100;
    const color = LANGUAGE_COLORS[name] || "#8b949e";
    return { name, percentage, color };
  });

  const bar = `<div class="language-bar" role="img" aria-label="${segments.map(item => `${escapeHTML(item.name)} ${item.percentage.toFixed(1)} percent`).join(", ")}">${segments.map(item =>
    `<span class="language-segment" style="width:${item.percentage}%;background-color:${item.color}" title="${escapeHTML(item.name)} ${item.percentage.toFixed(1)}%"></span>`
  ).join("")}</div>`;

  const labels = `<div class="language-legend">${segments.map(item =>
    `<span class="language-legend-item"><i style="--language-color:${item.color}"></i><b>${escapeHTML(item.name)}</b><small>${item.percentage.toFixed(1)}%</small></span>`
  ).join("")}</div>`;
  return { bar, labels };
}

function renderProjects(items) {
  const container = document.getElementById("projects-grid");
  container.innerHTML = items.map(({ repo, languages }, index) => {
    const minecraft = repoIsMinecraft(repo);
    const breakdown = languageBreakdown(languages);
    const description = repo.description || "An open-source project. Check the repository for its current README, source code, and development details.";
    const topics = (repo.topics || []).slice(0, 5);
    const topicTags = topics.map((topic) => `<span class="tag topic-tag">${escapeHTML(topic)}</span>`).join("");
    const projectClass = minecraft ? "project project-minecraft reveal" : "project reveal";
    const minecraftArt = minecraft
      ? '<div class="grass-block" role="img" aria-label="Pixel-art Minecraft grass block"><span class="grass-top"></span><span class="grass-side"></span><span class="grass-front"></span></div>'
      : "";
    const heading = minecraft
      ? `<div class="minecraft-heading"><div><h3>${escapeHTML(repo.name)}</h3><p>${escapeHTML(description)}</p></div>${minecraftArt}</div>`
      : `<h3>${escapeHTML(repo.name)}</h3><p>${escapeHTML(description)}</p>`;
    const updated = formatDate(repo.pushed_at);
    const url = repo.html_url || `https://github.com/${GITHUB_USER}/${encodeURIComponent(repo.name)}`;

    return `
      <article class="${projectClass}">
        <div class="project-top"><span>${minecraft ? "Minecraft project" : "Public repository"}</span><span class="project-mark">${String(index + 1).padStart(2, "0")}</span></div>
        ${heading}
        <div class="project-details">
          <span class="detail-label">Languages</span>
          ${breakdown.bar}
          ${breakdown.labels}
          ${topicTags ? `<span class="detail-label">Topics</span><div class="tags">${topicTags}</div>` : ""}
          <span class="repo-updated">Last pushed ${escapeHTML(updated)}</span>
        </div>
        <div class="project-bottom"><a class="project-link" href="${escapeHTML(url)}" target="_blank" rel="noreferrer">Explore repository ↗</a></div>
      </article>
    `;
  }).join("");
}

function renderStack(items) {
  const totals = {};
  items.forEach(({ languages }) => {
    Object.entries(languages).forEach(([name, bytes]) => {
      totals[name] = (totals[name] || 0) + bytes;
    });
  });
  const breakdown = languageBreakdown(totals);
  const container = document.getElementById("stack-grid");
  if (!Object.keys(totals).length) {
    container.innerHTML = '<p class="empty-state">No language statistics are available yet.</p>';
    return;
  }
  container.innerHTML = `
    <article class="stack-card stack-card-wide reveal">
      <h3>Languages across public repositories</h3>
      ${breakdown.bar}
      ${breakdown.labels}
      <p class="stack-caption">Language proportions are calculated from GitHub's detected source-code bytes across your public repositories.</p>
    </article>
  `;
}

function renderCommitItems(container, commits, emptyMessage) {
  if (!commits.length) {
    container.innerHTML = `<p class="empty-state">${escapeHTML(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = commits.map((item) => {
    const message = item.commit?.message?.split("\n")[0] || "Commit";
    const date = item.commit?.committer?.date || item.commit?.author?.date;
    const url = item.html_url || item.repository?.html_url || "#";
    return `
      <article class="activity-item">
        <a href="${escapeHTML(url)}" target="_blank" rel="noreferrer">
          <div class="activity-meta"><span>COMMIT</span><time>${escapeHTML(formatDate(date))}</time></div>
          <div class="activity-title">${escapeHTML(message)}</div>
          <div class="activity-repo">${escapeHTML(item.repository?.full_name || item.repository?.name || "")}</div>
        </a>
      </article>
    `;
  }).join("");
}

async function loadLatestCommits(repos) {
  const container = document.getElementById("latest-activity");
  const heading = document.getElementById("activity-heading");
  try {
    const commitLists = await Promise.all(repos.map(async (repo) => {
      try {
        const commits = await github(`/repos/${GITHUB_USER}/${encodeURIComponent(repo.name)}/commits?per_page=1`);
        return commits.map((commit) => ({ ...commit, repository: repo }));
      } catch {
        return [];
      }
    }));

    const latest = commitLists.flat()
      .sort((a, b) => new Date(b.commit?.committer?.date || b.commit?.author?.date || 0) -
                      new Date(a.commit?.committer?.date || a.commit?.author?.date || 0))
      .slice(0, 4);

    if (heading) heading.textContent = "Latest 4 commits.";
    renderCommitItems(container, latest, "No recent commits found in your public repositories.");
  } catch {
    container.innerHTML = '<p class="empty-state">Latest commits are temporarily unavailable. Check your GitHub profile for the full history.</p>';
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

  const selectedDate = new Date(`${dateKey}T12:00:00`);
  const label = selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (heading) heading.textContent = `Activity on ${label}.`;
  container.innerHTML = '<p class="loading-state">Loading all GitHub activity for this date…</p>';

  const queryDate = encodeURIComponent(dateKey);
  const nextDay = new Date(`${dateKey}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDateKey = nextDay.toISOString().slice(0, 10);

  try {
    // GitHub's contribution graph includes commits, opened issues, pull
    // requests and submitted reviews. Query each public activity type rather
    // than treating the commits endpoint as the complete contribution list.
    const [commitsResult, authoredResult, reviewedResult] = await Promise.all([
      github(`/search/commits?q=${encodeURIComponent(`author:${GITHUB_USER} committer-date:${dateKey}..${dateKey}`)}&per_page=100`),
      github(`/search/issues?q=author:${GITHUB_USER}+created:${queryDate}&per_page=100`),
      github(`/search/issues?q=reviewed-by:${GITHUB_USER}+is:pr+updated:${queryDate}&per_page=100`)
    ]);

    const activities = [];
    (commitsResult.items || []).forEach((commit) => {
      activities.push({
        type: "COMMIT",
        title: commit.commit?.message?.split("\n")[0] || "Commit",
        date: commit.commit?.committer?.date || commit.commit?.author?.date,
        url: commit.html_url,
        repo: commit.repository?.full_name || ""
      });
    });

    (authoredResult.items || []).forEach((item) => {
      activities.push({
        type: item.pull_request ? "PULL REQUEST" : "ISSUE",
        title: item.title || (item.pull_request ? "Pull request" : "Issue"),
        date: item.created_at,
        url: item.html_url,
        repo: item.repository_url?.split("/").slice(-2).join("/") || ""
      });
    });

    // Search finds PRs reviewed by this account that were active on the
    // selected date; inspect their review timestamps so unrelated updates
    // are not displayed as reviews for this day.
    const reviewedPulls = reviewedResult.items || [];
    const reviewLists = await Promise.all(reviewedPulls.slice(0, 50).map(async (pull) => {
      try {
        const match = pull.repository_url?.match(/repos\/(.+)$/);
        if (!match) return [];
        const reviews = await github(`/repos/${match[1]}/pulls/${pull.number}/reviews?per_page=100`);
        return reviews
          .filter((review) => review.user?.login?.toLowerCase() === GITHUB_USER.toLowerCase()
            && review.submitted_at?.slice(0, 10) === dateKey)
          .map((review) => ({
            type: "PULL REQUEST REVIEW",
            title: `Reviewed: ${pull.title || "Pull request"}`,
            date: review.submitted_at,
            url: review.html_url || pull.html_url,
            repo: pull.repository_url?.split("/").slice(-2).join("/") || ""
          }));
      } catch {
        return [];
      }
    }));
    activities.push(...reviewLists.flat());

    activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (!activities.length) {
      container.innerHTML = '<p class="empty-state">No public GitHub contributions were found for this date.</p>';
      return;
    }

    container.innerHTML = activities.map((item) => `
      <article class="activity-item">
        <a href="${escapeHTML(item.url || "https://github.com/" + GITHUB_USER)}" target="_blank" rel="noreferrer">
          <div class="activity-meta"><span>${escapeHTML(item.type)}</span><time>${escapeHTML(formatDate(item.date))}</time></div>
          <div class="activity-title">${escapeHTML(item.title)}</div>
          <div class="activity-repo">${escapeHTML(item.repo)}</div>
        </a>
      </article>
    `).join("");
  } catch (error) {
    console.error("Could not load GitHub activity for selected date:", error);
    container.innerHTML = '<p class="empty-state">GitHub activity could not be loaded. This is an API error, not confirmation that the day had no contributions. Please try again later.</p>';
  }
}

// Render a responsive, rounded-cell contribution calendar from live public data.
async function loadContributionGraph() {
  const container = document.getElementById("contribution-graph");
  const gridEl = document.getElementById("grid-cells");
  const monthsEl = document.getElementById("months-row");
  const tooltipEl = document.getElementById("graph-tooltip");
  if (!container || !gridEl || !monthsEl) return;

  // Keep the fixed tooltip outside animated/reveal sections. A transformed
  // ancestor changes the containing block for position: fixed and offsets it.
  if (tooltipEl && tooltipEl.parentElement !== document.body) {
    document.body.appendChild(tooltipEl);
  }

  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`);
    if (!response.ok) throw new Error("Contribution data unavailable");
    const payload = await response.json();
    const contributions = payload.contributions || [];
    if (!contributions.length) throw new Error("No contribution days returned");

    const byDate = new Map(contributions.map(day => [day.date, day]));
    const WEEKS = 53;
    const DAYS = 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (WEEKS * DAYS - 1));
    startDate.setDate(startDate.getDate() - startDate.getDay());

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
      // Label a month above the week containing its 1st day, not the
      // following Sunday. Otherwise months beginning Mon-Sat appear a
      // whole column late and activity looks like it belongs to the next month.
      const labelMonth = week === 0
        ? weekStart.getMonth()
        : weekEnd.getMonth() !== weekStart.getMonth()
          ? weekEnd.getMonth()
          : null;
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
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-pressed", "false");
        const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const message = `${count} contribution${count === 1 ? "" : "s"} on ${formattedDate}`;
        cell.setAttribute("aria-label", `${message}. Select to view commits from this date.`);
        // Keep the accessible label, but omit the native title tooltip.
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
          let left = x + gap;
          let top = y + gap;
          if (left + tipRect.width > window.innerWidth - 10) left = x - tipRect.width - gap;
          if (top + tipRect.height > window.innerHeight - 10) top = y - tipRect.height - gap;
          tooltipEl.style.left = `${Math.max(10, left)}px`;
          tooltipEl.style.top = `${Math.max(10, top)}px`;
        };
        const hideTooltip = () => tooltipEl?.classList.remove("visible");
        cell.addEventListener("click", () => loadCommitsForDate(dateKey, cell));
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            loadCommitsForDate(dateKey, cell);
          }
        });
        cell.addEventListener("mouseenter", positionTooltip);
        cell.addEventListener("mousemove", positionTooltip);
        cell.addEventListener("focus", () => positionTooltip());
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("blur", hideTooltip);
        gridEl.appendChild(cell);
      }
    }

    // Keep the newest weeks (right edge) in view whenever the graph
    // overflows its wrapper, especially on narrow screens.
    const graphWrapper = gridEl.closest(".graph-wrapper");
    if (graphWrapper) {
      requestAnimationFrame(() => {
        graphWrapper.scrollLeft = graphWrapper.scrollWidth;
      });
    }

    const total = Number(payload.total?.lastYear) || contributions.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
    container.setAttribute("aria-label", `${total} GitHub contributions in the last year`);
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Contribution graph is temporarily unavailable. View the live graph on GitHub.</p>';
  }
}

loadContributionGraph();
loadPortfolio();
