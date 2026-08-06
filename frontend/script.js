// Talks to the live API: loads events on page load, and submits registrations.

const eventsListEl = document.getElementById("events-list");
const eventsCountEl = document.getElementById("events-count");
const eventSelectEl = document.getElementById("eventSelect");
const formEl = document.getElementById("register-form");
const messageEl = document.getElementById("form-message");

const registerBtn = document.getElementById("registerBtn");
const ticketSectionEl = document.getElementById("ticket-section");
const downloadTicketBtn = document.getElementById("downloadTicketBtn");
let currentTicket = null;

let cachedEvents = [];

// A curated set of green-family gradients, so every event banner looks
// intentional and on-brand, never a random unrelated photo.
const BANNER_GRADIENTS = [
  ["#0E4A2E", "#1F9257"],
  ["#0B3D24", "#2FB06A"],
  ["#123D2A", "#3ECF8E"],
  ["#154226", "#57C98A"],
];

// Simple hand-drawn line icons (no external dependency, no copyright risk).
// Picked per event by matching keywords in the event name, so the artwork
// always relates to what the event is actually about.
const ICONS = {
  cloud:
    '<path d="M7 18h10a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 7.1 9.1 4 4 0 0 0 7 18Z"/>',
  network:
    '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M7.7 7.4 10.5 16M16.3 7.4 13.5 16M8.2 6h7.6"/>',
  mic:
    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  shield:
    '<path d="M12 3 5 6v6c0 4.2 3 7.4 7 9 4-1.6 7-4.8 7-9V6l-7-3Z"/>',
  chip:
    '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  calendar:
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
};

function iconKeyFor(eventName) {
  const n = (eventName || "").toLowerCase();
  if (/cloud|aws|serverless|devops/.test(n)) return "cloud";
  if (/security|cyber|shield/.test(n)) return "shield";
  if (/media|broadcast|podcast|journalis/.test(n)) return "mic";
  if (/ai\b|artificial intelligence|data|innovation/.test(n)) return "chip";
  if (/summit|forum|leaders|network|conference/.test(n)) return "network";
  return "calendar";
}

async function loadEvents() {
  if (!API_BASE_URL || API_BASE_URL === "PASTE_YOUR_API_URL_HERE") {
    eventsListEl.innerHTML =
      "<p class='loading-text' style='color:#C0392B'>Set your API URL in frontend/config.js first.</p>";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/events`);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();
    cachedEvents = data.events || [];
    renderEventsList(cachedEvents);
    renderEventOptions(cachedEvents);
  } catch (err) {
    eventsListEl.innerHTML = `<p class="loading-text" style="color:#C0392B">Could not load events: ${escapeHtml(err.message)}</p>`;
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function gradientFor(eventName) {
  const pair = BANNER_GRADIENTS[hashString(eventName || "event") % BANNER_GRADIENTS.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function bannerSvg(eventName) {
  const iconKey = iconKeyFor(eventName);
  const path = ICONS[iconKey];
  // One large centered icon, plus the same icon tiled faintly across the
  // whole banner as a texture - a real icon-pattern instead of plain dots.
  return `
    <svg class="event-banner-svg" viewBox="0 0 320 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="tile-${iconKey}" width="46" height="46" patternUnits="userSpaceOnUse">
          <g stroke="#ffffff" stroke-opacity="0.16" stroke-width="1.4" fill="none" transform="translate(11,11) scale(0.9)">${path}</g>
        </pattern>
      </defs>
      <rect width="320" height="132" fill="url(#tile-${iconKey})" />
      <g stroke="#ffffff" stroke-opacity="0.92" stroke-width="1.6" fill="none" transform="translate(136,42) scale(2.1)">${path}</g>
    </svg>
  `;
}

function renderEventsList(events) {
  eventsCountEl.textContent = events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : "";

  if (events.length === 0) {
    eventsListEl.innerHTML = "<p class='loading-text'>No events yet &mdash; check back soon.</p>";
    return;
  }

  eventsListEl.innerHTML = events
    .map((e) => {
      const isFull = e.status === "Full";
      return `
      <article class="event-card">
        <div class="event-banner" style="background:${gradientFor(e.eventName)}">
          ${bannerSvg(e.eventName)}
          <span class="event-tag ${e.status}">${e.status}</span>
          <span class="event-date-pill">${formatDateShort(e.eventDate)}</span>
        </div>
        <div class="event-body">
          <p class="event-name">${escapeHtml(e.eventName)}</p>
          <p class="event-powered">Powered by EVNT&bull;DECK</p>
          ${e.venue ? `<p class="event-venue"><svg viewBox="0 0 24 24" class="icon-inline"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>${escapeHtml(e.venue)}</p>` : ""}
          ${e.description ? `<p class="event-desc">${escapeHtml(truncate(e.description, 92))}</p>` : ""}
          <button
            class="event-register-btn ${isFull ? "is-full" : ""}"
            data-event-id="${e.eventId}"
            ${isFull ? "disabled" : ""}
          >${isFull ? "Fully booked" : "Register"}</button>
        </div>
      </article>
    `;
    })
    .join("");

  eventsListEl.querySelectorAll(".event-register-btn:not(.is-full)").forEach((btn) => {
    btn.addEventListener("click", () => {
      eventSelectEl.value = btn.dataset.eventId;
      document.getElementById("register").scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("emailInput").focus({ preventScroll: true });
    });
  });
}

function renderEventOptions(events) {
  const options = events
    .filter((e) => e.status !== "Full")
    .map((e) => `<option value="${e.eventId}">${escapeHtml(e.eventName)}</option>`)
    .join("");

  eventSelectEl.innerHTML =
    `<option value="" disabled selected>Choose an event</option>` + options;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const eventId = eventSelectEl.value;
  const email = document.getElementById("emailInput").value.trim();

  if (!eventId || !email) {
    showMessage("Please choose an event and enter your email.", "error");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Registering...";

  try {
    const res = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || "Something went wrong.", "error");
    } else {
      showMessage(`You're registered for "${data.eventName}"! Confirmation sent.`, "success");
      const eventObj = cachedEvents.find((ev) => ev.eventId === eventId);
      currentTicket = {
        eventName: data.eventName,
        eventDate: eventObj ? eventObj.eventDate : "",
        venue: eventObj ? eventObj.venue : "",
        email,
        registrationId: data.registrationId || data.registrationID || data.id || "N/A",
  };
      showTicket(currentTicket);
      formEl.reset();
      loadEvents();
    }
  } catch (err) {
    showMessage(`Network error: ${err.message}`, "error");
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "Register \u2192";
  }
});

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = type;
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "\u2026";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function showTicket(ticket) {
  document.getElementById("ticketEventName").textContent = ticket.eventName;
  document.getElementById("ticketMeta").textContent =
    [formatDate(ticket.eventDate), ticket.venue].filter(Boolean).join(" \u2022 ");
  document.getElementById("ticketEmail").textContent = ticket.email;
  document.getElementById("ticketId").textContent = ticket.registrationId;
  ticketSectionEl.hidden = false;
  ticketSectionEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      ctx.fillText(line, x, lineY);
      line = word + " ";
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
}

