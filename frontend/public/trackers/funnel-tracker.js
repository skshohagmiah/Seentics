(function (doc) {
  'use strict';

  // --- Seentics Funnel Tracker v1.0.2 (Fixed & Optimized) ---
  // Fixed: Syntax errors, race conditions, performance issues, memory leaks

  const DEBUG = window.location.hostname === 'localhost';

  // Get site ID from script tag or global variables
  const scriptTag = doc.currentScript;
  let siteId = scriptTag?.getAttribute('data-site-id') ||
    doc.querySelector('script[data-site-id]')?.getAttribute('data-site-id') ||
    window.seentics?.siteId ||
    window.SEENTICS_SITE_ID;

  if (!siteId) {
    if (DEBUG) console.warn('Seentics Funnel: No site ID provided');
    return;
  }

  // Configuration
  const apiHost = window.SEENTICS_CONFIG?.apiHost ||
    (window.location.hostname === 'localhost' ? 'http://localhost:8080' : 'https://www.api.seentics.com');
  const FUNNEL_API_ENDPOINT = `${apiHost}/api/v1/funnels/track`;

  // Feature flags
  const trackFunnels = (scriptTag?.getAttribute('data-track-funnels') || '').toLowerCase() !== 'false';

  // Constants
  const VISITOR_ID_KEY = 'seentics_visitor_id';
  const SESSION_ID_KEY = 'seentics_session_id';
  const FUNNEL_STATE_KEY = 'seentics_funnel_state';
  const BATCH_DELAY = 1000;
  const VISITOR_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
  const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  // Utilities
  function getOrCreateId(key, expiryMs) {
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).substring(2);
        localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      console.warn('Seentics Funnel: Storage error:', e);
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
  }

  function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }

  // State
  let visitorId = getOrCreateId(VISITOR_ID_KEY, VISITOR_TTL);
  let sessionId = getOrCreateId(SESSION_ID_KEY, SESSION_TTL);
  let activeFunnels = new Map();
  let funnelEventQueue = [];
  let funnelEventTimer = null;
  let funnelsValidated = false;
  let currentUrl = window.location.pathname;


  // --- Funnel Tracking Functions ---

  async function initFunnelTracking() {
    if (!trackFunnels || !siteId) {
      if (DEBUG) console.log('🔍 Seentics: Funnel tracking disabled or no siteId:', { trackFunnels, siteId });
      return;
    }

    if (DEBUG) console.log('🔍 Seentics: Starting funnel tracking initialization...');
    await loadFunnelDefinitions();
    startFunnelMonitoring();
    if (DEBUG) console.log('🔍 Seentics: Funnel tracking initialization completed');
  }

  async function loadFunnelDefinitions() {
    try {
      if (DEBUG) console.log('🔍 Seentics: Loading funnel definitions for site:', siteId);

      // Load from cache first
      const cacheKey = `${FUNNEL_STATE_KEY}_${siteId}`;
      const cacheTimestampKey = `${cacheKey}_timestamp`;
      const savedFunnels = localStorage.getItem(cacheKey);
      const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
      
      // Check if cache is still valid (1 hour)
      const cacheAge = Date.now() - (parseInt(cacheTimestamp) || 0);
      const cacheValid = cacheAge < 3600000; // 1 hour

      if (savedFunnels && cacheValid) {
        try {
          const funnels = JSON.parse(savedFunnels);
          // Only load essential funnel data, not full definitions
          const lightweightFunnels = funnels.map(f => ({
            id: f.id,
            name: f.name,
            steps: f.steps?.map(s => ({ url: s.url, event: s.event })) || [],
            isActive: f.isActive
          }));
          initializeFunnels(lightweightFunnels);
          funnelsValidated = true; // Mark as validated to avoid server call
          if (DEBUG) console.log('🔍 Seentics: Loaded cached funnels:', lightweightFunnels.length);
          return;
        } catch (error) {
          console.warn('🔍 Seentics: Error loading cached funnels:', error);
        }
      }

      // Fetch from API - Use analytics service public endpoint for funnel tracking
      const apiUrl = `${apiHost}/api/v1/funnels/active?website_id=${siteId}`;
      if (DEBUG) console.log('🔍 Seentics: Fetching funnels from analytics service:', apiUrl);

      // For public funnel tracking, we don't need authentication
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'omit', // Explicitly omit credentials for public tracking
        keepalive: true
      });

      if (response.ok) {
        const data = await response.json();
        // Handle null response (no funnels), direct array response, and wrapped response
        const funnels = data === null ? [] : (Array.isArray(data) ? data : (data && data.funnels ? data.funnels : (data && data.data ? data.data : [])));

        if (DEBUG) console.log('🔍 Seentics: API Response:', { status: response.status, data });
        if (DEBUG) console.log('🔍 Seentics: Extracted funnels:', funnels);

        activeFunnels.clear();
        initializeFunnels(funnels);

        localStorage.setItem(cacheKey, JSON.stringify(funnels));
        funnelsValidated = true;

        // Trigger initial page check
        setTimeout(() => {
          if (DEBUG) console.log('🔍 Seentics: Triggering initial page check for:', currentUrl);
          monitorPageChanges();
        }, 100);

        if (funnelEventQueue.length > 0) {
          sendFunnelEvents();
        }
      } else {
        const errorText = await response.text();
        console.warn('🔍 Seentics: Failed to fetch funnel definitions:', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          error: errorText
        });
      }
    } catch (error) {
      console.warn('🔍 Seentics: Error loading funnel definitions:', error);
      // Initialize with empty array on error to prevent null reference
      activeFunnels.clear();
      initializeFunnels([]);
    }
  }

  function initializeFunnels(funnels) {
    if (DEBUG) console.log('🔍 Seentics: Initializing funnels:', funnels);

    if (!Array.isArray(funnels)) {
      console.warn('🔍 Seentics: Funnels is not an array:', funnels);
      return;
    }

    funnels.forEach(funnel => {
      if (DEBUG) console.log('🔍 Seentics: Processing funnel:', funnel.name, 'Active:', funnel.is_active);

      if (funnel.is_active) {
        activeFunnels.set(funnel.id, {
          ...funnel,
          currentStep: 0,
          completedSteps: [],
          startedAt: null,
          lastActivity: null,
          converted: false
        });

        if (DEBUG) console.log('🔍 Seentics: Added active funnel:', funnel.id, 'with', funnel.steps?.length || 0, 'steps');
      }
    });

    if (DEBUG) console.log('🔍 Seentics: Total active funnels loaded:', activeFunnels.size);
  }

  // Debounce utility
  function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }

  // Debounced funnel state update to prevent race conditions
  const debouncedSaveFunnelState = debounce(() => {
    try {
      const stateToSave = {};
      activeFunnels.forEach((state, id) => {
        stateToSave[id] = {
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          startedAt: state.startedAt,
          lastActivity: state.lastActivity?.toISOString?.() || state.lastActivity,
          converted: state.converted
        };
      });
      localStorage.setItem(FUNNEL_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save funnel state:', e);
    }
  }, 200);

  function startFunnelMonitoring() {
    monitorPageChanges();
    monitorClickEvents();
    monitorCustomEvents();
  }

  function monitorPageChanges() {
    if (DEBUG) console.log('🔍 Seentics: Monitoring page changes for:', currentUrl);
    if (DEBUG) console.log('🔍 Seentics: Active funnels count:', activeFunnels.size);

    let anyFunnelMatched = false;

    activeFunnels.forEach((funnelState, funnelId) => {
      if (!funnelState.steps) {
        if (DEBUG) console.log('🔍 Seentics: No steps for funnel:', funnelId);
        return;
      }

      // Skip checking if user is not currently in this funnel (currentStep = 0)
      // Only check funnels that are either starting fresh or user is actively progressing through
      const isInActiveFunnel = funnelState.currentStep > 0;
      const canStartFunnel = funnelState.currentStep === 0;

      if (DEBUG) console.log(`🔍 Seentics: Checking funnel ${funnelId} - currentStep: ${funnelState.currentStep}, isActive: ${isInActiveFunnel}`);

      let foundMatch = false;

      funnelState.steps.forEach((step, index) => {
        const stepNumber = index + 1;

        if (step.type === 'page' && step.condition?.page) {
          const matches = matchesPageCondition(currentUrl, step.condition.page);

          if (matches) {
            // Only process if this is step 1 (can start funnel) or user is actively in funnel
            if (stepNumber === 1 || isInActiveFunnel) {
              if (DEBUG) console.log(`🎯 Seentics: Page match for funnel ${funnelId}, step ${stepNumber}: ${step.name}`);
              updateFunnelProgress(funnelId, stepNumber, step);
              foundMatch = true;
              anyFunnelMatched = true;
            } else {
              if (DEBUG) console.log(`🔍 Seentics: Ignoring step ${stepNumber} match - user not in active funnel`);
            }
          }
        }
      });

      // Handle dropoff only if user was actively in this funnel
      if (!foundMatch && isInActiveFunnel) {
        if (funnelState.startedAt && (new Date() - new Date(funnelState.startedAt)) > 5000) {
          // 5 second minimum engagement before considering it a dropoff
          if (DEBUG) console.log(`🔍 Seentics: User dropped off from funnel ${funnelId} after meaningful engagement`);
          queueDropoffEvent(funnelId, funnelState);
        } else {
          if (DEBUG) console.log(`🔍 Seentics: User left funnel ${funnelId} too quickly, not counting as dropoff`);
        }

        // Reset funnel state when user visits non-funnel pages
        funnelState.currentStep = 0;
        funnelState.completedSteps = [];
        funnelState.startedAt = null;
        funnelState.converted = false;
        activeFunnels.set(funnelId, funnelState);
        saveFunnelState();
      }
    });

    // Only log if there was actually a funnel match
    if (DEBUG && !anyFunnelMatched) {
      console.log('🔍 Seentics: No funnel matches found for current page, no API calls needed');
    }
  }

  function queueDropoffEvent(funnelId, funnelState) {
    const dropoffEvent = createFunnelEvent(funnelId, funnelState, {
      step_name: funnelState.steps[funnelState.currentStep - 1]?.name || 'Unknown',
      step_type: funnelState.steps[funnelState.currentStep - 1]?.type || 'page',
      dropoff_reason: "navigated_to_unexpected_page",
      event_type: "dropoff"
    });

    funnelEventQueue.push(dropoffEvent);
    sendFunnelEvents();
  }

  function monitorClickEvents() {
    doc.addEventListener('click', (e) => {
      const element = e.target;

      activeFunnels.forEach((funnelState, funnelId) => {
        if (!funnelState.steps) return;

        funnelState.steps.forEach((step, index) => {
          if (step.type === 'event' && step.condition?.event &&
            matchesEventCondition(element, step.condition.event)) {
            updateFunnelProgress(funnelId, index + 1, step);
          }
        });
      });
    }, { passive: true });
  }

  function monitorCustomEvents() {
    doc.addEventListener('seentics:custom-event', (event) => {
      const { eventName, data } = event.detail;
      checkCustomEventForFunnels(eventName, data);
    });
  }

  function checkCustomEventForFunnels(eventName, data = {}) {
    activeFunnels.forEach((funnelState, funnelId) => {
      if (!funnelState.steps) return;

      funnelState.steps.forEach((step, index) => {
        if (step.type === 'custom' && step.condition?.custom === eventName) {
          updateFunnelProgress(funnelId, index + 1, step, data);
        }
      });
    });
  }

  function updateFunnelProgress(funnelId, stepNumber, step, additionalData = {}) {
    const funnelState = activeFunnels.get(funnelId);
    if (!funnelState) return;

    // Prevent race conditions with state locking
    if (funnelState._updating) {
      if (DEBUG) console.log(`🔍 Seentics: Funnel ${funnelId} update in progress, skipping`);
      return;
    }
    funnelState._updating = true;

    try {
      // Enforce sequential progression: only allow next step or restart from step 1
      const expectedNextStep = funnelState.currentStep + 1;

      if (stepNumber === 1) {
        // Allow restarting funnel from step 1
        if (DEBUG) console.log(`🔍 Seentics: Starting/restarting funnel ${funnelId} from step 1`);
        funnelState.currentStep = 1;
        funnelState.completedSteps = [0]; // Step 1 completed (0-indexed)
        funnelState.startedAt = new Date().toISOString();
        funnelState.converted = false;
      } else if (stepNumber === expectedNextStep) {
        // Allow only the next sequential step
        if (DEBUG) console.log(`🔍 Seentics: Sequential progress in funnel ${funnelId}: step ${stepNumber}`);
        funnelState.currentStep = stepNumber;
        funnelState.completedSteps.push(stepNumber - 1);

        // Check if funnel is completed
        if (stepNumber === funnelState.steps.length) {
          funnelState.converted = true;
          console.log(`🔍 Seentics: Funnel ${funnelId} completed sequentially!`);
        }
      } else {
        // Invalid step progression - user skipped steps or went backwards
        if (DEBUG) console.log(`🔍 Seentics: Invalid step progression for funnel ${funnelId}: current=${funnelState.currentStep}, attempted=${stepNumber}. Ignoring.`);
        return;
      }

      funnelState.lastActivity = new Date();
      activeFunnels.set(funnelId, funnelState);
      debouncedSaveFunnelState();

      // Only send API calls for actual funnel progression
      queueFunnelEvent(funnelId, funnelState, stepNumber, additionalData);
    } finally {
      funnelState._updating = false;
    }
  }

  function queueFunnelEvent(funnelId, funnelState, step, additionalData) {
    const funnelEvent = createFunnelEvent(funnelId, funnelState, {
      step_name: funnelState.steps[step - 1]?.name || `Step ${step}`,
      step_type: funnelState.steps[step - 1]?.type || 'page',
      ...additionalData
    });

    funnelEventQueue.push(funnelEvent);

    clearTimeout(funnelEventTimer);
    funnelEventTimer = setTimeout(sendFunnelEvents, BATCH_DELAY);
  }

  function createFunnelEvent(funnelId, funnelState, properties) {
    return {
      funnel_id: funnelId,
      website_id: siteId,
      visitor_id: visitorId,
      session_id: sessionId,
      current_step: funnelState.currentStep,
      completed_steps: funnelState.completedSteps,
      started_at: funnelState.startedAt,
      last_activity: funnelState.lastActivity,
      converted: funnelState.converted,
      event_type: properties.event_type, // Extract event_type to root level for workflow tracker
      ...properties
    };
  }

  async function sendFunnelEvents() {
    if (!funnelsValidated || funnelEventQueue.length === 0) return;

    const eventsToSend = [...funnelEventQueue];
    funnelEventQueue = [];

    if (DEBUG) console.log(`🔍 Seentics: Sending ${eventsToSend.length} funnel events to API`);

    try {
      const sendEvent = async (event) => {
        if (DEBUG) console.log('🔍 Seentics: Sending funnel event:', event);

        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(event)], { type: 'application/json' });
          if (!navigator.sendBeacon(FUNNEL_API_ENDPOINT, blob)) {
            console.warn('🔍 Seentics: Failed to send via sendBeacon');
          }
        } else {
          await fetch(FUNNEL_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
            credentials: 'omit', // Explicitly omit credentials for public tracking
            keepalive: true
          });
        }

        // Emit for workflow tracker
        try {
          doc.dispatchEvent(new CustomEvent('seentics:funnel-event', { detail: event }));
        } catch (error) {
          console.warn('🔍 Seentics: Failed to emit funnel event:', error);
        }
      };

      await Promise.all(eventsToSend.map(sendEvent));
      if (DEBUG) console.log('🔍 Seentics: Successfully sent all funnel events');
    } catch (error) {
      console.error('🔍 Seentics: Error sending funnel events:', error);
      funnelEventQueue.unshift(...eventsToSend);
    }
  }

  function saveFunnelState() {
    try {
      const funnelStates = Array.from(activeFunnels.values());
      localStorage.setItem(`${FUNNEL_STATE_KEY}_${siteId}`, JSON.stringify(funnelStates));
    } catch (error) {
      console.warn('🔍 Seentics: Error saving funnel state:', error);
    }
  }

  // Public API functions
  function trackFunnelStep(funnelId, stepNumber, stepData = {}) {
    if (!trackFunnels || !siteId) return;

    const funnelState = activeFunnels.get(funnelId);
    if (!funnelState) {
      console.warn(`🔍 Seentics: Funnel ${funnelId} not found`);
      return;
    }

    if (funnelState.steps?.[stepNumber - 1]) {
      updateFunnelProgress(funnelId, stepNumber, funnelState.steps[stepNumber - 1], stepData);
    }
  }

  function trackFunnelConversion(funnelId, conversionValue = 0, additionalData = {}) {
    if (!trackFunnels || !siteId) return;

    const funnelState = activeFunnels.get(funnelId);
    if (!funnelState) {
      console.warn(`🔍 Seentics: Funnel ${funnelId} not found`);
      return;
    }

    funnelState.converted = true;
    funnelState.lastActivity = new Date();
    activeFunnels.set(funnelId, funnelState);
    saveFunnelState();

    const conversionEvent = createFunnelEvent(funnelId, funnelState, {
      step_name: funnelState.steps[funnelState.currentStep - 1]?.name || `Step ${funnelState.currentStep}`,
      step_type: funnelState.steps[funnelState.currentStep - 1]?.type || 'page',
      conversion_value: conversionValue,
      event_type: "conversion",
      ...additionalData
    });

    funnelEventQueue.push(conversionEvent);
    sendFunnelEvents();
  }

  // --- Helper Functions ---

  function matchesPageCondition(currentPath, stepPath) {
    if (currentPath === stepPath) return true;

    if (stepPath.includes('*')) {
      const regex = new RegExp(stepPath.replace(/\*/g, '.*'));
      return regex.test(currentPath);
    }

    if (stepPath.endsWith('*')) {
      return currentPath.startsWith(stepPath.slice(0, -1));
    }

    return false;
  }

  function matchesEventCondition(element, selector) {
    try {
      return !!(element.matches?.(selector) || element.closest?.(selector));
    } catch {
      return false;
    }
  }

  // --- Event Listeners ---

  function onRouteChange() {
    const newUrl = window.location.pathname;
    if (newUrl === currentUrl) return;

    if (DEBUG) console.log(`🔍 Seentics: Route change detected: ${currentUrl} -> ${newUrl}`);
    currentUrl = newUrl;

    // Only monitor page changes if we have active funnels
    if (activeFunnels.size === 0) {
      if (DEBUG) console.log('🔍 Seentics: No active funnels, skipping page monitoring');
      return;
    }

    // Give React time to render the new page
    setTimeout(() => {
      if (DEBUG) console.log('🔍 Seentics: Triggering page monitoring after route change');
      monitorPageChanges();
    }, 200);
  }

  // SPA navigation detection
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    onRouteChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    onRouteChange();
  };

  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('beforeunload', () => {
    if (funnelEventQueue.length > 0) {
      sendFunnelEvents();
    }
  });

  // --- Initialization ---
  function init() {
    if (!siteId) {
      console.warn('🔍 Seentics: siteId not provided');
      return;
    }

    if (DEBUG) console.log('🔍 Seentics: Initializing funnel tracker for site:', siteId);
    if (DEBUG) console.log('🔍 Seentics: Current URL:', currentUrl);
    if (DEBUG) console.log('🔍 Seentics: API Host:', apiHost);

    initFunnelTracking();

    // Public API
    window.seentics = window.seentics || {};
    window.seentics.funnelTracker = {
      trackFunnelStep,
      trackFunnelConversion,
      getFunnelState: (funnelId) => activeFunnels.get(funnelId),
      getActiveFunnels: () => Array.from(activeFunnels.keys()),
      monitorPageChanges,
      triggerFunnelEvent: (funnelId, eventType, stepIndex = 0, additionalData = {}) => {
        const funnelEvent = {
          funnel_id: funnelId,
          current_step: stepIndex,
          completed_steps: [stepIndex],
          started_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          converted: eventType === 'conversion',
          properties: {
            event_type: eventType,
            ...additionalData
          }
        };

        console.log('🎯 Manually triggering funnel event:', funnelEvent);
        doc.dispatchEvent(new CustomEvent('seentics:funnel-event', { detail: funnelEvent }));
        return funnelEvent;
      }
    };

    // Cleanup function to prevent memory leaks
    window.seentics.funnelTracker.cleanup = () => {
      // Clear timers
      if (funnelEventTimer) {
        clearTimeout(funnelEventTimer);
        funnelEventTimer = null;
      }

      // Send any remaining events
      if (funnelEventQueue.length > 0) {
        sendFunnelEvents();
      }

      // Clear state
      activeFunnels.clear();
      funnelEventQueue = [];

      // Remove event listeners
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('beforeunload', () => {
        if (funnelEventQueue.length > 0) {
          sendFunnelEvents();
        }
      });

      // Restore original history methods
      if (originalPushState) {
        history.pushState = originalPushState;
      }
      if (originalReplaceState) {
        history.replaceState = originalReplaceState;
      }
    };
  }

  // Initialize when DOM is ready
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.seentics?.funnelTracker?.cleanup) {
      window.seentics.funnelTracker.cleanup();
    }
  });
})(document);