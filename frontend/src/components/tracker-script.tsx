'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Type declarations for window objects
declare global {
  interface Window {
    SEENTICS_CONFIG?: {
      debugMode?: boolean;
      devApiHost?: string;
      apiHost?: string;
    };
    seentics?: {
      siteId: string;
      apiHost: string;
      track: (name: string, props?: Record<string, any>) => void;
      getVisitorId?: () => string;
      getSessionId?: () => string;
      getCurrentURL?: () => string;
    };
    seenticsTest?: {
      trackEvent: (name: string, props?: Record<string, any>) => void;
      getInfo: () => any;
    };
  }
}

interface TrackerScriptProps {
  siteId?: string;
  autoLoad?: boolean;
  testMode?: boolean; // New prop for localhost testing
}

export default function TrackerScript({ 
  siteId, 
  autoLoad = true, 
  testMode = false 
}: TrackerScriptProps) {
  const pathname = usePathname();
  const [isLocalhost, setIsLocalhost] = useState(false);
  
  useEffect(() => {
    // Check if we're running on localhost
    setIsLocalhost(
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.includes('localhost'))
    );
  }, []);
  
  // Load tracker on all pages, but extract site ID from website pages
  const isWebsitePage = pathname.startsWith('/websites/');
  
  // Do not load the global tracker on preview pages; preview has its own isolated loader
  if (pathname.startsWith('/preview')) {
    return null;
  }
  
  // Extract site ID from URL if not provided
  const getSiteId = () => {
    if (siteId) return siteId;
    
    if (isWebsitePage) {
      const match = pathname.match(/\/websites\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    // For localhost testing, use a test site ID
    if (isLocalhost && testMode) {
      return 'test-site-localhost';
    }
    
    // For non-website pages, use a default site ID or get from localStorage
    // Check if we're on the client side before accessing localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('seentics_default_site_id') || process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '';
    }
    
    // Fallback for server-side rendering
    return process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '';
  };

  const currentSiteId = getSiteId();

  // Don't load if no site ID
  if (!autoLoad || !currentSiteId) {
    return null;
  }

  // Enhanced logging for localhost testing
  const handleLoad = () => {
    const message = `Seentics Tracker loaded for site: ${currentSiteId}`;
    console.log(message);
    
    if (isLocalhost && testMode) {
      console.log('🧪 LOCALHOST TEST MODE ACTIVE');
      console.log('📊 Analytics events will be sent to:', 
        typeof window !== 'undefined' && window.SEENTICS_CONFIG?.devApiHost || 'http://localhost:8080'
      );
      console.log('🔍 Debug mode enabled - check console for event details');
      
      // Set debug mode for localhost testing
      if (typeof window !== 'undefined') {
        window.SEENTICS_CONFIG = {
          ...window.SEENTICS_CONFIG,
          debugMode: true,
          devApiHost: 'http://localhost:8080'
        };
      }
    }
  };

  const handleError = (e: any) => {
    console.error('Failed to load Seentics Tracker:', e);
    if (isLocalhost && testMode) {
      console.error('🚨 Tracker failed to load in test mode. Check if analytics service is running on localhost:8080');
    }
  };

  return (
    <>
      {/* Configuration script for localhost testing */}
      {isLocalhost && testMode && (
        <Script
          id="seentics-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.SEENTICS_CONFIG = {
                debugMode: true,
                devApiHost: 'http://localhost:8080',
                apiHost: 'http://localhost:8080'
              };
              console.log('🔧 Seentics config loaded for localhost testing');
            `
          }}
        />
      )}
      
      <Script
        src="/trackers/tracker.js"
        data-site-id={currentSiteId}
        strategy="afterInteractive"
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {/* Test helper for localhost */}
      {isLocalhost && testMode && (
        <Script
          id="seentics-test-helper"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Test helper functions for localhost
              window.seenticsTest = {
                trackEvent: (name, props) => {
                  if (window.seentics?.track) {
                    console.log('🔥 Tracking test event:', name, props);
                    window.seentics.track(name, props);
                  } else {
                    console.warn('⚠️ Seentics tracker not ready yet');
                  }
                },
                getInfo: () => {
                  if (window.seentics) {
                    return {
                      siteId: window.seentics.siteId,
                      apiHost: window.seentics.apiHost,
                      visitorId: window.seentics.getVisitorId?.(),
                      sessionId: window.seentics.getSessionId?.(),
                      currentURL: window.seentics.getCurrentURL?.()
                    };
                  }
                  return null;
                }
              };
              
              // Log available test functions
              setTimeout(() => {
                console.log('🧪 Test functions available:');
                console.log('- seenticsTest.trackEvent("event_name", {key: "value"})');
                console.log('- seenticsTest.getInfo()');
              }, 1000);
            `
          }}
        />
      )}
    </>
  );
} 