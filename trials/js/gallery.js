const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");

function setStatus(message, isError) {
  statusEl.hidden = !message;
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#9f1239" : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function thumbnailFor(site) {
  if (typeof site.thumbnail === "string" && site.thumbnail.trim()) {
    return site.thumbnail.trim();
  }
  return `${site.slug}/thumb.png`;
}

function renderEmpty() {
  gallery.innerHTML =
    '<p class="empty">No trial sites yet. Check back after the next class.</p>';
}

function renderSites(sites) {
  if (!Array.isArray(sites) || sites.length === 0) {
    renderEmpty();
    return;
  }

  gallery.innerHTML = sites
    .map((site) => {
      const slug = escapeHtml(site.slug || "");
      const name = escapeHtml(site.studentName || "Student");
      const title = escapeHtml(site.title || "Untitled site");
      const description = escapeHtml(site.description || "");
      const thumb = escapeHtml(thumbnailFor(site));
      const href = `${slug}/`;
      return `
        <a class="card" href="${href}">
          <img
            class="thumb"
            src="${thumb}"
            alt=""
            onerror="this.replaceWith(Object.assign(document.createElement('div'), { className: 'thumb thumb-fallback', textContent: 'Site' }))"
          />
          <div class="card-body">
            <p class="student">${name}</p>
            <h2 class="title">${title}</h2>
            ${description ? `<p class="description">${description}</p>` : ""}
            <span class="learn-more">Learn more →</span>
          </div>
        </a>
      `;
    })
    .join("");
}

async function loadGallery() {
  setStatus("Loading trial sites…");
  try {
    const response = await fetch("sites.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load sites.json (${response.status})`);
    }
    const sites = await response.json();
    setStatus("");
    renderSites(sites);
  } catch (error) {
    console.error(error);
    setStatus("The gallery could not load right now. Try refreshing.", true);
    renderEmpty();
  }
}

loadGallery();
