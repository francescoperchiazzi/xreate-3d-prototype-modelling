(function(XR){
  XR.__modules = XR.__modules || {};

  XR.__modules.ShellI18n = XR.__modules.ShellI18n || {};
  XR.__modules.ShellI18n.create = function(opts){
    const translations = (opts && opts.translations) || {};
    const storageGet = (opts && typeof opts.storageGet === 'function') ? opts.storageGet : (() => null);
    const storageSet = (opts && typeof opts.storageSet === 'function') ? opts.storageSet : (() => false);
    const getEditorApi = (opts && typeof opts.getEditorApi === 'function') ? opts.getEditorApi : (() => null);
    const langSelect = (opts && opts.langSelect) || null;
    const isRestrictedOrigin = !!(opts && opts.isRestrictedOrigin);
    const cacheGet = (key) => {
      try {
        const stored = XR?.Storage?.getJSON?.(key);
        if (stored != null) return stored;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    };
    const cacheSet = (key, value) => {
      try {
        if (XR?.Storage?.setJSON) return XR.Storage.setJSON(key, value);
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (_) { return false; }
    };
    const rtlLangs = new Set(['ar', 'fa', 'he']);
    let currentLang = 'en';
    let fallbackEn = (translations.__fallback_en && typeof translations.__fallback_en === 'object')
      ? { ...translations.__fallback_en }
      : {};

    function hasFallbackEn() {
      return !!Object.keys(fallbackEn).length;
    }

    function t(key) {
      const dict = translations[currentLang]
        || ((currentLang === 'en' && hasFallbackEn()) ? fallbackEn : null)
        || translations.en
        || {};
      const fallback = translations.en || fallbackEn || {};
      const value = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
      if (value !== undefined && value !== null && value !== '') return String(value);
      const f = Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : undefined;
      if (f !== undefined && f !== null && f !== '') return String(f);
      return key;
    }

    async function loadTranslations() {
      try {
        let fallbackDict = null;
        if (!isRestrictedOrigin) {
          try {
            const json0 = cacheGet('translations_cache_v1');
            if (json0 && typeof json0 === 'object') {
              if (json0.__fallback_en && typeof json0.__fallback_en === 'object') {
                fallbackDict = json0.__fallback_en;
                fallbackEn = { ...fallbackEn, ...json0.__fallback_en };
              }
              for (const [lang, dict] of Object.entries(json0)) {
                if (lang === '__fallback_en') continue;
                if (!dict || typeof dict !== 'object') continue;
                translations[lang] = { ...(translations[lang] || {}), ...dict };
              }
            }
          } catch (_) {}
        }

        let json = null;
        const timeouts = [2500, 6000];
        for (const ms of timeouts) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ms);
            const res = await fetch('translations.json', { cache: 'no-store', signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) continue;
            json = await res.json();
            break;
          } catch (_) {}
        }
        if (!json || typeof json !== 'object') { try { XR?.devWarn?.('[XReate][i18n] translations.json not loaded'); } catch (_) {} return; }
        if (json.__fallback_en && typeof json.__fallback_en === 'object') {
          fallbackDict = json.__fallback_en;
          fallbackEn = { ...fallbackEn, ...json.__fallback_en };
        }
        for (const [lang, dict] of Object.entries(json)) {
          if (lang === '__fallback_en') continue;
          if (!dict || typeof dict !== 'object') continue;
          translations[lang] = { ...(translations[lang] || {}), ...dict };
        }
        if (hasFallbackEn()) {
          translations.en = { ...(translations.en || {}), ...fallbackEn };
        }
        if (fallbackDict) {
          for (const [, dict] of Object.entries(translations)) {
            if (!dict || typeof dict !== 'object') continue;
            for (const [k, v] of Object.entries(fallbackDict)) {
              if (!Object.prototype.hasOwnProperty.call(dict, k)) dict[k] = v;
            }
          }
        }
        try {
          const forced = {
            inspector_surface: (fallbackDict && fallbackDict.inspector_surface) ? fallbackDict.inspector_surface : 'Surface',
            inspector_shape: (fallbackDict && fallbackDict.inspector_shape) ? fallbackDict.inspector_shape : 'Volume',
            inspector_transform: (fallbackDict && fallbackDict.inspector_transform) ? fallbackDict.inspector_transform : 'Transform',
            scene_title: (fallbackDict && fallbackDict.scene_title) ? fallbackDict.scene_title : 'Composition',
            uv_wrap: (fallbackDict && fallbackDict.uv_wrap) ? fallbackDict.uv_wrap : 'UV mode',
            status_texture_applied: (fallbackDict && fallbackDict.status_texture_applied) ? fallbackDict.status_texture_applied : 'Surface applied',
            status_texture_mode_shared: (fallbackDict && fallbackDict.status_texture_mode_shared) ? fallbackDict.status_texture_mode_shared : 'Surface mode: shared',
            status_texture_mode_per_shape: (fallbackDict && fallbackDict.status_texture_mode_per_shape) ? fallbackDict.status_texture_mode_per_shape : 'Surface mode: per-volume',
            aria_uv_overlay: (fallbackDict && fallbackDict.aria_uv_overlay) ? fallbackDict.aria_uv_overlay : 'UV projection preview',
            texture_tools_label: (fallbackDict && fallbackDict.texture_tools_label) ? fallbackDict.texture_tools_label : 'Texture tools',
            tile_settings_label: (fallbackDict && fallbackDict.tile_settings_label) ? fallbackDict.tile_settings_label : 'Tile settings',
            perspective_correction_label: (fallbackDict && fallbackDict.perspective_correction_label) ? fallbackDict.perspective_correction_label : 'Perspective correction',
            pbr_map_gen_label: (fallbackDict && fallbackDict.pbr_map_gen_label) ? fallbackDict.pbr_map_gen_label : 'PBR map generator',
            retro_mode_label: (fallbackDict && fallbackDict.retro_mode_label) ? fallbackDict.retro_mode_label : 'Retro mode (PSX)',
            seamless_tile_label: (fallbackDict && fallbackDict.seamless_tile_label) ? fallbackDict.seamless_tile_label : 'Seamless tile',
            tile_scale_label: (fallbackDict && fallbackDict.tile_scale_label) ? fallbackDict.tile_scale_label : 'Tile scale',
            tile_anchor_label: (fallbackDict && fallbackDict.tile_anchor_label) ? fallbackDict.tile_anchor_label : 'Anchor',
            tile_repeat_label: (fallbackDict && fallbackDict.tile_repeat_label) ? fallbackDict.tile_repeat_label : 'Repeat',
            tile_repeat_repeat: (fallbackDict && fallbackDict.tile_repeat_repeat) ? fallbackDict.tile_repeat_repeat : 'Tile (repeat)',
            tile_repeat_mirror: (fallbackDict && fallbackDict.tile_repeat_mirror) ? fallbackDict.tile_repeat_mirror : 'Mirror',
            tile_repeat_clamp: (fallbackDict && fallbackDict.tile_repeat_clamp) ? fallbackDict.tile_repeat_clamp : 'Clamp (stretch edge)',
            tile_anchor_left: (fallbackDict && fallbackDict.tile_anchor_left) ? fallbackDict.tile_anchor_left : 'Left',
            tile_anchor_center: (fallbackDict && fallbackDict.tile_anchor_center) ? fallbackDict.tile_anchor_center : 'Center',
            tile_anchor_right: (fallbackDict && fallbackDict.tile_anchor_right) ? fallbackDict.tile_anchor_right : 'Right',
            tile_anchor_top: (fallbackDict && fallbackDict.tile_anchor_top) ? fallbackDict.tile_anchor_top : 'Top',
            tile_anchor_middle: (fallbackDict && fallbackDict.tile_anchor_middle) ? fallbackDict.tile_anchor_middle : 'Middle',
            tile_anchor_bottom: (fallbackDict && fallbackDict.tile_anchor_bottom) ? fallbackDict.tile_anchor_bottom : 'Bottom',
            img_tile_btn: (fallbackDict && fallbackDict.img_tile_btn) ? fallbackDict.img_tile_btn : 'Tiling',
            img_fill_btn: (fallbackDict && fallbackDict.img_fill_btn) ? fallbackDict.img_fill_btn : 'Scale to fill',
            perspective_apply: (fallbackDict && fallbackDict.perspective_apply) ? fallbackDict.perspective_apply : 'Apply corners',
            perspective_reset: (fallbackDict && fallbackDict.perspective_reset) ? fallbackDict.perspective_reset : 'Reset',
            pbr_normal_strength: (fallbackDict && fallbackDict.pbr_normal_strength) ? fallbackDict.pbr_normal_strength : 'Normal strength',
            pbr_ao_strength: (fallbackDict && fallbackDict.pbr_ao_strength) ? fallbackDict.pbr_ao_strength : 'AO strength',
            pbr_generate_btn: (fallbackDict && fallbackDict.pbr_generate_btn) ? fallbackDict.pbr_generate_btn : 'Generate PBR maps',
            retro_pixelation: (fallbackDict && fallbackDict.retro_pixelation) ? fallbackDict.retro_pixelation : 'Pixelation',
            retro_color_depth: (fallbackDict && fallbackDict.retro_color_depth) ? fallbackDict.retro_color_depth : 'Color depth (bpp)',
            retro_dithering: (fallbackDict && fallbackDict.retro_dithering) ? fallbackDict.retro_dithering : 'Dithering',
            retro_apply: (fallbackDict && fallbackDict.retro_apply) ? fallbackDict.retro_apply : 'Apply retro',
            retro_reset: (fallbackDict && fallbackDict.retro_reset) ? fallbackDict.retro_reset : 'Reset',
            seamless_blend_width: (fallbackDict && fallbackDict.seamless_blend_width) ? fallbackDict.seamless_blend_width : 'Blend width',
            seamless_apply: (fallbackDict && fallbackDict.seamless_apply) ? fallbackDict.seamless_apply : 'Apply',
            seamless_reset: (fallbackDict && fallbackDict.seamless_reset) ? fallbackDict.seamless_reset : 'Reset',
            tree_empty_msg: "Your composition is empty. Add your first volume using the 'Add Volume' button in the header to get started.",
          };
          for (const dict of Object.values(translations)) {
            if (!dict || typeof dict !== 'object') continue;
            // These are compatibility fallbacks, not an English override.
            // Replacing an existing translated value here made the language
            // menu appear to work while parts of the UI always stayed English.
            for (const [k, v] of Object.entries(forced)) {
              if (!Object.prototype.hasOwnProperty.call(dict, k) || dict[k] == null || dict[k] === '') dict[k] = v;
            }
          }
        } catch (_) {}
        if (!isRestrictedOrigin) {
          cacheSet('translations_cache_v1', json);
        }
      } catch (e) {
        try { XR?.devWarn?.('[XReate][i18n] loadTranslations failed:', e); } catch (_) {}
      }
    }

    function sanitizeInlineHtml(html) {
      const tpl = document.createElement('template');
      tpl.innerHTML = String(html);
      const allowed = new Set(['strong', 'em', 'b', 'i', 'br', 'span']);
      const all = Array.from(tpl.content.querySelectorAll('*'));
      for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (!allowed.has(tag)) {
          const parent = el.parentNode;
          if (!parent) continue;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          continue;
        }
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      }
      return tpl.innerHTML;
    }

    function applyTranslations(lang) {
      const hasRequestedLang = !!translations[lang] || (lang === 'en' && hasFallbackEn());
      currentLang = hasRequestedLang ? lang : 'en';
      document.documentElement.lang = currentLang;
      document.documentElement.dir = rtlLangs.has(currentLang) ? 'rtl' : 'ltr';
      // The browser title is part of the product's public claim. Keep it
      // stable across partial locales instead of reverting to older
      // scenography-only titles when a user switches language.
      document.title = t('document_title');

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.textContent = value;
      });

      document.querySelectorAll('[data-i18n-html]').forEach((el) => {
        const key = el.getAttribute('data-i18n-html');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.innerHTML = sanitizeInlineHtml(value);
      });

      document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('placeholder', value);
      });

      document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-aria');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('aria-label', value);
      });

      document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('title', value);
      });

      document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
        const key = el.getAttribute('data-i18n-alt');
        if (!key) return;
        const value = t(key);
        if (value === key) return;
        el.setAttribute('alt', value);
      });

      try { getEditorApi()?.refreshI18n?.(); } catch (_) {}
    }

    XR.i18n = XR.i18n || {};
    XR.i18n.t = t;

    const translationsReady = (async () => {
      await loadTranslations();
      const storedLang = storageGet('lang');
      const browserLang = (navigator.language || '').split('-')[0];
      const initial = storedLang || browserLang || 'en';
      applyTranslations(initial);
      if (langSelect) langSelect.value = ((translations[initial] || (initial === 'en' && hasFallbackEn())) ? initial : 'en');
    })();
    try {
      if (langSelect && !langSelect.__xrI18nBound) {
        langSelect.__xrI18nBound = true;
        langSelect.addEventListener('change', (e) => {
          const value = e.target.value;
          storageSet('lang', value);
          applyTranslations(value);
        });
      }
    } catch (_) {}

    return { t, loadTranslations, applyTranslations, translationsReady };
  };
})(window.XR = window.XR || {});
