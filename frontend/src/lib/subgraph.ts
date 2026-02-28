/**
 * Lightweight GraphQL client for querying The Graph subgraph.
 * No dependencies — uses native fetch.
 *
 * Queries go through /api/subgraph (Next.js API route) which proxies
 * to The Graph gateway with the Bearer token server-side, so the
 * API key is never exposed to the browser.
 */

interface GraphQLResponse<T> {
    data?: T;
    errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against the orderbook subgraph via the local proxy
 */
export async function querySubgraph<T>(
    query: string,
    variables: Record<string, unknown> = {}
): Promise<T> {
    const response = await fetch('/api/subgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(`[subgraph] HTTP ${response.status}: ${text}`);
        throw new Error(`Subgraph HTTP error: ${response.status}`);
    }

    const json: GraphQLResponse<T> = await response.json();

    if (json.errors?.length) {
        console.error('[subgraph] Query errors:', json.errors);
        throw new Error(`Subgraph query error: ${json.errors.map(e => e.message).join(', ')}`);
    }

    if (!json.data) {
        throw new Error('Subgraph returned no data');
    }

    return json.data;
}
