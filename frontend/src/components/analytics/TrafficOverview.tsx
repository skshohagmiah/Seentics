'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReactNode, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrafficChart } from './TrafficChart';

interface DailyStat {
  date: string;
  views: number;
  unique: number;
}

interface HourlyStat {
  timestamp: ReactNode;
  hour: number;
  views: number;
  unique: number;
}

interface DailyStats {
  daily_stats: DailyStat[];
}

interface HourlyStats {
  hourly_stats: HourlyStat[];
}

interface TrafficOverviewProps {
  dailyStats?: DailyStats;
  hourlyStats?: HourlyStats;
  isLoading?: boolean;
  className?: string;
}

export function TrafficOverview({ dailyStats, hourlyStats, isLoading = false, className = '' }: TrafficOverviewProps) {
  const [trafficTab, setTrafficTab] = useState<string>('chart');

  return (
    <Card className={`bg-card border-0 shadow-md mb-6 rounded-none ${className}`}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base sm:text-lg font-medium text-foreground">Traffic Overview</CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Daily traffic patterns and visitor trends</p>
        </div>
        <Tabs value={trafficTab} onValueChange={setTrafficTab} className="w-full sm:w-auto flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3 h-9 sm:h-8 gap-1">
            <TabsTrigger className='text-xs px-1 sm:px-2 md:px-3 truncate' value="chart">Chart</TabsTrigger>
            <TabsTrigger className='text-xs px-1 sm:px-2 md:px-3 truncate' value="table">Table</TabsTrigger>
            <TabsTrigger className='text-xs px-1 sm:px-2 md:px-3 truncate' value="hourly">Hourly</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="mt-0">
          {trafficTab === 'chart' && (
            <div className="h-[24rem] sm:h-[32rem]">
              <TrafficChart data={{ daily_stats: dailyStats?.daily_stats || [] }} isLoading={isLoading} />
            </div>
          )}
          {trafficTab === 'table' && (
            <div className="space-y-2">
              {dailyStats?.daily_stats?.sort((a: DailyStat, b: DailyStat) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              ).slice(0, 7).map((day: DailyStat, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/30 ">
                  <span className="text-sm text-foreground">{new Date(day.date).toLocaleDateString()}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">Views: {day.views}</span>
                    <span className="text-muted-foreground">Visitors: {day.unique}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {trafficTab === 'hourly' && (
            <div className="space-y-4">
              <div className="h-[32rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyStats?.hourly_stats?.sort((a: HourlyStat, b: HourlyStat) => a.hour - b.hour).slice(0, 24) || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="hour_label"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as HourlyStat;
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                              <p className="font-semibold">{data?.timestamp}</p>
                              <div className="space-y-1">
                                <p className="text-blue-600">
                                  {data.unique} visitors
                                </p>
                                <p className="text-green-600">
                                  {data.views} page views
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="unique"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.6}
                      name="Visitors"
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.4}
                      name="Page Views"
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span style={{ color: entry.color }} className="text-sm">
                          {value}
                        </span>
                      )}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {hourlyStats?.hourly_stats ? hourlyStats.hourly_stats.reduce((sum: number, hour: HourlyStat) => sum + hour.unique, 0) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Visitors</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {hourlyStats?.hourly_stats ? hourlyStats.hourly_stats.reduce((sum: number, hour: HourlyStat) => sum + hour.views, 0) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Views</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {hourlyStats?.hourly_stats ? Math.round(hourlyStats.hourly_stats.reduce((sum: number, hour: HourlyStat) => sum + hour.unique, 0) / 24) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Visitors/Hour</div>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {hourlyStats?.hourly_stats ? hourlyStats.hourly_stats.slice(0, 24).reduce((max: number, hour: HourlyStat) => Math.max(max, hour.unique), 0) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Peak Hour</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
