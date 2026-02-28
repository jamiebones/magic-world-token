# MWGOrderBook Subgraph

Indexes all `MWGOrderBook` contract events on BSC Mainnet into a GraphQL API via The Graph Studio.  
The API backend uses this to catch up on missed events without hitting RPC rate limits.

## Setup

```bash
cd subgraph
npm install
```

## Find the Correct Start Block

Look up the deployment transaction on BSCScan to get the exact block number:

```
https://bscscan.com/tx/0xe0a2a4d67280726e1e6562e812d89a87d6ee4500a28de72809eecb3b2f148190
```

Update `startBlock` in [subgraph.yaml](./subgraph.yaml) with the exact block number.

## Deploy to The Graph Studio

### 1. Authenticate

Get your deploy key from https://thegraph.com/studio

```bash
npx graph auth --studio <DEPLOY_KEY>
```

### 2. Create the subgraph in The Graph Studio

Go to https://thegraph.com/studio → **Create a Subgraph** → name it `mwg-order-book`.

### 3. Generate types & build

```bash
npm run codegen   # generates AssemblyScript types from ABI + schema
npm run build     # compiles the subgraph
```

### 4. Deploy

```bash
npm run deploy:studio
```

### 5. Get the query URL

After deploying, The Graph Studio gives you a **Query URL** like:

```
https://api.studio.thegraph.com/query/<ID>/mwg-order-book/version/latest
```

Set this in your API `.env`:

```env
ORDERBOOK_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<ID>/mwg-order-book/version/latest
```

## Entities

| Entity | Description |
|---|---|
| `Order` | Every order created, with current status/filled/remaining |
| `OrderFill` | Every fill event with amounts and filler address |
| `OrderCancellation` | Cancelled orders with refund amounts |
| `Withdrawal` | BNB withdrawals claimed by users |

## Example Query

```graphql
{
  orders(
    where: { user: "0xabc...", status: 0 }
    orderBy: createdAt
    orderDirection: desc
    first: 50
  ) {
    orderId
    orderType
    mwgAmount
    bnbAmount
    pricePerMWG
    status
    filled
    remaining
    createdAt
    expiresAt
  }
}
```

## Networks

| Network | Contract Address |
|---|---|
| BSC Mainnet | `0xE5214A2bC38edD3bCf0852aebE448c853dd9C3eF` |
| BSC Testnet | `0xe9Cd180b882830f9cbc9200eb40Ee2a5844649a6` |

To index the testnet as well, duplicate `subgraph.yaml` and change `network: bsc` → `network: chapel`
and the `address` and `startBlock` accordingly.
