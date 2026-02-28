import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for The Graph subgraph queries.
 * Keeps the API key (BEARER_TOKEN) on the server — never exposed to the browser.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const subgraphUrl = process.env.SUBGRAPH_URL;
        if (!subgraphUrl) {
            return NextResponse.json(
                { error: 'SUBGRAPH_URL is not configured on the server' },
                { status: 500 }
            );
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (process.env.BEARER_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.BEARER_TOKEN}`;
        }

        const response = await fetch(subgraphUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error) {
        console.error('GraphQL proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch from subgraph' },
            { status: 500 }
        );
    }
}
