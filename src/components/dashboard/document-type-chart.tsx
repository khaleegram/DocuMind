'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { Document } from '@/lib/types';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChartData = {
  name: string;
  total: number;
};

export function getChartData(documents: Document[]): ChartData[] {
    const typeCounts = documents.reduce((acc, doc) => {
        const type = doc.type || 'Uncategorized';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);
}


export function DocumentTypeChart({ chartData }: { chartData: ChartData[] }) {
    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>No document data available.</p>
            </div>
        )
    }
  return (
    <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" hide />
            <YAxis
                dataKey="name"
                type="category"
                width={80}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                interval={0}
            />
             <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                }}
             />
            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
        </ResponsiveContainer>
    </div>
  );
}
