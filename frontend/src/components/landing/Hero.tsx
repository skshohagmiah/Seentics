'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { FaGithub } from "react-icons/fa";

export default function Hero() {
  const { isAuthenticated, user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video is muted by default, no need to set volume

  return (
    <section className="flex items-center justify-center relative overflow-hidden py-8 md:py-32">
      <div className="absolute inset-0 bg-white dark:bg-slate-950" />

      {/* Minimal floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-20 left-20 w-64 h-64 bg-slate-200 dark:bg-slate-800 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-200 dark:bg-purple-800 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">



          {/* Clean, powerful headline */}
          <h1 className="text-4xl sm:text-6xl  font-black leading-[0.9] mb-8 text-slate-900 dark:text-white">
            <span className="block mb-6">
              Track <span className="text-blue-500">visitors</span>,
            </span>

            <span className="block mb-6">
              Automate <span className="text-purple-500">everything</span>
            </span>

            <span className="block text-3xl sm:text-4xl  font-bold text-green-600 dark:text-green-400">
              popups, webhook & beyond
            </span>
          </h1>

          {/* Simple value proposition */}
          <p className="text-xl sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
            Get website analytics, automated workflows, and conversion funnels in one simple platform.
            <span className="font-semibold text-slate-900 dark:text-white"> Self-hosted and privacy-first.</span>
          </p>

          {/* Clean CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            {isAuthenticated && user ? (
              <>
                <Link href="/websites">
                  <Button size="lg" className="px-10 py-6 text-lg font-semibold rounded-md">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>

                <a href="https://github.com/seentics/seentics" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="px-10 py-6 text-lg font-semibold border-2 border-slate-300 dark:border-slate-600 rounded-md transition-all duration-300">
                    <FaGithub size={30} />
                    View Source
                  </Button>
                </a>
              </>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg" className="px-10 py-6 text-lg font-semibold rounded-md">
                    Start Free Today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>

                <a href="https://github.com/skshohagmiah/Seentics" target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="lg" className="font-semibold text-lg rounded-md">
                    <FaGithub size={30} />
                    GitHub
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* Simple bottom text */}
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">
            Replaces Google Analytics, HubSpot, Mixpanel and more.
            <span className="font-medium"> No tracking. No limits. Own your data.</span>
          </p>

          {/* Video Section */}
          <div className="relative w-full max-w-7xl mx-auto mt-12">
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-slate-900 dark:bg-slate-800">
              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  muted
                  loop
                  preload="metadata"
                >
                  <source src="/seentics.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>

        </div>
      </div>



      {/* Simple animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
        
        /* Ensure poster image maintains aspect ratio */
        video {
          object-fit: cover !important;
        }
        
        video::poster {
          object-fit: cover !important;
        }
      `}</style>
    </section>
  );
}