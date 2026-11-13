const GITHUB_USER = "spooky8823";

document.getElementById("year").textContent = new Date().getFullYear();

// Reveal sections as they enter the viewport.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
}

// Load the four latest contribution-style public events from GitHub.
// GitHub's public events API exposes a rolling window of public activity.
async function loadRecentActivity() {
  const container = document.getElementById("latest-activity");
  const contributionTypes = new Set([
    "PushEvent",
    "PullRequestEvent",
    "IssuesEvent",
    "IssueCommentEvent",
    "PullRequestReviewEvent",
    "PullRequestReviewCommentEvent",
    "CommitCommentEvent",
    "ReleaseEvent"
  ]);

  try {
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    if (!response.ok) throw new Error("GitHub activity is temporarily unavailable.");

    const events = await response.json();
    const contributions = events
      .filter((event) => contributionTypes.has(event.type))
      .slice(0, 4);

    if (!contributions.length) {
      container.innerHTML = '<p class="empty-state">No recent public contributions found in GitHub’s activity feed.</p>';
      return;
    }

    container.innerHTML = contributions.map((event) => {
      const info = describeEvent(event);
      const date = new Date(event.created_at);
      const dateText = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const repoName = escapeHTML(event.repo?.name || "GitHub");
      const repoUrl = event.repo?.name
        ? `https://github.com/${event.repo.name}`
        : "https://github.com/" + GITHUB_USER;

      return `
        <div class="activity-item">
          <a href="${repoUrl}" target="_blank" rel="noreferrer">
            <div class="activity-meta"><span>${info.kind}</span><time datetime="${date.toISOString()}">${dateText}</time></div>
            <div class="activity-title">${escapeHTML(info.title)}</div>
            <div class="activity-repo">${repoName}</div>
          </a>
        </div>
      `;
    }).join("");
  } catch (error) {
    container.innerHTML = '<p class="empty-state">Recent activity could not be loaded right now. The contribution graph and GitHub profile are still available above.</p>';
  }
}

function describeEvent(event) {
  const payload = event.payload || {};

  switch (event.type) {
    case "PushEvent": {
      const commits = payload.commits || [];
      const firstMessage = commits[0]?.message?.split("\n")[0];
      const count = payload.size || commits.length || 1;
      return {
        kind: "PUSH",
        title: firstMessage || `Pushed ${count} commit${count === 1 ? "" : "s"}`
      };
    }
    case "PullRequestEvent":
      return {
        kind: "PULL REQUEST",
        title: `${capitalize(payload.action || "updated")} pull request: ${payload.pull_request?.title || "Untitled"}`
      };
    case "IssuesEvent":
      return {
        kind: "ISSUE",
        title: `${capitalize(payload.action || "updated")} issue: ${payload.issue?.title || "Untitled"}`
      };
    case "IssueCommentEvent":
      return { kind: "COMMENT", title: "Commented on an issue" };
    case "PullRequestReviewEvent":
      return { kind: "REVIEW", title: `${capitalize(payload.action || "submitted")} a pull request review` };
    case "PullRequestReviewCommentEvent":
      return { kind: "REVIEW COMMENT", title: "Commented on a pull request review" };
    case "CommitCommentEvent":
      return { kind: "COMMIT COMMENT", title: "Commented on a commit" };
    case "ReleaseEvent":
      return { kind: "RELEASE", title: `Published release ${payload.release?.tag_name || ""}`.trim() };
    default:
      return { kind: "ACTIVITY", title: "Updated a GitHub project" };
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

loadRecentActivity();

// Ask GitHub for the actual language breakdown of standalone repositories.
// The Vibifiy monorepo language data represents the whole ecosystem, not each subproject.
async function loadRepositoryLanguages() {
  const languageCards = document.querySelectorAll("[data-repo-languages]");

  await Promise.all([...languageCards].map(async (card) => {
    const repository = card.dataset.repoLanguages;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USER}/${repository}/languages`,
        { headers: { Accept: "application/vnd.github+json" } }
      );

      if (!response.ok) throw new Error("Language data unavailable.");

      const languages = await response.json();
      const names = Object.keys(languages);

      if (!names.length) {
        card.innerHTML = '<span class="tag">No language data yet</span>';
        return;
      }

      card.innerHTML = names.map((name) =>
        `<span class="tag">${escapeHTML(name)}</span>`
      ).join("");
    } catch (error) {
      card.innerHTML = '<span class="tag">Language data unavailable</span>';
    }
  }));
}

loadRepositoryLanguages();
