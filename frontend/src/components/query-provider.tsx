
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient();

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    // Provide the client to your App
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
