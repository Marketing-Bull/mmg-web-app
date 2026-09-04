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

  // Allow only hex colours (#abc / #aabbcc), so an editor-supplied value can
  // never smuggle extra declarations into the inline style attribute.
  function safeColor(value) {
    var v = String(value || "").trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : "";
  }

  // Relative luminance of a hex colour, used to decide whether a logo tile
  // needs light text on top of it.
  function isDarkColor(hex) {
    var v = hex.slice(1);
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    var n = parseInt(v, 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
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
    // The "Event flyer" caption is only true when there is a flyer. A date
    // announced before its artwork exists keeps the date badge on the card's
    // own backdrop rather than labelling an empty panel.
    var badge = dated
      ? '<div class="event-date"><strong>' +
        esc(dayNumber(ev.date)) +
        "</strong><span>" +
        esc(monthName(ev.date)) +
        "</span></div>" +
        (img ? '<span class="flyer-label">Event flyer</span>' : "")
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
    // Without recapMeta the tags used to be a fixed list promising a flyer and
    // a recap whether or not either existed. Derive the default from what the
    // event actually has, so a card never advertises something that isn't there.
    var defaultTags = [img ? "Flyer archive" : "", recapUrl ? "Video recap" : "", "Sponsor recognition"]
      .filter(Boolean)
      .join(", ");
    var tags = String(ev.recapMeta || defaultTags)
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);

    // The badge over the flyer names the city the event was held in — more
    // use to a visitor than restating that the image is a flyer. Dropped
    // entirely when an event has no city rather than falling back to a label.
    var flyer = img
      ? '<div class="past-flyer"><img src="' + esc(img) + '" alt="' + esc(ev.title) +
        ' flyer" />' +
        (ev.city ? '<span class="flyer-label">' + esc(ev.city) + "</span>" : "") +
        "</div>"
      : "";
    var recap = recapUrl
      ? '<a class="past-video" href="' +
        esc(recapUrl) +
        '" target="_blank" rel="noreferrer" aria-label="View recap for ' +
        esc(ev.title) +
        '">' +
        (recapImage ? '<img src="' + esc(recapImage) + '" alt="" />' : "") +
        '<span class="play-button" aria-hidden="true">▶</span><span class="video-label">' +
        esc(ev.recapLabel || "Watch event recaps") +
        "</span></a>"
      : "";
    // An event whose flyer or recap hasn't been added yet would otherwise
    // render an empty dark panel with a badge over nothing. Drop the media
    // strip entirely when there is nothing to show, and let a lone flyer or
    // recap use the full width instead of leaving a gap beside it.
    var media = flyer || recap
      ? '<div class="past-event-media' + (flyer && recap ? "" : " past-event-media-single") + '">' +
        flyer + recap + "</div>"
      : "";

    return (
      '<article class="past-event-card">' +
      media +
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
    // `bg` is the logo artwork's own backdrop. Painting the tile that colour
    // makes the image blend into the card instead of sitting on it as a
    // visible rectangle, and keeps light-on-dark logos legible.
    var bg = safeColor(s.bg);
    var cls = "partner-card" + (bg && isDarkColor(bg) ? " partner-card-dark" : "");
    var style = bg ? ' style="--partner-bg:' + esc(bg) + '"' : "";
    var inner =
      (logo ? '<img src="' + esc(logo) + '" alt="' + esc(s.name) + '" loading="lazy" />' : "") +
      "<figcaption>" + esc(s.name) + "</figcaption>";
    var url = safeUrl(s.url);
    if (url) {
      return (
        '<figure class="' + cls + '"' + style + '><a href="' +
        esc(url) +
        '" target="_blank" rel="noreferrer" style="display:contents">' +
        inner +
        "</a></figure>"
      );
    }
    return '<figure class="' + cls + '"' + style + ">" + inner + "</figure>";
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

  /*
    --- Event structured data ------------------------------------------

    schema.org Event JSON-LD for the upcoming events, so a search engine can
    read the date, venue and registration link rather than inferring them
    from the cards.

    It is emitted here rather than written into index.html because the events
    that matter are published from the content manager straight to Blob,
    without a deploy. Static markup would describe whatever was last
    committed, which is exactly the case where the schema would be wrong, and
    stale structured data is worse than none. Building it from the same list
    that renders the cards keeps the two in step by construction, and only
    upcoming events are described, so a past date is never advertised.
  */
  var SITE_ORIGIN = "https://www.millersmarketinggroup.com";

  function absoluteUrl(value) {
    var url = safeUrl(value);
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return SITE_ORIGIN + "/" + url.replace(/^\/+/, "");
  }

  // The site's events are all local to one timezone, but the UTC offset for
  // a date depends on daylight saving, so it is read per event rather than
  // hard-coded. Returns e.g. "-04:00", or "" if the browser can't say.
  function zoneOffset(dateKey) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "longOffset",
      }).formatToParts(new Date(dateKey + "T12:00:00Z"));
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type !== "timeZoneName") continue;
        var match = /GMT([+-]\d{2}:\d{2})/.exec(parts[i].value);
        return match ? match[1] : "";
      }
    } catch (err) {
      /* fall through to a date-only value */
    }
    return "";
  }

  // A wall-clock time is only worth publishing with its offset attached;
  // without one it would be read as UTC and land five hours out. Falls back
  // to the plain date, which schema.org accepts.
  function eventDateTime(dateKey, time) {
    if (!/^\d{1,2}:\d{2}$/.test(String(time || ""))) return dateKey;
    var offset = zoneOffset(dateKey);
    if (!offset) return dateKey;
    var padded = String(time).length === 4 ? "0" + time : String(time);
    return dateKey + "T" + padded + ":00" + offset;
  }

  function schemaType(event) {
    var type = String(event.type || "").toLowerCase();
    if (type.indexOf("lunch") !== -1 || type.indexOf("learn") !== -1 || type.indexOf("educat") !== -1) {
      return "EducationEvent";
    }
    return "BusinessEvent";
  }

  function eventSchema(event) {
    var dateKey = eventDateKey(event.date);
    if (!dateKey || !event.title) return null;

    var node = {
      "@context": "https://schema.org",
      "@type": schemaType(event),
      name: event.title,
      startDate: eventDateTime(dateKey, event.startTime),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      organizer: {
        "@type": "Organization",
        name: "Miller's Marketing Group",
        url: SITE_ORIGIN + "/",
      },
    };

    var endDate = eventDateTime(dateKey, event.endTime);
    if (event.endTime && endDate !== dateKey) node.endDate = endDate;
    if (event.summary) node.description = event.summary;

    var image = absoluteUrl(event.image);
    if (image) node.image = image;

    var register = safeUrl(event.registerUrl);
    node.url = /^https?:\/\//i.test(register) ? register : SITE_ORIGIN + "/#events";

    // Only the venue and city are stored, so the address stays at that.
    // Naming a region we don't hold would be a guess, and a wrong one the
    // first time MMG runs an event outside Florida.
    if (event.venue || event.city) {
      var place = { "@type": "Place", name: event.venue || event.city };
      var address = { "@type": "PostalAddress", addressCountry: "US" };
      if (event.city) address.addressLocality = event.city;
      place.address = address;
      node.location = place;
    }

    return node;
  }

  function renderEventSchema(list) {
    var nodes = [];
    list.forEach(function (event) {
      if (currentEventStatus(event) !== "upcoming") return;
      var node = eventSchema(event);
      if (node) nodes.push(node);
    });

    var el = document.querySelector("[data-event-schema]");
    if (!nodes.length) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-event-schema", "");
      document.head.appendChild(el);
    }
    // Escape "<" so a summary containing markup can't close this script tag.
    el.textContent = JSON.stringify(nodes.length === 1 ? nodes[0] : nodes).replace(/</g, "\\u003c");
  }

  function renderEvents() {
    var upcomingGrid = document.querySelector(".upcoming-events-grid");
    var pastGrid = document.querySelector(".past-events-grid");
    if (!upcomingGrid && !pastGrid) return;
    loadFirst(["/api/events", "data/events.json"], "events").then(function (list) {
      var up = list.filter(function (e) {
        return currentEventStatus(e) === "upcoming" && e.title;
      });
      var past = list.filter(function (e) {
        return currentEventStatus(e) === "past" && e.title;
      });
      if (upcomingGrid) upcomingGrid.innerHTML = up.length ? up.map(eventCard).join("") : upcomingEmptyState();
      if (pastGrid && past.length) pastGrid.innerHTML = past.map(pastEventCard).join("");
      renderEventSchema(list);
    }, function () {
      /* keep static cards */
    });
  }

  function eventDateKey(value) {
    var match = String(value == null ? "" : value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
  }

  function floridaDateKey() {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) {
      values[part.type] = part.value;
    });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function currentEventStatus(event) {
    var date = eventDateKey(event.date);
    if (!date) return "undated";
    return date < floridaDateKey() ? "past" : "upcoming";
  }

  function upcomingEmptyState() {
    return (
      '<div class="events-empty">' +
      "<strong>New event dates are coming soon.</strong>" +
      "<p>Follow MMG on Eventbrite to be the first to see the next gathering.</p>" +
      '<a class="button button-ghost" href="https://www.eventbrite.com/o/millers-marketing-group-68684991773" target="_blank" rel="noreferrer">View Eventbrite <span class="arrow">→</span></a>' +
      "</div>"
    );
  }

  /*
    Eases the sponsor tiles in as the grid scrolls into view, a row at a
    time. Hover does the work on a desktop; this is what gives the wall some
    life on a phone, where there is no hover at all.

    Only tiles still below the fold are hidden, so nothing the visitor is
    already looking at flashes out and back. Re-runnable: the grid is
    replaced wholesale when the live feed arrives, so this is called again
    on the new tiles.
  */
  var partnerObserver = null;

  function revealPartners() {
    var grid = document.querySelector(".partners-grid");
    if (!grid || !("IntersectionObserver" in window)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (partnerObserver) partnerObserver.disconnect();

    var pending = [].slice.call(grid.querySelectorAll(".partner-card")).filter(function (card) {
      return card.getBoundingClientRect().top > window.innerHeight * 0.9;
    });
    if (!pending.length) return;

    partnerObserver = new IntersectionObserver(
      function (entries, observer) {
        // Stagger within the batch that crossed the line together, rather
        // than by index in the grid: a fixed per-card delay would make the
        // last row wait most of a second after it is already on screen.
        entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return (
              a.boundingClientRect.top - b.boundingClientRect.top ||
              a.boundingClientRect.left - b.boundingClientRect.left
            );
          })
          .forEach(function (entry, i) {
            entry.target.style.transitionDelay = i * 55 + "ms";
            entry.target.classList.remove("partner-card-pending");
            observer.unobserve(entry.target);
          });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );

    pending.forEach(function (card) {
      card.classList.add("partner-card-pending");
      partnerObserver.observe(card);
    });
  }

  function renderSponsors() {
    var grid = document.querySelector(".partners-grid");
    if (!grid) return;
    loadFirst(["/api/sponsors", "data/sponsors.json"], "sponsors").then(function (list) {
      var s = list.filter(function (x) {
        return x.name;
      });
      if (s.length) {
        grid.innerHTML = s.map(sponsorCard).join("");
        revealPartners();
      }
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
    // Covers the static grid too: if the sponsor feed is unreachable those
    // cards stay on the page, and they should still animate in.
    revealPartners();
  });
})();
