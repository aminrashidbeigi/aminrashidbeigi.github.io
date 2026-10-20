(function () {
  var root = document.documentElement;

  // Theme toggle (shares PaperMod's "pref-theme" key with the rest of the site).
  var themeBtn = document.querySelector("[data-theme-toggle]");
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("pref-theme", next); } catch (e) {}
    });
  }

  // Reveal on scroll.
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -40px 0px", threshold: 0.01 });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // Scroll spy for the sticky nav.
  var links = {};
  document.querySelectorAll(".toc .link").forEach(function (a) {
    links[a.getAttribute("href").slice(1)] = a;
  });
  var active = null;
  function setActive(id) {
    if (active === id) return;
    if (active && links[active]) links[active].removeAttribute("aria-current");
    active = id;
    var link = id && links[id];
    if (link) {
      link.setAttribute("aria-current", "true");
      var list = link.closest("ol");
      var left = link.offsetLeft - list.clientWidth / 2 + link.clientWidth / 2;
      list.scrollTo({ left: left, behavior: "smooth" });
    }
  }
  if ("IntersectionObserver" in window) {
    var spyObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll("[data-spy]").forEach(function (s) { spyObs.observe(s); });
  }

  // Reading progress bar.
  var bar = document.querySelector(".progress");
  var ticking = false;
  function updateProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.transform = "scaleX(" + p + ")";
    if (window.scrollY < 200) setActive(null);
    // At the very bottom nothing can scroll further into view, so show the rest.
    if (max - window.scrollY < 4) revealEls.forEach(function (el) { el.classList.add("in"); });
    ticking = false;
  }
  if (bar) {
    window.addEventListener("scroll", function () {
      if (!ticking) { requestAnimationFrame(updateProgress); ticking = true; }
    }, { passive: true });
    updateProgress();
  }

  // Lightbox for diagrams and screenshots.
  var dialog = document.querySelector(".lightbox");
  if (dialog && typeof dialog.showModal === "function") {
    var lbImg = dialog.querySelector("img");
    var lbScroll = dialog.querySelector(".lb-scroll");
    document.querySelectorAll(".zoom").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var img = btn.querySelector("img");
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        dialog.classList.toggle("is-wide", btn.hasAttribute("data-wide"));
        dialog.showModal();
        lbScroll.scrollLeft = 0;
      });
    });
    dialog.querySelector(".lb-close").addEventListener("click", function () { dialog.close(); });
    lbScroll.addEventListener("click", function (e) {
      if (e.target === lbScroll) dialog.close();
    });
  }
})();
