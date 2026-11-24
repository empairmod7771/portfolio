(function () {
  const S = window.SITE || {};
  const ALL = (window.WORKS || []).filter(w => !w.hidden);
  ALL.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KIND = { short: "Shorts / Reels", long: "Ролик для YouTube", photo: "Фото" };
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const fmtDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ""; };
  const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "";
  const ytId = u => { const m = /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/.exec(u || ""); return m ? m[1] : (/^[\w-]{11}$/.test(u || "") ? u : ""); };
  const poster = w => w.poster || (ytId(w.youtube) ? `https://i.ytimg.com/vi/${ytId(w.youtube)}/hqdefault.jpg` : "");

  /* тексты из site.js */
  document.querySelectorAll("[data-site]").forEach(el => { el.textContent = S[el.dataset.site] || ""; });
  document.title = `${S.name ? S.name + " · " : ""}${S.role || "Портфолио"}`;
  $("#year").textContent = new Date().getFullYear();

  /* заголовок: буквы выезжают по одной, последнее слово красное */
  const h1 = $(".headline");
  const words = (S.headline || "").trim().split(/\s+/);
  let k = 0;
  h1.innerHTML = words.map((w, i) => `<span class="w${i === words.length - 1 && words.length > 1 ? " accent" : ""}">` +
    [...w].map(c => `<span class="ch" style="animation-delay:${(k++ * 0.03 + 0.1).toFixed(2)}s">${esc(c)}</span>`).join("") + "</span>").join(" ");
  h1.setAttribute("aria-label", S.headline || "");
  const fitH1 = () => {
    h1.style.fontSize = "";
    const max = Math.max(...[...h1.querySelectorAll(".w")].map(w => w.scrollWidth));
    const room = h1.clientWidth;
    if (max > room) h1.style.fontSize = parseFloat(getComputedStyle(h1).fontSize) * room / max * 0.97 + "px";
  };
  fitH1(); addEventListener("resize", fitH1);
  if (document.fonts) document.fonts.ready.then(fitH1);

  /* цифры — только из реальных работ */
  const by = t => ALL.filter(w => w.type === t);
  const mins = Math.round(ALL.reduce((a, w) => a + (w.duration || 0), 0) / 60);
  const stats = [[by("long").length, "длинных роликов"], [by("short").length, "Shorts и Reels"], [mins, "минут монтажа"], [by("photo").length, "фото"]]
    .filter(s => s[0] > 0);
  $("#stats").innerHTML = stats.map(s => `<li><b data-count="${s[0]}">0</b><span>${s[1]}</span></li>`).join("");
  document.querySelectorAll("[data-count]").forEach(el => {
    const end = +el.dataset.count, t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    setTimeout(() => requestAnimationFrame(step), 500);
  });

  /* ролик на первом экране */
  const heroW = ALL.find(w => w.type === "short" && w.featured) || by("short")[0] || by("long")[0];
  const reel = $("#heroReel");
  if (heroW && (heroW.video || heroW.preview)) {
    const v = $("video", reel);
    v.poster = poster(heroW);
    v.src = heroW.video || heroW.preview;
    v.play().catch(() => {});
    $(".hero-cap", reel).innerHTML = `<small>${heroW.type === "short" ? "Shorts" : "Ролик"} · смотреть со звуком</small>${esc(heroW.title)}`;
    reel.addEventListener("click", () => open(ALL.indexOf(heroW)));
  } else if (heroW && poster(heroW)) {
    $("video", reel).poster = poster(heroW);
    reel.addEventListener("click", () => open(ALL.indexOf(heroW)));
  } else reel.hidden = true;

  /* вкладки и сетки */
  const groups = ["long", "short", "photo"];
  const tabs = [["all", "Все", ALL.length], ["long", "Ролики", by("long").length], ["short", "Shorts", by("short").length], ["photo", "Фото", by("photo").length]]
    .filter(t => t[0] === "all" || t[2] > 0);
  $("#tabs").innerHTML = tabs.length > 2 ? tabs.map((t, i) =>
    `<button class="tab" role="tab" data-tab="${t[0]}" aria-selected="${i === 0}">${t[1]}<small>${t[2]}</small></button>`).join("") : "";
  const hoverable = matchMedia("(hover:hover)").matches;

  groups.forEach(g => {
    const list = by(g), box = $(`[data-group="${g}"]`);
    box.hidden = !list.length;
    $(".count", box).textContent = list.length;
    $(".grid", box).innerHTML = list.map(w => {
      const i = ALL.indexOf(w), img = poster(w);
      return `<button class="card reveal" type="button" data-i="${i}" aria-label="${esc(w.title)}">
        <span class="card-media">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}
          ${w.preview ? `<video muted loop playsinline preload="none" data-src="${esc(w.preview)}"></video>` : ""}
          ${w.featured ? `<span class="badge">Лучшее</span>` : ""}
          ${w.duration ? `<span class="dur">${fmtDur(w.duration)}</span>` : ""}
          ${w.type !== "photo" ? `<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z"/></svg></span>` : ""}
        </span>
        <span class="card-title">${esc(w.title)}</span>
        <span class="card-meta">${fmtDate(w.date)}</span>
      </button>`;
    }).join("");
  });
  $("#empty").hidden = ALL.length > 0;

  $("#tabs").addEventListener("click", e => {
    const t = e.target.closest(".tab"); if (!t) return;
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b === t));
    groups.forEach(g => { $(`[data-group="${g}"]`).hidden = !by(g).length || (t.dataset.tab !== "all" && t.dataset.tab !== g); });
  });

  document.querySelectorAll(".card").forEach(c => {
    c.addEventListener("click", () => open(+c.dataset.i));
    const v = $("video", c); if (!v || !hoverable) return;
    c.addEventListener("mouseenter", () => { if (!v.src) v.src = v.dataset.src; v.currentTime = 0; v.play().then(() => c.classList.add("playing")).catch(() => {}); });
    c.addEventListener("mouseleave", () => { v.pause(); c.classList.remove("playing"); });
  });

  /* просмотр работы */
  const lb = $("#lb"), box = $(".lb-box", lb), media = $("#lbMedia");
  let cur = -1, lastFocus = null;
  function open(i) {
    const w = ALL[i]; if (!w) return;
    if (cur < 0) lastFocus = document.activeElement;
    cur = i;
    box.classList.toggle("wide", w.type !== "short");
    const yt = ytId(w.youtube);
    media.innerHTML = yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(w.title)}"></iframe>`
      : w.type === "photo" ? `<img src="${esc(w.photo || w.poster)}" alt="${esc(w.title)}">`
      : `<video src="${esc(w.video)}" poster="${esc(w.poster || "")}" controls autoplay playsinline></video>`;
    $("#lbKind").textContent = [KIND[w.type], fmtDate(w.date), fmtDur(w.duration)].filter(Boolean).join(" · ");
    $("#lbTitle").textContent = w.title;
    $("#lbDesc").textContent = w.desc || "";
    $("#lbTags").innerHTML = (w.tags || []).map(t => `<li>${esc(t)}</li>`).join("");
    lb.hidden = false; document.body.classList.add("lock");
    $(".lb-x", lb).focus({ preventScroll: true });
  }
  function close() {
    media.innerHTML = ""; lb.hidden = true; cur = -1; document.body.classList.remove("lock");
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  const go = d => open((cur + d + ALL.length) % ALL.length);
  lb.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) { const cta = e.target.closest(".lb-cta"); close(); if (cta) location.hash = "#contact"; }
  });
  $(".lb-prev").addEventListener("click", () => go(-1));
  $(".lb-next").addEventListener("click", () => go(1));
  if (ALL.length < 2) document.querySelectorAll(".lb-nav").forEach(b => b.hidden = true);
  addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft" && e.target.tagName !== "VIDEO") go(-1);
    if (e.key === "ArrowRight" && e.target.tagName !== "VIDEO") go(1);
  });

  /* контакты */
  const ic = {
    tg: '<svg viewBox="0 0 24 24"><path d="M21.9 4.6l-3.2 15c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.3 1.4 11.8c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.6z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm9 7.2L4 7v1.9l8 5.1 8-5.1V7z"/></svg>',
    yt: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.8 15V9l5.8 3z"/></svg>',
    vk: '<svg viewBox="0 0 24 24"><path d="M12.8 18c-6.2 0-9.7-4.2-9.8-11.3h3.1c.1 5.2 2.4 7.4 4.2 7.8V6.7h2.9v4.5c1.8-.2 3.7-2.2 4.3-4.5h2.9a8.6 8.6 0 01-3.9 5.6 9 9 0 014.6 5.7h-3.2a5.6 5.6 0 00-4.7-4v4z"/></svg>',
    ph: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>'
  };
  const links = [];
  if (S.telegram) links.push(`<a class="main" href="https://t.me/${esc(S.telegram.replace(/^@|https?:\/\/t\.me\//g, ""))}" target="_blank" rel="noopener">${ic.tg}Написать в Telegram</a>`);
  if (S.email) links.push(`<a href="mailto:${esc(S.email)}">${ic.mail}${esc(S.email)}</a>`);
  if (S.phone) links.push(`<a href="tel:${esc(S.phone.replace(/[^\d+]/g, ""))}">${ic.ph}${esc(S.phone)}</a>`);
  if (S.youtube) links.push(`<a href="${esc(S.youtube)}" target="_blank" rel="noopener">${ic.yt}YouTube</a>`);
  if (S.vk) links.push(`<a href="${esc(S.vk)}" target="_blank" rel="noopener">${ic.vk}ВКонтакте</a>`);
  if (!links.length) links.push(`<a class="main" href="#works">Смотреть работы</a>`);
  $("#contactLinks").innerHTML = links.join("");
  $("#contactHint").hidden = !!(S.telegram || S.email || S.phone || S.youtube || S.vk) || !/^(file:|http:\/\/(localhost|127\.))/.test(location.href);

  /* появление при прокрутке и полоса прогресса */
  document.querySelectorAll(".sec-head,.steps li,.formats div,.flow div,.contact-in").forEach(el => el.classList.add("reveal"));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 0.06}s`; io.observe(el); });
  const bar = $(".progress i");
  const onScroll = () => { const h = document.documentElement; bar.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + "%"; };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
})();
