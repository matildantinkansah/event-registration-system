// This file does two things:
//   1. On page load, it calls GET /events and draws the "Available Events" list.
//   2. When the form is submitted, it calls POST /register.

const eventsListEl = document.getElementById("events-list");
const eventSelectEl = document.getElementById("eventSelect");
const formEl = document.getElementById("register-form");
const messageEl = document.getElementById("form-message");
const registerBtn = document.getElementById("registerBtn");

// Keep the full event objects around so we can show event names in the dropdown
let cachedEvents = [];

async function loadEvents() {
  if (API_BASE_URL === "PASTE_YOUR_API_URL_HERE") {
    eventsListEl.innerHTML =
      "<p style='color:#c0392b'>Set your API URL in frontend/config.js first.</p>";
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
    eventsListEl.innerHTML = `<p style="color:#c0392b">Could not load events: ${err.message}</p>`;
  }
}

function renderEventsList(events) {
  if (events.length === 0) {
    eventsListEl.innerHTML = "<p>No events yet.</p>";
    return;
  }

  eventsListEl.innerHTML = events
    .map(
      (e) => `
      <div class="event-row">
        <div class="event-info">
          <span class="event-name">${escapeHtml(e.eventName)}</span>
          <span class="event-date">${formatDate(e.eventDate)}</span>
        </div>
        <span class="badge ${e.status}">${e.status}</span>
      </div>
    `
    )
    .join("");
}

function renderEventOptions(events) {
  const options = events
    .filter((e) => e.status !== "Full")
    .map((e) => `<option value="${e.eventId}">${escapeHtml(e.eventName)}</option>`)
    .join("");

  eventSelectEl.innerHTML =
    `<option value="" disabled selected>Select an event</option>` + options;
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
      formEl.reset();
      loadEvents(); // refresh counts/badges
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
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

loadEvents();
