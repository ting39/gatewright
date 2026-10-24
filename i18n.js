// Tiny shared i18n for ting39 sites (copy this file into each repo; no build step).
// Languages: en, zh-TW, ja. Choice is shared across ting39.github.io via localStorage["ting39:lang"].
// Usage:
//   I18N.add({ en: { hi: "Hello {name}" }, "zh-TW": { hi: "你好，{name}" }, ja: { hi: "こんにちは、{name}" } });
//   I18N.t("hi", { name: "ting39" });
//   <span data-i18n="hi"></span>            -> textContent
//   <span data-i18n-html="key"></span>      -> innerHTML (only for our own trusted strings)
//   <input data-i18n-attr="placeholder:key;title:key2">
//   I18N.apply(document); I18N.onChange(() => rerender()); I18N.switcher(containerEl)
(function () {
  const LANGS = ["en", "zh-TW", "ja"];
  const LABELS = { en: "EN", "zh-TW": "中文", ja: "日本語" };
  const KEY = "ting39:lang";
  const dict = { en: {}, "zh-TW": {}, ja: {} };
  const listeners = [];

  function norm(l) {
    if (!l) return null;
    l = String(l).toLowerCase();
    if (l.startsWith("zh")) return "zh-TW";
    if (l.startsWith("ja")) return "ja";
    if (l.startsWith("en")) return "en";
    return null;
  }
  function detect() {
    try {
      const q = norm(new URLSearchParams(location.search).get("lang"));
      if (q) { save(q); return q; }
    } catch (e) {}
    try { const s = norm(localStorage.getItem(KEY)); if (s) return s; } catch (e) {}
    for (const l of navigator.languages || [navigator.language]) { const n = norm(l); if (n) return n; }
    return "en";
  }
  function save(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }

  let lang = detect();

  const I18N = {
    LANGS, LABELS,
    get lang() { return lang; },
    add(d) { for (const l of LANGS) Object.assign(dict[l], d[l] || {}); },
    has(key) { return key in dict.en || key in dict[lang]; },
    t(key, vars) {
      let s = dict[lang][key];
      if (s == null) s = dict.en[key];
      if (s == null) return key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
      return s;
    },
    set(l) {
      l = norm(l) || "en";
      if (l === lang) return;
      lang = l; save(l);
      I18N.apply(document);
      listeners.forEach((f) => { try { f(lang); } catch (e) { console.error(e); } });
    },
    onChange(f) { listeners.push(f); },
    apply(root) {
      root = root || document;
      document.documentElement.lang = lang === "zh-TW" ? "zh-Hant-TW" : lang;
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        let vars = null;
        if (el.dataset.i18nVars) { try { vars = JSON.parse(el.dataset.i18nVars); } catch (e) {} }
        el.textContent = I18N.t(el.dataset.i18n, vars);
      });
      // multilingual content blocks: show the reader's language, else English
      const groups = new Map();
      root.querySelectorAll("[data-lang-block]").forEach((el) => {
        const g = el.parentElement; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(el);
      });
      for (const els of groups.values()) {
        const has = els.some((e) => e.dataset.langBlock === lang);
        els.forEach((e) => { e.hidden = e.dataset.langBlock !== (has ? lang : "en"); });
      }
      root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = I18N.t(el.dataset.i18nHtml); });
      root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
        for (const pair of el.dataset.i18nAttr.split(";")) {
          const [attr, key] = pair.split(":").map((x) => x.trim());
          if (attr && key) el.setAttribute(attr, I18N.t(key));
        }
      });
      document.querySelectorAll(".i18n-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    },
    // A small EN / 中文 / 日本語 toggle. Style it per site via .i18n-switch.
    switcher(container) {
      const w = document.createElement("div");
      w.className = "i18n-switch";
      w.setAttribute("role", "group");
      w.setAttribute("aria-label", "Language / 語言 / 言語");
      for (const l of LANGS) {
        const b = document.createElement("button");
        b.type = "button"; b.dataset.lang = l; b.textContent = LABELS[l];
        b.lang = l === "zh-TW" ? "zh-Hant-TW" : l;
        b.setAttribute("aria-pressed", String(l === lang));
        b.addEventListener("click", () => I18N.set(l));
        w.appendChild(b);
      }
      container.appendChild(w);
      return w;
    },
  };
  window.I18N = I18N;
  document.documentElement.lang = lang === "zh-TW" ? "zh-Hant-TW" : lang;
})();
