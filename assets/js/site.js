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
    if (typeof window.gtag === "function") window.gtag("event", event, params || {});
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
              ? "You're subscribed — thank you!"
              : "Thank you. Andrew will follow up shortly.",
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

  onReady(function () {
    var forms = document.querySelectorAll("form[data-lead]");
    for (var i = 0; i < forms.length; i++) wireLeadForm(forms[i]);
    wireClickTracking();
  });
})();
