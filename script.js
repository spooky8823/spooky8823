const GITHUB_USER = "spooky8823";
const API_ROOT = "https://api.github.com";
const API_HEADERS = { Accept: "application/vnd.github+json" };

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

    renderProjects(languageResults.slice(0, 8));
    renderStack(languageResults);
    await loadLatestCommits(repos.slice(0, 12));
    observeReveals(projects);
    observeReveals(stack);
  } catch (error) {
    projects.innerHTML = '<p class="empty-state">Could not load repositories from GitHub right now. Refresh the page to try again.</p>';
    stack.innerHTML = '<p class="empty-state">Repository language data is temporarily unavailable.</p>';
    document.getElementById("latest-activity").innerHTML =
      '<p class="empty-state">Could not load commits. Your GitHub profile is still available from the link above.</p>';
  }
}

function renderProjects(items) {
  const container = document.getElementById("projects-grid");
  container.innerHTML = items.map(({ repo, languages }, index) => {
    const minecraft = repoIsMinecraft(repo);
    const languageNames = Object.keys(languages);
    const tags = languageNames.length
      ? languageNames.map((name) => `<span class="tag">${escapeHTML(name)}</span>`).join("")
      : '<span class="tag">No language data</span>';
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
          <span class="detail-label">Languages detected by GitHub</span>
          <div class="tags language-tags">${tags}</div>
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

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById("stack-grid");
  if (!sorted.length) {
    container.innerHTML = '<p class="empty-state">No language statistics are available yet.</p>';
    return;
  }

  container.innerHTML = `
    <article class="stack-card stack-card-wide reveal">
      <h3>Languages across public repositories</h3>
      <div class="tags language-tags">${sorted.map(([name]) => `<span class="tag">${escapeHTML(name)}</span>`).join("")}</div>
      <p class="stack-caption">Automatically aggregated from GitHub's language statistics. This list changes as your repositories and code change.</p>
    </article>
  `;
}

async function loadLatestCommits(repos) {
  const container = document.getElementById("latest-activity");
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

    if (!latest.length) {
      container.innerHTML = '<p class="empty-state">No recent commits found in your public repositories.</p>';
      return;
    }

    container.innerHTML = latest.map((item) => {
      const message = item.commit?.message?.split("\n")[0] || "Commit";
      const date = item.commit?.committer?.date || item.commit?.author?.date;
      const url = item.html_url || item.repository.html_url;
      return `
        <article class="activity-item">
          <a href="${escapeHTML(url)}" target="_blank" rel="noreferrer">
            <div class="activity-meta"><span>COMMIT</span><time>${escapeHTML(formatDate(date))}</time></div>
            <div class="activity-title">${escapeHTML(message)}</div>
            <div class="activity-repo">${escapeHTML(item.repository.full_name || item.repository.name)}</div>
          </a>
        </article>
      `;
    }).join("");
  } catch {
    container.innerHTML = '<p class="empty-state">Latest commits are temporarily unavailable. Check your GitHub profile for the full history.</p>';
  }
}

// Render a responsive, rounded-cell contribution calendar from live public data.
async function loadContributionGraph() {
  const container = document.getElementById("contribution-graph");
  if (!container) return;

  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`);
    if (!response.ok) throw new Error("Contribution data unavailable");
    const payload = await response.json();
    const days = payload.contributions || [];
    if (!days.length) throw new Error("No contribution days returned");

    const cell = 13;
    const gap = 4;
    const step = cell + gap;
    const left = 38;
    const top = 28;
    const width = left + Math.ceil(days.length / 7) * step + 4;
    const height = top + 7 * step + 20;
    const firstDate = new Date(days[0].date + "T00:00:00Z");
    const firstSundayOffset = firstDate.getUTCDay();
    const colors = ["level-0", "level-1", "level-2", "level-3", "level-4"];

    const cells = days.map((day) => {
      const date = new Date(day.date + "T00:00:00Z");
      const offset = Math.floor((date - firstDate) / 86400000) + firstSundayOffset;
      const column = Math.floor(offset / 7);
      const row = date.getUTCDay();
      const level = Math.max(0, Math.min(4, Number(day.level) || 0));
      const x = left + column * step;
      const y = top + row * step;
      const count = Number(day.count) || 0;
      return `<rect class="contrib-cell ${colors[level]}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" ry="3"><title>${escapeHTML(day.date)}: ${count} contributions</title></rect>`;
    }).join("");

    const monthLabels = [];
    let previousMonth = -1;
    days.forEach((day) => {
      const date = new Date(day.date + "T00:00:00Z");
      if (date.getUTCMonth() !== previousMonth) {
        const offset = Math.floor((date - firstDate) / 86400000) + firstSundayOffset;
        const column = Math.floor(offset / 7);
        monthLabels.push(`<text class="contrib-month" x="${left + column * step}" y="15">${date.toLocaleDateString("en", { month: "short", timeZone: "UTC" })}</text>`);
        previousMonth = date.getUTCMonth();
      }
    });

    const dayLabels = [
      { row: 1, label: "Mon" },
      { row: 3, label: "Wed" },
      { row: 5, label: "Fri" }
    ].map(({ row, label }) =>
      `<text class="contrib-day" x="0" y="${top + row * step + 10}">${label}</text>`
    ).join("");

    const total = Number(payload.total?.lastYear) || days.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${total} GitHub contributions in the last year">
        ${monthLabels.join("")}
        ${dayLabels}
        ${cells}
      </svg>
    `;
    container.setAttribute("aria-label", `${total} GitHub contributions in the last year`);
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Contribution graph is temporarily unavailable. View the live graph on GitHub.</p>';
  }
}

loadContributionGraph();
loadPortfolio();
