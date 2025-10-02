(function () {
  // --- Seentics Analytics Tracker v1.0.3 (Optimized) ---

  if (document.currentScript) {
    (function (d, w, n, l) {
      // Config
      const script = d.currentScript;
      const siteId = script.getAttribute('data-site-id');
      const apiHost = w.SEENTICS_CONFIG?.apiHost || (l.hostname === 'localhost' ? (w.SEENTICS_CONFIG?.devApiHost || 'http://localhost:8080') : 'https://api.seentics.com');
      const API = `${apiHost}/api/v1/analytics/event/batch`;
      const DEBUG = !!(w.SEENTICS_CONFIG?.debugMode || l.search.includes('debug=true')) && l.hostname === 'localhost';

      // Constants
      const K = { VID: 'seentics_visitor_id', SID: 'seentics_session_id', LAST: 'seentics_session_last_seen' };
      const T = { SESSION: 1800000, VISITOR: 2592000000, BATCH: 100, RETRY: 1000 };
      const MAX_RETRY = 3;

      // State
      let vid = null, sid = null, start = performance.now(), pvSent = false, url = l.pathname;
      let cachedUTM = null, sessionUTM = null, activityTimer = null, destroyed = false;
      const queue = [], pending = new Map(), cleanup = [];
      let flushTimer = null, lastRef = null, device = null;

      // --- Helpers ---
      const safe = (fn) => {
        try { return fn(); }
        catch (e) { if (DEBUG) console.warn('Seentics: Storage error:', e); return null; }
      };

      const getId = (key, exp) => safe(() => {
        const raw = localStorage.getItem(key);
        if (raw) {
          let obj;
          try { obj = JSON.parse(raw); }
          catch { if (raw.length > 10) return raw; }
          if (obj?.value && (!obj.expiresAt || Date.now() < obj.expiresAt)) return obj.value;
        }
        const val = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const exp_at = Date.now() + exp;
        localStorage.setItem(key, JSON.stringify({ value: val, expiresAt: exp_at }));
        if (key === K.SID) localStorage.setItem(K.LAST, Date.now().toString());
        return val;
      }) || Date.now().toString(36) + Math.random().toString(36).slice(2);

      const refresh = () => safe(() => {
        const now = Date.now();
        const last = parseInt(localStorage.getItem(K.LAST) || '0', 10);
        if (last && now - last < T.SESSION) {
          localStorage.setItem(K.LAST, now.toString());
          return;
        }
        sid = getId(K.SID, T.SESSION);
      });

      // --- Fetch with retry ---
      async function dedupFetch(url, opts, retry = 0) {
        if (destroyed) return;
        const key = `${url}:${JSON.stringify(opts)}`;
        if (pending.has(key)) return pending.get(key);

        const promise = (async () => {
          try {
            const res = await fetch(url, opts);
            if (!res.ok && retry < MAX_RETRY) {
              await new Promise(r => setTimeout(r, T.RETRY * (retry + 1)));
              return dedupFetch(url, opts, retry + 1);
            }
            return res;
          } catch (e) {
            if (retry < MAX_RETRY) {
              await new Promise(r => setTimeout(r, T.RETRY * (retry + 1)));
              return dedupFetch(url, opts, retry + 1);
            }
            throw e;
          }
        })();

        pending.set(key, promise);
        promise.finally(() => pending.delete(key));
        return promise;
      }

      // --- Event batching ---
      const addEvent = (evt) => {
        if (destroyed) return;
        queue.push(evt);
        if (!flushTimer) flushTimer = setTimeout(flush, T.BATCH);
      };

      async function flush() {
        const events = queue.splice(0);
        flushTimer = null;
        try {
          const data = JSON.stringify({ siteId, events });
          if (n.sendBeacon) {
            n.sendBeacon(API, new Blob([data], { type: 'application/json' }));
          } else {
            await dedupFetch(API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: data,
              credentials: 'omit',
              keepalive: true
            });
          }
        } catch (e) {
          if (DEBUG) console.warn('Seentics: Batch failed', e);
          queue.unshift(...events);
        }
      }

      // --- Device detection ---
      const getDevice = () => {
        if (device) return device;
        const ua = n.userAgent;
        device = {
          browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Other',
          device: /iPad|Android(?=.*Mobile)|PlayBook|Silk/i.test(ua) ? 'Tablet' : /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop',
          os: ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : ua.includes('Android') ? 'Android' : ua.includes('iOS') ? 'iOS' : 'Other'
        };
        return device;
      };

      // --- UTM extraction ---
      const getUTM = () => {
        const params = new URLSearchParams(l.search);
        const utm = {
          utm_source: params.get('utm_source'),
          utm_medium: params.get('utm_medium'),
          utm_campaign: params.get('utm_campaign'),
          utm_term: params.get('utm_term'),
          utm_content: params.get('utm_content')
        };
        const hasUTM = Object.values(utm).some(v => v !== null);
        if (hasUTM) {
          sessionUTM = { ...utm };
          cachedUTM = { ...utm };
        } else if (sessionUTM) {
          cachedUTM = { ...sessionUTM };
        } else {
          cachedUTM = utm;
        }
        return cachedUTM;
      };

      // --- Custom event tracking ---
      const track = (name, props = {}) => {
        if (!siteId || !name || typeof name !== 'string') {
          if (DEBUG) console.warn('Seentics: Invalid event params');
          return;
        }

        refresh();
        const evt = {
          website_id: siteId,
          visitor_id: vid,
          session_id: sid,
          event_type: name,
          page: l.pathname,
          properties: props,
          timestamp: new Date().toISOString()
        };

        const ref = d.referrer || null;
        if (ref !== lastRef) {
          evt.referrer = ref;
          lastRef = ref;
        }

        const dev = getDevice();
        evt.browser = dev.browser;
        evt.device = dev.device;
        evt.os = dev.os;

        const utm = getUTM();
        Object.keys(utm).forEach(k => { if (utm[k]) evt[k] = utm[k]; });

        addEvent(evt);

        try {
          d.dispatchEvent(new CustomEvent('seentics:custom-event', {
            detail: { eventName: name, data: props }
          }));
        } catch { }
      };

      // --- Pageview tracking ---
      const sendPV = () => {
        if (pvSent || !siteId || destroyed) return;
        const time = Math.round((performance.now() - start) / 1000);
        refresh();

        const evt = {
          website_id: siteId,
          visitor_id: vid,
          session_id: sid,
          event_type: 'pageview',
          page: l.pathname,
          time_on_page: time,
          timestamp: new Date().toISOString()
        };

        const ref = d.referrer || null;
        if (ref !== lastRef) {
          evt.referrer = ref;
          lastRef = ref;
        }

        const dev = getDevice();
        evt.browser = dev.browser;
        evt.device = dev.device;
        evt.os = dev.os;

        const utm = getUTM();
        Object.keys(utm).forEach(k => { if (utm[k]) evt[k] = utm[k]; });

        pvSent = true;
        addEvent(evt);
      };

      // --- Activity handler ---
      const onActivity = () => {
        if (activityTimer || destroyed) return;
        activityTimer = setTimeout(() => {
          if (!destroyed) refresh();
          activityTimer = null;
        }, 1000);
      };

      // --- Route change ---
      const onRoute = () => {
        if (destroyed) return;
        const newUrl = l.pathname;
        if (newUrl === url) return;
        url = newUrl;
        start = performance.now();
        pvSent = false;
        requestIdleCallback(() => sendPV());
      };

      // --- Cleanup ---
      const destroy = () => {
        destroyed = true;
        if (activityTimer) { clearTimeout(activityTimer); activityTimer = null; }
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        cleanup.forEach(fn => { try { fn(); } catch (e) { } });
        cleanup.length = 0;
        if (queue.length > 0) flush();
        pending.clear();
      };

      // --- Event listeners ---
      const setup = () => {
        const vis = () => {
          if (destroyed) return;
          if (d.hidden && !pvSent) sendPV();
          refresh();
        };
        d.addEventListener('visibilitychange', vis, { passive: true });
        cleanup.push(() => d.removeEventListener('visibilitychange', vis));

        const unload = () => {
          if (!pvSent) sendPV();
          if (queue.length > 0) flush();
          destroy();
        };
        w.addEventListener('beforeunload', unload);
        cleanup.push(() => w.removeEventListener('beforeunload', unload));

        // Throttled activity
        let throttle = null;
        const throttled = () => {
          if (throttle) return;
          throttle = setTimeout(() => { onActivity(); throttle = null; }, 100);
        };

        ['click', 'keydown'].forEach(e => {
          d.addEventListener(e, onActivity, { passive: true });
          cleanup.push(() => d.removeEventListener(e, onActivity));
        });

        ['scroll', 'mousemove', 'touchstart'].forEach(e => {
          d.addEventListener(e, throttled, { passive: true });
          cleanup.push(() => d.removeEventListener(e, throttled));
        });

        // SPA navigation
        const origPush = history.pushState;
        const origReplace = history.replaceState;
        history.pushState = function (...a) { origPush.apply(this, a); onRoute(); };
        history.replaceState = function (...a) { origReplace.apply(this, a); onRoute(); };
        w.addEventListener('popstate', onRoute);
        cleanup.push(() => {
          w.removeEventListener('popstate', onRoute);
          history.pushState = origPush;
          history.replaceState = origReplace;
        });
      };

      // --- Resource loader ---
      const load = (src, type = 'script') => new Promise(res => {
        const attr = type === 'script' ? 'src' : 'href';
        if (d.querySelector(`${type}[${attr}="${src}"]`)) return res();
        const el = d.createElement(type);
        if (type === 'script') {
          el.src = src;
          el.async = true;
        } else {
          el.rel = 'stylesheet';
          el.href = src;
          el.type = 'text/css';
        }
        el.onload = el.onerror = () => res();
        d.head.appendChild(el);
      });

      const loadTrackers = async () => {
        try {
          await Promise.all([
            load('/trackers/shared-constants.js'),
            load('/trackers/styles/tracker-styles.css', 'link'),
            load('/trackers/workflow-tracker.js'),
            load('/trackers/funnel-tracker.js')
          ]);
          if (w.seentics?.workflowTracker) await w.seentics.workflowTracker.init(siteId);
        } catch (e) {
          if (DEBUG) console.warn('Seentics: Tracker load failed', e);
        }
      };

      // --- Init ---
      const init = () => {
        if (!siteId) {
          if (DEBUG) console.warn('Seentics: No site ID');
          return;
        }

        vid = getId(K.VID, T.VISITOR);
        sid = getId(K.SID, T.SESSION);

        requestIdleCallback(() => sendPV());
        setup();
        requestIdleCallback(() => loadTrackers());

        w.seentics = {
          siteId,
          apiHost,
          track,
          sendPageview: sendPV,
          cleanup: destroy,
          getDeviceInfo: getDevice,
          ...(DEBUG && {
            getVisitorId: () => vid,
            getSessionId: () => sid,
            flushEvents: flush,
            getUTMParams: () => sessionUTM || cachedUTM,
            getCurrentURL: () => l.href
          })
        };
      };

      if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', init);
      } else {
        requestIdleCallback(init);
      }

    })(document, window, navigator, location);
  }
})();