function generateTicketCanvas(ticket) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 900, 380);
  grad.addColorStop(0, "#0E4A2E");
  grad.addColorStop(1, "#1F9257");
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, 900, 380, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 20, 20, 620, 340, 18);
  ctx.fill();

  ctx.fillStyle = "#0E4A2E";
  roundRect(ctx, 660, 20, 220, 340, 18);
  ctx.fill();

  ctx.fillStyle = "#F6F9F6";
  for (let y = 40; y < 360; y += 24) {
    ctx.beginPath();
    ctx.arc(650, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1A7A4C";
  ctx.font = "700 14px Arial";
  ctx.fillText("EVNT \u2022 DECK", 48, 60);

  ctx.fillStyle = "#12241A";
  ctx.font = "700 28px Arial";
  wrapText(ctx, ticket.eventName, 48, 105, 560, 34);

  ctx.fillStyle = "#667A6E";
  ctx.font = "500 15px Arial";
  ctx.fillText(
    [formatDate(ticket.eventDate), ticket.venue].filter(Boolean).join(" \u2022 "),
    48,
    195
  );

  ctx.fillStyle = "#12241A";
  ctx.font = "600 15px Arial";
  ctx.fillText("Registered: " + ticket.email, 48, 225);

  ctx.fillStyle = "#0E4A2E";
  ctx.fillRect(48, 300, 90, 24);
  ctx.fillStyle = "#A6E22E";
  ctx.font = "700 11px Arial";
  ctx.fillText("ADMIT ONE", 58, 316);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 12px Arial";
  ctx.fillText("TICKET ID", 690, 60);
  ctx.font = "700 15px monospace";
  wrapText(ctx, ticket.registrationId, 690, 90, 160, 20);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 11px Arial";
  ctx.fillText("Show this at", 690, 300);
  ctx.fillText("check-in", 690, 316);

  return canvas;
}

downloadTicketBtn.addEventListener("click", () => {
  if (!currentTicket) return;
  const canvas = generateTicketCanvas(currentTicket);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EVNTDECK-Ticket-${currentTicket.registrationId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    });
  });
loadEvents();
