/*
  Miller's Marketing Group — site script.

  Responsibilities:
    1. Submit the contact + newsletter forms to /api/lead (GHL webhook proxy).
    2. Send GA4 events (lead submits, Eventbrite clicks, primary CTA clicks)
       through the global gtag() that the gtag.js <head> snippet defines.
*/
(function () {
  "use strict";

  // --- Analytics events -----------------------------------------------------
  // GA4 (gtag.js) is loaded from the <head> snippet on every page; here we only
  // send custom events through the global gtag.
  function track(event, params) {
    // gtag.js is loaded from each page's <head> snippet. If it's missing
    // (blocked, failed, or a future page omits it), define the standard
    // fallback that queues onto dataLayer so events aren't silently dropped.
    if (typeof window.gtag !== "function") {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("event", event, params || {});
  }

  // --- Lead forms (contact + newsletter) → /api/lead ------------------------
  function serialize(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = value;
    });
    return data;
  }

  function setStatus(el, message, state) {
    if (!el) return;
    el.textContent = message;
    el.setAttribute("data-state", state || "");
  }

  function wireLeadForm(form) {
    var type = form.getAttribute("data-lead");
    var status = form.querySelector(".form-status");
    var button = form.querySelector('[type="submit"]');

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var honeypot = form.querySelector('[name="_gotcha"]');
      if (honeypot && honeypot.value) return;

      var payload = serialize(form);
      payload.form = type;
      payload.page = location.href;

      var label = button ? button.innerHTML : "";
      if (button) button.disabled = true;
      setStatus(status, "Sending…", "pending");

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          return res.json().catch(function () {
            return {};
          });
        })
        .then(function () {
          form.reset();
          setStatus(
            status,
            type === "newsletter"
              ? "You're subscribed - thank you!"
              : "Thank you for contacting Miller's Marketing Group. We will respond within 24 hours.",
            "success"
          );
          track("lead_submit", { lead_type: type });
        })
        .catch(function () {
          setStatus(
            status,
            "Something went wrong. Please email contact@millersmarketinggroup.com.",
            "error"
          );
        })
        .finally(function () {
          if (button) button.disabled = false;
        });
    });
  }

  // --- Outbound / CTA click tracking ----------------------------------------
  function wireClickTracking() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest("a") : null;
      if (!link || !link.href) return;
      if (/eventbrite\.com/i.test(link.href)) {
        track("eventbrite_click", { link_url: link.href });
      } else if (link.getAttribute("href") === "#contact") {
        track("cta_click", { cta: "talk_with_andrew" });
      }
    });
  }

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function wireCookieConsent() {
    var notice = document.querySelector("[data-cookie-consent]");
    var button = document.querySelector("[data-cookie-accept]");
    if (!notice || !button) return;
    try {
      if (localStorage.getItem("mmg_cookie_notice") === "accepted") return;
    } catch {
      /* ignore private browsing storage errors */
    }
    notice.classList.add("is-visible");
    button.addEventListener("click", function () {
      try {
        localStorage.setItem("mmg_cookie_notice", "accepted");
      } catch {
        /* ignore private browsing storage errors */
      }
      notice.classList.remove("is-visible");
    });
  }

  /*
    --- "Site last updated" ---------------------------------------------------

    Filled from document.lastModified, which reflects the Last-Modified header
    the host sends for this page. Vercel stamps every static file in a
    deployment with that deployment's build time, so the date moves on its own
    each time the site ships — no build step, no endpoint, nothing to remember
    to bump by hand.

    The markup ships hidden and is only revealed once a date is in hand. When
    a host sends no Last-Modified header the spec says document.lastModified
    falls back to the current time, which would quietly render "updated today"
    forever, so anything within a minute of now is treated as that fallback and
    the line stays hidden rather than showing a date we cannot stand behind.
  */
  function wireLastUpdated() {
    var wrap = document.querySelector("[data-site-updated]");
    var slot = document.querySelector("[data-site-updated-time]");
    if (!wrap || !slot) return;

    var modified = new Date(document.lastModified);
    if (isNaN(modified.getTime())) return;

    var age = Date.now() - modified.getTime();
    if (age < 60000 || age < 0) return;

    slot.setAttribute("datetime", modified.toISOString().slice(0, 10));
    slot.textContent = modified.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    wrap.hidden = false;
  }

  onReady(function () {
    var forms = document.querySelectorAll("form[data-lead]");
    for (var i = 0; i < forms.length; i++) wireLeadForm(forms[i]);
    wireClickTracking();
    wireCookieConsent();
    wireLastUpdated();
  });
})();
