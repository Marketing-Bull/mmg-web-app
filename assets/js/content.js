/*
  Renders Events and Sponsors from the synced JSON (data/events.json,
  data/sponsors.json) into the homepage grids. Progressive enhancement:
  if the JSON is missing or fails to load, the static cards already in the
  HTML remain as the fallback.
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

  function renderEvents() {
    var grid = document.querySelector(".upcoming-events-grid");
    if (!grid) return;
    fetchJSON("data/events.json")
      .then(function (data) {
        var list = (data && data.events ? data.events : []).filter(function (e) {
          return (e.status || "upcoming") === "upcoming" && e.title;
        });
        if (!list.length) return; // keep static fallback
        grid.innerHTML = list.map(eventCard).join("");
      })
      .catch(function () {
        /* keep static cards */
      });
  }

  function renderSponsors() {
    var grid = document.querySelector(".partners-grid");
    if (!grid) return;
    fetchJSON("data/sponsors.json")
      .then(function (data) {
        var list = (data && data.sponsors ? data.sponsors : []).filter(function (s) {
          return s.name;
        });
        if (!list.length) return;
        grid.innerHTML = list.map(sponsorCard).join("");
      })
      .catch(function () {
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
