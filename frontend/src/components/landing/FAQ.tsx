import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const faqs = [
  {
    question: "How does Seentics differ from traditional analytics tools?",
    answer:
      "While traditional analytics tools focus on reporting what happened, Seentics goes beyond by automatically taking action based on user behavior. We not only track what users do, but we also engage them with personalized experiences to increase conversions in real-time. Our platform combines analytics, automation, and AI to create a complete conversion optimization solution.",
  },
  {
    question: "Will the tracking script affect my website's performance?",
    answer:
      "No, our tracking script is lightweight and optimized for performance. It loads asynchronously and won't impact your website's speed or user experience. We prioritize performance to ensure your site remains fast. The script is only 15KB gzipped and loads in under 100ms on average.",
  },
  {
    question: "Can I track custom events from my application?",
    answer:
      "Absolutely. Seentics supports comprehensive custom event tracking. You can track any user interaction, form submissions, button clicks, or any other custom events that are important to your business goals. Our API makes it easy to integrate with any framework or technology stack.",
  },
  {
    question: "How does the AI optimization work?",
    answer:
      "Our AI analyzes your website's performance data and automatically suggests optimizations for your workflows, helping you improve conversion rates without manual intervention. It learns from your data to provide increasingly accurate recommendations over time, identifying patterns and opportunities you might miss.",
  },
  {
    question: "Do I own my data?",
    answer:
      "Yes, you own 100% of your data. We provide data export capabilities and ensure your data is secure and private. You can export your data at any time, and we never share your data with third parties. Your data is stored securely with enterprise-grade encryption.",
  },
  {
    question: "How many websites can I track with one account?",
    answer:
      "Our free tier allows you to track up to 3 websites, while premium plans support unlimited websites. Each website gets its own analytics dashboard, workflow automation, and AI insights. You can manage all your websites from a single, unified dashboard.",
  },
  {
    question: "What kind of ROI can I expect from Seentics?",
    answer:
      "Most of our customers see a 20-40% increase in conversion rates within the first 3 months. The ROI comes from automated engagement, personalized experiences, and AI-driven optimizations that convert more visitors into customers. Many businesses see payback within the first month of use.",
  },
  {
    question: "Is Seentics GDPR and CCPA compliant?",
    answer:
      "Yes, Seentics is fully compliant with GDPR (European Union), CCPA (California), and other privacy regulations. We provide built-in cookie consent management, data export/deletion capabilities, and automated data retention policies. Users have full control over their data and can exercise their privacy rights at any time through our comprehensive privacy dashboard.",
  },
  {
    question: "How long does it take to set up and see results?",
    answer:
      "Setup takes just 5 minutes - simply add our tracking code to your website. You'll start seeing real-time analytics immediately. For workflow automation and AI insights, we recommend 2-4 weeks of data collection to provide the most accurate recommendations and optimizations.",
  },
  {
    question: "Can I integrate Seentics with other tools I'm already using?",
    answer:
      "Absolutely! Seentics integrates with popular platforms like Shopify, WordPress, Zapier, and many others. We also provide webhooks and APIs for custom integrations. You can connect your existing tools to create powerful automated workflows that work across your entire tech stack.",
  },
  {
    question: "How do you handle user consent and privacy preferences?",
    answer:
      "We provide granular cookie consent management that allows users to choose which types of tracking they accept (essential, analytics, marketing, preferences). Users can modify their preferences at any time, and we respect their choices across all sessions. Our system automatically adapts tracking based on user consent.",
  },
  {
    question: "What happens to user data over time?",
    answer:
      "We implement automated data retention policies that comply with privacy regulations. Analytics data is retained for 2 years, session data for 1 year, and workflow logs for 6 months. Before deletion, personal identifiers are anonymized to maintain data integrity while ensuring privacy compliance.",
  },
];

export default function FAQ() {
  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-200/20 dark:bg-purple-800/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-green-100/10 dark:bg-green-900/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="px-4 relative z-10">
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            FAQ
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white px-4 sm:px-0">
            Frequently Asked Questions
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto px-4 sm:px-0">
            Everything you need to know about Seentics and how it can transform your website analytics
          </p>
        </div>
        
        <div className="max-w-5xl mx-auto mb-20">
          <Accordion type="single" collapsible className="w-full space-y-6">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-slate-200/50 dark:border-slate-700/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                <AccordionTrigger className="text-left text-base sm:text-lg font-semibold text-slate-900 dark:text-white px-6 sm:px-8 py-6 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed px-6 sm:px-8 pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        
        {/* Enhanced Bottom CTA */}
        <div className="text-center">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl p-8 sm:p-12 border border-slate-200/50 dark:border-slate-700/50 shadow-xl max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Still Have Questions?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
              Can't find the answer you're looking for? Our team is here to help you get started.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="outline" className="px-6 py-3 font-semibold border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                Contact Support
              </Button>
              <Button className="px-6 py-3 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}