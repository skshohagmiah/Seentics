'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Check, 
  ArrowUpRight,
  Calendar,
  TrendingUp,
  Globe,
  Workflow,
  Target,
  BarChart3
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/stores/useAuthStore';
import api from '@/lib/api';
import { toast } from 'sonner';

const planFeatures = {
  free: [
    '1 Website',
    '1,000 Monthly Events',
    '1 Workflow',
    '1 Funnel',
    'Basic Analytics',
    'Email Support',
    'Privacy Compliant',
    'Limited integrations',
    'Basic reporting'
  ],
  standard: [
    '5 Websites',
    '100,000 Monthly Events',
    '10 Workflows',
    '10 Funnels',
    'Advanced Analytics',
    'Priority Support',
    'Custom Domains',
    'API Access',
    'Advanced Integrations',
    'A/B Testing'
  ],
  pro: [
    '10 Websites',
    '500,000 Monthly Events',
    '30 Workflows',
    '30 Funnels',
    'Enterprise Analytics',
    '24/7 Priority Support',
    'White-label Options',
    'Advanced API Access',
    'Custom Integrations',
    'Advanced A/B Testing',
    'Team Collaboration'
  ]
};

const planPricing = {
  free: { price: 0, period: 'forever' },
  standard: { price: 19, period: 'per month' },
  pro: { price: 49, period: 'per month' }
};

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const { 
    subscription, 
    loading, 
    error, 
    refetch, 
    getUsagePercentage, 
    isNearLimit, 
    hasReachedLimit 
  } = useSubscription();

  // Handle checkout creation
  const handleUpgrade = async (plan: 'standard' | 'pro') => {
    if (!user) {
      toast.error('Please log in to upgrade your plan');
      return;
    }

    setCheckoutLoading(plan);
    
    try {
      const response = await api.post('/user/billing/checkout', { plan });
      
      if (response.data.success) {
        // Redirect to LemonSqueezy checkout
        window.open(response.data.data.checkoutUrl, '_blank');
        toast.success('Redirecting to checkout...');
      } else {
        throw new Error(response.data.message || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to create checkout session');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading billing information</p>
          <Button onClick={refetch} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan || 'free';
  const usage = subscription?.usage;

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'pro': return <Crown className="h-5 w-5 text-yellow-500" />;
      case 'standard': return <Zap className="h-5 w-5 text-blue-500" />;
      default: return <Globe className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'pro': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
      case 'standard': return 'bg-gradient-to-r from-blue-500 to-purple-600 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Usage</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
            Manage your subscription and monitor usage across all features
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getPlanIcon(currentPlan)}
          <Badge className={`${getPlanBadgeColor(currentPlan)} font-semibold`}>
            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-200 dark:bg-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage Details</TabsTrigger>
          <TabsTrigger value="plans">Upgrade Plans</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Plan Card */}
            <Card className="col-span-1 md:col-span-2 p-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CreditCard className="h-6 w-6" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      {getPlanIcon(currentPlan)}
                      <h3 className="text-3xl font-bold capitalize">{currentPlan}</h3>
                    </div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">
                      ${planPricing[currentPlan as keyof typeof planPricing].price}
                      {planPricing[currentPlan as keyof typeof planPricing].period !== 'forever' && (
                        <span className="ml-1">{planPricing[currentPlan as keyof typeof planPricing].period}</span>
                      )}
                    </p>
                  </div>
                  {currentPlan !== 'pro' && (
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-base"
                      onClick={() => handleUpgrade(currentPlan === 'free' ? 'standard' : 'pro')}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      ) : (
                        <ArrowUpRight className="h-5 w-5 mr-2" />
                      )}
                      {checkoutLoading ? 'Creating checkout...' : 'Upgrade'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Next Billing Date */}
            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5" />
                  Next Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-3xl font-bold">
                  {currentPlan === 'free' ? 'Never' : 'Oct 14, 2024'}
                </p>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                  {currentPlan === 'free' ? 'Free forever' : 'Auto-renewal'}
                </p>
              </CardContent>
            </Card>

            {/* Monthly Events */}
            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5" />
                  Events This Month
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-3xl font-bold">
                  {usage?.monthlyEvents?.current?.toLocaleString() || '0'}
                </p>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                  of {usage?.monthlyEvents?.limit?.toLocaleString() || '1,000'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Usage Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5" />
                  Websites
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span>{usage?.websites?.current || 0} / {usage?.websites?.limit || 1}</span>
                    <span className={getUsageColor(getUsagePercentage('websites') || 0)}>
                      {Math.round(getUsagePercentage('websites') || 0)}%
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage('websites') || 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="h-5 w-5" />
                  Workflows
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span>{usage?.workflows?.current || 0} / {usage?.workflows?.limit || 5}</span>
                    <span className={getUsageColor(getUsagePercentage('workflows') || 0)}>
                      {Math.round(getUsagePercentage('workflows') || 0)}%
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage('workflows') || 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-5 w-5" />
                  Funnels
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span>{usage?.funnels?.current || 0} / {usage?.funnels?.limit || 3}</span>
                    <span className={getUsageColor(getUsagePercentage('funnels') || 0)}>
                      {Math.round(getUsagePercentage('funnels') || 0)}%
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage('funnels') || 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="p-5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Monthly Events
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-base">
                    <span>{usage?.monthlyEvents?.current?.toLocaleString() || 0} / {usage?.monthlyEvents?.limit?.toLocaleString() || '1K'}</span>
                    <span className={getUsageColor(getUsagePercentage('monthlyEvents') || 0)}>
                      {Math.round(getUsagePercentage('monthlyEvents') || 0)}%
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage('monthlyEvents') || 0} 
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Details Tab */}
        <TabsContent value="usage" className="space-y-6">
          <Card className="p-6">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl">Detailed Usage Statistics</CardTitle>
              <CardDescription className="text-base mt-2">
                Monitor your usage across all features and plan limits
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-8">
                {Object.entries(usage || {}).map(([key, data]) => {
                  const percentage = getUsagePercentage(key as any) || 0;
                  const isNearLimitValue = isNearLimit(key as any) || false;
                  const hasReachedLimitValue = hasReachedLimit(key as any) || false;
                  
                  return (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-lg capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </h4>
                          {hasReachedLimitValue && (
                            <Badge variant="destructive" className="text-xs">Limit Reached</Badge>
                          )}
                          {isNearLimitValue && !hasReachedLimitValue && (
                            <Badge variant="secondary" className="text-xs">Near Limit</Badge>
                          )}
                        </div>
                        <div className="text-base text-gray-600 dark:text-gray-400">
                          {data.current?.toLocaleString()} / {data.limit?.toLocaleString()}
                        </div>
                      </div>
                      <Progress value={percentage} className="h-4" />
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>{Math.round(percentage)}% used</span>
                        <span>{(data.limit - data.current)?.toLocaleString()} remaining</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(planFeatures).map(([plan, features]) => {
              const isCurrentPlan = plan === currentPlan;
              const pricing = planPricing[plan as keyof typeof planPricing];
              
              return (
                <Card key={plan} className={`relative ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''} ${plan === 'pro' ? 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50' : ''}`}>
                  {plan === 'pro' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-blue-500 text-white">Current Plan</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-2">
                      {getPlanIcon(plan)}
                    </div>
                    <CardTitle className="capitalize text-xl">{plan}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">
                        ${pricing.price}
                      </span>
                      {pricing.period !== 'forever' && (
                        <span className="text-lg text-gray-600 dark:text-gray-400 ml-1">
                          {pricing.period}
                        </span>
                      )}
                    </div>
                    <CardDescription>
                      {pricing.period === 'forever' ? 'Perfect for getting started' : 
                       plan === 'standard' ? 'Great for growing businesses' : 
                       'For scaling teams and agencies'}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {isCurrentPlan ? (
                      <Button 
                        className="w-full opacity-50 cursor-not-allowed"
                        disabled={true}
                      >
                        Current Plan
                      </Button>
                    ) : plan === 'free' ? (
                      <Button 
                        className="w-full"
                        disabled={true}
                      >
                        Downgrade (Contact Support)
                      </Button>
                    ) : (
                      <Button 
                        className={`w-full ${plan === 'pro' ? 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700' : ''}`}
                        onClick={() => handleUpgrade(plan as 'standard' | 'pro')}
                        disabled={checkoutLoading !== null}
                      >
                        {checkoutLoading === plan ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating checkout...
                          </>
                        ) : (
                          `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
