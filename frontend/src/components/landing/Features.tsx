'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TargetIcon, ShieldCheck, BarChart3, CheckCircle, GitBranch, GitMerge, Clock, Smartphone, Mail, Webhook, TrendingUp, Badge, Zap } from 'lucide-react';

export default function Features() {
  return (
    <section id="features" className="py-16 md:py-20 lg:py-24 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Powerful Features for Modern Websites
          </h2>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
            Everything you need to understand your visitors and automate your business processes
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Analytics Features */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
                <BarChart3 className="h-8 w-8 text-slate-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Advanced Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Real-time visitor tracking, conversion funnels, and detailed insights to optimize your website performance.
              </p>
            </CardContent>
          </Card>

          {/* Workflow Automation */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-green-100 dark:bg-green-900/20 rounded-xl mb-4">
                <Zap className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Smart Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Visual workflow builder to automate customer interactions, lead capture, and business processes.
              </p>
            </CardContent>
          </Card>

          {/* Privacy & Compliance */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl mb-4">
                <ShieldCheck className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Privacy First
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Built-in GDPR/CCPA compliance with cookie consent, data retention policies, and user privacy controls.
              </p>
            </CardContent>
          </Card>

          {/* Real-time Monitoring */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-orange-100 dark:bg-orange-900/20 rounded-xl mb-4">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Real-time Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Live visitor activity, instant notifications, and real-time workflow triggers for immediate response.
              </p>
            </CardContent>
          </Card>

          {/* Custom Integrations */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-xl mb-4">
                <Webhook className="h-8 w-8 text-indigo-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Custom Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Connect with your favorite tools via webhooks, APIs, and custom code execution.
              </p>
            </CardContent>
          </Card>

          {/* Mobile Optimized */}
          <Card className="border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 bg-pink-100 dark:bg-pink-900/20 rounded-xl mb-4">
                <Smartphone className="h-8 w-8 text-pink-600" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                Mobile Optimized
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-400 dark:text-slate-400">
                Responsive design that works perfectly on all devices and screen sizes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
