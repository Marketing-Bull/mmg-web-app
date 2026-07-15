/*
  Renders Events and Sponsors on the homepage. Tries the live, editor-published
  feed first (/api/events, /api/sponsors — backed by Vercel Blob), then the
  committed seed JSON, then leaves the static HTML cards already in the page
  as a final fallback.
*/
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Allow only http(s) and site-relative URLs (block javascript:, etc.).
  function safeUrl(value) {
    var v = String(value || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v) || /^(\/|assets\/|data\/)/.test(v)) return v;
    return "";
  }

  // Parse from the YYYY-MM-DD prefix as a local date. Handles plain dates and
  // full ISO date-times (e.g. "2026-06-25T00:00:00Z") without timezone drift.
  function parseDate(value) {
    var m = String(value == null ? "" : value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function monthName(value) {
    var d = parseDate(value);
    return d ? d.toLocaleString("en-US", { month: "long" }) : "";
  }

  function dayNumber(value) {
    var d = parseDate(value);
    return d ? String(d.getDate()) : "";
  }

  function dateLabel(value) {
    var d = parseDate(value);
    return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  }

  function eventCard(ev) {
    var img = safeUrl(ev.image);
    var dated = !!parseDate(ev.date);
    var badge = dated
      ? '<div class="event-date"><strong>' +
        esc(dayNumber(ev.date)) +
        "</strong><span>" +
        esc(monthName(ev.date)) +
        "</span></div><span class=\"flyer-label\">Event flyer</span>"
      : '<span class="event-series-label">' + esc(ev.type || "Monthly series") + "</span>";

    // Dated events show type • city; recurring events show their cadence.
    var meta = dated
      ? [ev.type, ev.city].filter(Boolean).map(esc).join(" &bull; ")
      : esc(ev.cadence || ev.type || "");
    var register = safeUrl(ev.registerUrl);
    var actions = register
      ? '<div class="event-actions"><a class="button button-primary" href="' +
        esc(register) +
        '" target="_blank" rel="noreferrer">' +
        esc(ev.registerLabel || "Register on Eventbrite") +
        "</a></div>"
      : "";

    return (
      '<article class="event-card">' +
      '<div class="event-card-image flyer">' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(ev.title) + ' flyer" />' : "") +
      badge +
      "</div>" +
      '<div class="event-card-body">' +
      (meta ? "<small>" + meta + "</small>" : "") +
      "<h3>" + esc(ev.title) + "</h3>" +
      (ev.summary ? "<p>" + esc(ev.summary) + "</p>" : "") +
      actions +
      "</div></article>"
    );
  }

  function pastEventCard(ev) {
    var img = safeUrl(ev.image);
    var recapUrl = safeUrl(ev.recapUrl);
    var recapImage = safeUrl(ev.recapImage);
    var meta = [dateLabel(ev.date), ev.city].filter(Boolean).map(esc).join(" &bull; ");
    var tags = String(ev.recapMeta || "Flyer archive, Community recap, Sponsor recognition")
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);

    return (
      '<article class="past-event-card">' +
      '<div class="past-event-media">' +
      '<div class="past-flyer">' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(ev.title) + ' flyer" />' : "") +
      '<span class="flyer-label">Original flyer</span></div>' +
      (recapUrl
        ? '<a class="past-video" href="' +
          esc(recapUrl) +
          '" target="_blank" rel="noreferrer" aria-label="View recap for ' +
          esc(ev.title) +
          '">' +
          (recapImage ? '<img src="' + esc(recapImage) + '" alt="" />' : "") +
          '<span class="play-button" aria-hidden="true">▶</span><span class="video-label">' +
          esc(ev.recapLabel || "Watch event recaps") +
          "</span></a>"
        : "") +
      "</div>" +
      '<div class="past-event-body">' +
      (meta ? "<small>" + meta + "</small>" : "") +
      "<h3>" + esc(ev.title) + "</h3>" +
      (ev.summary ? "<p>" + esc(ev.summary) + "</p>" : "") +
      (tags.length
        ? '<div class="recap-meta">' +
          tags.map(function (tag) {
            return "<span>" + esc(tag) + "</span>";
          }).join("") +
          "</div>"
        : "") +
      '<a class="text-link" href="#events">See the next gathering <span class="arrow">→</span></a>' +
      "</div></article>"
    );
  }

  function sponsorCard(s) {
    var logo = safeUrl(s.logo);
    var inner =
      (logo ? '<img src="' + esc(logo) + '" alt="' + esc(s.name) + '" loading="lazy" />' : "") +
      "<figcaption>" + esc(s.name) + "</figcaption>";
    var url = safeUrl(s.url);
    if (url) {
      return (
        '<figure class="partner-card"><a href="' +
        esc(url) +
        '" target="_blank" rel="noreferrer" style="display:contents">' +
        inner +
        "</a></figure>"
      );
    }
    return '<figure class="partner-card">' + inner + "</figure>";
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }

  // Try the live API first, then the committed seed. Returns the first
  // source that yields a non-empty array under `key`.
  function loadFirst(urls, key) {
    var i = 0;
    function tryNext() {
      if (i >= urls.length) return Promise.reject(new Error("no data"));
      var url = urls[i++];
      return fetchJSON(url).then(function (data) {
        var list = data && Array.isArray(data[key]) ? data[key] : [];
        return list.length ? list : tryNext();
      }, tryNext);
    }
    return tryNext();
  }

  function renderEvents() {
    var upcomingGrid = document.querySelector(".upcoming-events-grid");
    var pastGrid = document.querySelector(".past-events-grid");
    if (!upcomingGrid && !pastGrid) return;
    loadFirst(["/api/events", "data/events.json"], "events").then(function (list) {
      var up = list.filter(function (e) {
        return (e.status || "upcoming") === "upcoming" && e.title;
      });
      var past = list.filter(function (e) {
        return e.status === "past" && e.title;
      });
      if (upcomingGrid && up.length) upcomingGrid.innerHTML = up.map(eventCard).join("");
      if (pastGrid && past.length) pastGrid.innerHTML = past.map(pastEventCard).join("");
    }, function () {
      /* keep static cards */
    });
  }

  function renderSponsors() {
    var grid = document.querySelector(".partners-grid");
    if (!grid) return;
    loadFirst(["/api/sponsors", "data/sponsors.json"], "sponsors").then(function (list) {
      var s = list.filter(function (x) {
        return x.name;
      });
      if (s.length) grid.innerHTML = s.map(sponsorCard).join("");
    }, function () {
      /* keep static cards */
    });
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    renderEvents();
    renderSponsors();
  });
})();
