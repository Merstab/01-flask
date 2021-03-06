<img src="/01-Flask-Banner.svg">

# 01-Flask: real-time WS market data API for 01 Exchange

<br/>

## Why?

We all know that 01 Exchange is awesome, but since it's a new ecosystem, tooling around it may not be so convenient especially from centralized exchange API users perspective. 01-Flask which is a real-time WebSocket market data API server for 01 Exchange hopes to alleviate some of those issues by offering:

- **familiar experience for centralized exchanges APIs users**

  - **WebSocket API with Pub/Sub flow** - subscribe to selected channels and markets and receive real-time data as easy to parse JSON messages that can be consumed from any language supporting WebSocket protocol

  - **incremental L2 order book updates** - instead of decoding 01 Exchange market `asks` and `bids` accounts for each account change in order to detect order book updates, receive [initial L2 snapshot](#l2snapshot) and [incremental updates](#l2update) as JSON messages real-time over WebSocket connection

  - **tick-by-tick trades** - instead of decoding `eventQueue` account data which is quite large (> 1MB) and in practice it's hard to consume real-time directly from Solana RPC node due to it's size, receive individual [`trade`](#trade) messages real-time over WebSocket connection

  - **real-time L3 data** - receive the most granular updates on individual order level: [`open`](#open), [`change`](#change), [`fill`](#fill) and [`done`](#done) messages for every order that 01 Exchange processes

- **decreased load and bandwidth consumption for Solana RPC nodes hosts** - by providing real-time market data API via 01-Flask server instead of RPC node directly, hosts can decrease substantially both CPU load and bandwidth requirements as only 01-Flask will be direct consumer of RPC API when it comes to market data accounts changes and will efficiently normalize and broadcast small JSON messages to all connected clients

## What about placing/cancelling orders endpoints?

01-flask provides real-time market data only and does not include endpoints for placing/canceling or tracking your own orders as that requires handling private keys which is currently out of scope of this project.

However, please check https://github.com/01protocol for updates on clients that help with order placing/canceling. 

<br/>
<br/>

## Getting started

Run the code snippet below in the browser Dev Tools directly or in Node.js

```js
// connect to 01-flask server running locally
const ws = new WebSocket("ws://localhost:8000/v1/ws");

ws.onmessage = (message) => {
  console.log(JSON.parse(message.data));
};

ws.onopen = () => {
  // subscribe both to trades and level2 real-time channels
  const subscribeTrades = {
    op: "subscribe",
    channel: "trades",
    markets: ["SOL-PERP"],
  };

  const subscribeL2 = {
    op: "subscribe",
    channel: "level2",
    markets: ["SOL-PERP"],
  };

  ws.send(JSON.stringify(subscribeTrades));
  ws.send(JSON.stringify(subscribeL2));
};
```

<br/>
<br/>

Since by default 01-flask uses [`confirmed` commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) for getting accounts notification from RPC node, it may sometimes feel slightly slower when it comes to order book updates vs default DEX UI which uses [`recent/processed` commitment](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment), but data is more accurate on the other hand.

Trade data is published faster since by default DEX UI is pooling `eventQueue` account data on interval due to it's size (> 1MB), and 01-flask uses real-time `eventQueue` account notification as a source for trade messages which aren't delayed by pooling interval time.

<br/>
<br/>

## Installation

---

# IMPORTANT NOTE

For the best 01-flask data reliability it's advised to [set up a dedicated Solana RPC node](https://docs.solana.com/running-validator) and connect `01-flask` to it instead of default `https://solana-api.projectserum.com` which may rate limit or frequently restart Websocket RPC connections since it's a public node used by many.

---

<br/>
<br/>

### npx <sub>(requires Node.js >= 15 and git installed on host machine)</sub>

Installs and starts 01-flask server running on port `8000`.

```sh
npx ynpx 01-flask
```
or
```sh
npx 01-flask
```

If you'd like to switch to different Solana RPC node endpoint like for example devnet one, change port or run with debug logs enabled, just add one of the available CLI options.

```sh
npx ynpx 01-flask --cluster devnet --endpoint https://api.devnet.solana.com --ws-endpoint-port 8899 --log-level debug --port 8900
```

Alternatively you can install 01-flask globally.

```sh
yarn global add 01-flask
01-flask
```

<br/>

#### CLI options

| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | default                             | description                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port`                                                                                                                                                                                                                                                                                                  | 8000                                | Port to bind server on                                                                                                                                                                             |
| `endpoint`                                                                                                                                                                                                                                                                                              | https://solana-api.projectserum.com | Solana RPC node endpoint that 01-flask uses as a data source                                                                                                                                       |
| `ws-endpoint-port`                                                                                                                                                                                                                                                                                      | -                                   | Optional Solana RPC WS node endpoint port that 01-flask uses as a data source (if different than REST endpoint port) source                                                                        |
| `log-level`                                                                                                                                                                                                                                                                                             | info                                | Log level, available options: debug, info, warn and error                                                                                                                                          |
| `minions-count`                                                                                                                                                                                                                                                                                         | 1                                   | [Minions worker threads](#architecture) count that are responsible for broadcasting normalized WS messages to connected clients                                                                    |
| `boot-delay`                                                                                                                                                                                                                                                                                            | 500                                 | Staggered boot delay in milliseconds so public RPC nodes do not rate limit 01-flask                                                                                                                |
| `commitment`                                                                                                                                                                                                                                                                                            | confirmed                           | [Solana commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) to use when communicating with RPC node, available options: confirmed and processed |
| `cluster`                                                                                                                                                                                                                                                                                               | `mainnet-beta`                      | Solana cluster to connect to                                                                                                                                                                       |

<br/>

Run `npx 01-flask --help` or `npx ynpx 01-flask --help` to see all available startup options.

<br/>
<br/>

### SSL/TLS Support

01-flask supports [SSL/TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) but it's not enabled by default. In order to enable it you need to set `CERT_FILE_NAME` env var pointing to the certificate file and `KEY_FILE_NAME` pointing to private key of that certificate.

<br/>
<br/>

## WebSocket API

WebSocket API provides real-time market data feeds of 01 Exchange and uses a bidirectional protocol which encodes all messages as JSON objects.

<br/>

### Endpoint URL

- **[ws://localhost:8000/v1/ws](ws://localhost:8000/v1/ws)** - assuming 01-flask runs locally on default port without SSL enabled

<br/>

### Subscribing to data feeds

To begin receiving real-time market data feed messages, you must first send a subscribe message to the server indicating [channels](#supported-channels--corresponding-message-types) and [markets](#supported-markets) for which you want the data for.

If you want to unsubscribe from channel and markets, send an unsubscribe message. The structure is equivalent to subscribe messages except `op` field which should be set to `"op": "unsubscribe"`.

```js
const ws = new WebSocket("ws://localhost:8000/v1/ws");

ws.onopen = () => {
  const subscribeL2 = {
    op: "subscribe",
    channel: "level2",
    markets: ["SOL-PERP"],
  };

  ws.send(JSON.stringify(subscribeL2));
};
```

<br/>

#### Subscribe/unsubscribe message format

- see [supported channels & corresponding data messages types](#supported-channels--corresponding-message-types)
- see [supported markets](#supported-markets)

```ts
{
  "op": "subscribe" | "unsubscribe",
  "channel": "level3" | "level2" | "level1" | "trades",
  "markets": string[]
}
```

##### sample `subscribe` message

```json
{
  "op": "subscribe",
  "channel": "level2",
  "markets": ["SOL-PERP"]
}
```

<br/>

#### Subscription confirmation message format

Once a subscription (or unsubscription) request is processed by the server, it will push `subscribed` (or `unsubscribed`) confirmation message or `error` if received request message was invalid.

```ts
{
"type": "subscribed" | "unsubscribed",
"channel": "level3" | "level2" | "level1" | "trades",
"markets": string[],
"timestamp": string
}
```

##### sample `subscribed` confirmation message

```json
{
  "type": "subscribed",
  "channel": "level2",
  "markets": ["SOL-PERP"],
  "timestamp": "2022-05-03T06:23:26.465Z"
}
```

<br/>

#### Error message format

Error message is pushed for invalid subscribe/unsubscribe messages - non existing market, invalid channel name etc.

```ts
{
  "type": "error",
  "message": "string,
  "timestamp": "string
}
```

##### sample `error` message

```json
{
  "type": "error",
  "message": "Invalid channel provided: 'levels1'.",
  "timestamp": "2021-03-23T17:13:31.010Z"
}
```

<br/>
<br/>

### Supported channels & corresponding message types

When subscribed to the channel, server will push the data messages as specified below.

- `trades`

  - [`recent_trades`](#recent_trades)
  - [`trade`](#trade)

- `level1`

  - [`quote`](#quote)

- `level2`

  - [`l2snapshot`](#l2snapshot)
  - [`l2update`](#l2update)

- `level3`

  - [`l3snapshot`](#l3snapshot)
  - [`open`](#open)
  - [`fill`](#fill)
  - [`change`](#change)
  - [`done`](#done)

<br/>
<br/>

### Supported markets

Markets supported by 01-flask server can be queried via [`GET /markets`](#get-markets) HTTP endpoint (`[].name` field).

<br/>
<br/>

### Data messages

- `type` is determining message's data type so it can be handled appropriately

- `timestamp` when message has been received from node RPC API in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format with milliseconds, for example: "2021-03-23T17:03:03.994Z"

- `slot` is a [Solana's slot](https://docs.solana.com/terminology#slot) number for which message has produced

- `price` and `size` are provided as strings to preserve precision

<br/>

#### `recent_trades`

Up to 100 recent trades pushed immediately after successful subscription confirmation.

- every trade in `trades` array has the same format as [`trade`](#trade) message
- trades are ordered from oldest to newest

```ts
{
  "type": "recent_trades",
  "market": string,
  "trades": Trade[],
  "timestamp": string
}
```

<!-- to updatd -->

#### sample `recent_trades` message

```json
{
  "type": "recent_trades",
  "market": "SOL-PERP",
  "timestamp": "2021-03-24T07:05:27.377Z",
  "trades": [
    {
      "type": "trade",
      "market": "SOL-PERP",
      "timestamp": "2021-12-23T14:31:16.733Z",
      "slot": 112915164,
      "id": "3313016788894161792503559|3313035235638235438412464",
      "side": "sell",
      "price": "179.599",
      "size": "125.4",
      "takerAccount": "AAddgLu9reZCUWW1bNQFaXrCMAtwQpMRvmeusgk4pCM6",
      "makerAccount": "EpAdzaqV13Es3x4dukfjFoCrKVXnZ7y9Y76whgMHo5qx",
      "takerOrderId": "3313016788894161792503559",
      "makerOrderId": "3313035235638235438412464",
      "takerClientId": "875345",
      "makerClientId": "875345",
      "takerFeeCost": -3.2,
      "makerFeeCost": 15.4
    }
  ]
}
```

<br/>

#### `trade`

Pushed real-time for each trade as it happens on a DEX (decoded from the `eventQueue` account).

- `side` describes a liquidity taker side

- `id` field is an unique id constructed by joining fill taker and fill maker order id

```ts
{
  "type": "trade",
  "market": string,
  "timestamp": string,
  "slot": number,
  "id": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "takerAccount": string,
  "makerAccount": string,
  "takerOrderId": string,
  "makerOrderId": string,
  "takerClientId": string,
  "makerClientId": string,
  "takerFeeCost": number,
  "makerFeeCost": number
}
```

#### sample `trade` message

```json
{
  "type": "trade",
  "market": "SOL-PERP",
  "timestamp": "2021-12-23T14:31:16.733Z",
  "slot": 112915164,
  "id": "3313016788894161792503559|3313035235638235438412464",
  "side": "sell",
  "price": "179.599",
  "size": "125.4",
  "takerAccount": "AAddgLu9reZCUWW1bNQFaXrCMAtwQpMRvmeusgk4pCM6",
  "makerAccount": "EpAdzaqV13Es3x4dukfjFoCrKVXnZ7y9Y76whgMHo5qx",
  "takerOrderId": "3313016788894161792503559",
  "makerOrderId": "3313035235638235438412464",
  "takerClientId": "875345",
  "makerClientId": "875345",
  "takerFeeCost": -3.2,
  "makerFeeCost": 15.4
}
```

<br/>

### `quote`

Pushed real-time for any change in best bid/ask price or size for a given market (decoded from the `bids` and `asks` accounts).

- `bestAsk` and `bestBid` are tuples where first item is a price and second is a size of the best bid/ask level

```ts
{
  "type": "quote",
  "market": string,
  "timestamp": string,
  "slot": number,
  "bestAsk": [price: string, size: string] | undefined,
  "bestBid": [price: string, size: string] | undefined
}
```

#### sample `quote` message

```json
{
  "type": "quote",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T06:30:57.534Z",
  "slot": 132269778,
  "bestAsk": ["88.66", "0.01"],
  "bestBid": ["88.49", "193.58"]
}
```

<br/>

### `l2snapshot`

Entire up-to-date order book snapshot with orders aggregated by price level pushed immediately after successful subscription confirmation.

- `asks` and `bids` arrays contain tuples where first item of a tuple is a price level and second one is a size of the resting orders at that price level

- it can be pushed for an active connection as well when underlying server connection to the RPC node has been restarted, in such scenario locally maintained order book should be re-initialized with a new snapshot

- together with [`l2update`](#l2update) messages it can be used to maintain local up-to-date full order book state

```ts
{
  "type": "l2snapshot",
  "market": string,
  "timestamp": string,
  "slot": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2snapshot` message

```json
{
  "type": "l2snapshot",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T06:23:25.202Z",
  "slot": 132269086,
  "asks": [
    ["88.57", "402.43"],
    ["88.58", "223.18"],
    ["88.62", "374.10"]
  ],
  "bids": [
    ["88.47", "360.14"],
    ["88.43", "238.54"],
    ["88.41", "329.56"]
  ]
}
```

<br/>

### `l2update`

Pushed real-time for any change to the order book for a given market with updated price levels and sizes since the previous update (decoded from the `bids` and `asks` accounts).

- together with [`l2snapshot`](#l2snapshot), `l2update` messages can be used to maintain local up-to-date full order book state

- `asks` and `bids` arrays contain updates which are provided as a tuples where first item is an updated price level and second one is an updated size of the resting orders at that price level (absolute value, not delta)

- if size is set to `0` it means that such price level does not exist anymore and shall be removed from locally maintained order book

```ts
{
  "type": "l2update",
  "market": string,
  "timestamp": string,
  "slot": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2update` message

```json
{
  "type": "l2update",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T06:23:37.043Z",
  "slot": 132269109,
  "asks": [["88.58", "0.00"]],
  "bids": [["88.47", "0.00"]]
}
```

<br/>

### `l3snapshot`

Entire up-to-date order book snapshot with **all individual orders** pushed immediately after successful subscription confirmation.

- `clientId` is an client provided order id for an order

- `account` is an open orders account address

- `accountSlot` is a an open orders account slot number

- together with [`open`](#open), [`change`](#change), [`fill`](#fill) and [`done`](#done) messages it can be used to maintain local up to date Level 3 order book state

- it can be pushed for an active connection as well when underlying server connection to the RPC node has been restarted, in such scenario locally maintained L3 order book should be re-initialized with a new snapshot

```ts
{
  "type": "l3snapshot",
  "market": string,
  "timestamp": string,
  "slot": number,
  "asks": {
    "price": string,
    "size": string,
    "side": "sell",
    "orderId": string,
    "clientId": string,
    "account": string,
    "accountSlot": number,
    "feeTier": number
  }[],
  "bids": {
    "price": string,
    "size": string,
    "side": "buy",
    "orderId": string,
    "clientId": string,
    "account": string,
    "accountSlot": number,
    "feeTier": number
  }[]
}
```

#### sample `l3snapshot` message

```json
{
  "type": "l3snapshot",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T05:49:54.373Z",
  "slot": 132265771,
  "asks": [
    {
      "orderId": "163216791564182114193437",
      "clientId": "4188332214832328",
      "side": "sell",
      "price": "88.48",
      "size": "1370.25",
      "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
      "accountSlot": 20,
      "feeTier": 0
    }
  ],
  "bids": [
    {
      "orderId": "163143004587887272996795",
      "clientId": "2730876439674435",
      "side": "buy",
      "price": "88.43",
      "size": "186.84",
      "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
      "accountSlot": 37,
      "feeTier": 0
    }
  ]
}
```

### `open`

Pushed real-time for every new order opened on the limit order book (decoded from the `bids` and `asks` accounts).

- **no** `open` messages are pushed for order that are filled or canceled immediately, for example - `ImmediateOrCancel` orders

```ts
{
  "type": "open",
  "market": string,
  "timestamp": string,
  "slot": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `open` message

```json
{
  "type": "open",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T05:53:15.475Z",
  "slot": 132266095,
  "orderId": "162294454360496633622415",
  "clientId": "3369934981100872",
  "side": "buy",
  "price": "87.97",
  "size": "2426.12",
  "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
  "accountSlot": 81,
  "feeTier": 0
}
```

<br/>

### `change`

Pushed real-time anytime order size changes as a result of self-trade prevention (decoded from the `bids` and `asks` accounts).

- `size` field contains updated order size

```ts
{
  "type": "change",
  "market": string,
  "timestamp": string,
  "slot": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `change` message

```json
{
  "type": "change",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T06:52:20.141Z",
  "slot": 132266103,
  "orderId": "10352165200213210691454558",
  "clientId": "15125925100673159264",
  "side": "sell",
  "price": "86.20",
  "size": "8.4494",
  "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
  "accountSlot": 6,
  "feeTier": 3
}
```

<br/>

### `fill`

Pushed real-time anytime trade happens (decoded from the `eventQueue` accounts).

- there are always two `fill` messages for a trade, one for a maker and one for a taker order

- `feeCost` is provided in a quote currency

```ts
{
  "type": "fill",
  "market": string,
  "timestamp": string,
  "slot": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "price": string,
  "size": string,
  "maker" boolean,
  "feeCost" number,
  "account": string,
  "accountSlot": number,
  "feeTier": number
}
```

#### sample `fill` message

```json
{
  "type": "fill",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T05:52:20.141Z",
  "slot": 132266003,
  "orderId": "163364365516771787616164",
  "clientId": "3169423765462594",
  "side": "buy",
  "price": "88.50",
  "size": "0.01",
  "maker": false,
  "feeCost": 0.000886,
  "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
  "accountSlot": 61,
  "feeTier": 0
}
```

<br/>

### `done`

Pushed real-time when the order is no longer on the order book (decoded from the `eventQueue` accounts).

- this message can result from an order being canceled or filled (`reason` field)

- there will be no more messages for this `orderId` after a `done` message

- it can be pushed for orders that were never `open` in the order book in the first place (`ImmediateOrCancel` orders for example)

- `sizeRemaining` field is available only since v1.3.2 and only for canceled orders (`reason="canceled"`)

```ts
{
  "type": "done",
  "market": string,
  "timestamp": string,
  "slot": number,
  "orderId": string,
  "clientId": string,
  "side": "buy" | "sell",
  "reason" : "canceled" | "filled",
  "sizeRemaining": string | undefined
  "account": string,
  "accountSlot": number
}
```

### sample `done` message

```json
{
  "type": "done",
  "market": "SOL-PERP",
  "timestamp": "2022-05-03T05:53:21.177Z",
  "slot": 132266104,
  "orderId": "163235238308255820754858",
  "clientId": "2722683401003912",
  "side": "buy",
  "reason": "canceled",
  "account": "3z5HfN7PtvCNLwcNrwWWPrD4JpByNJxfwKoWv1rsV6ro",
  "accountSlot": 55,
  "sizeRemaining": "500.66"
}
```

###

<br/>
<br/>

## HTTP API

### GET `/markets`

Returns 01 Exchange markets list supported by 01-flask instance (it can be updated by providing custom markets.json file).

<br/>

### Endpoint URL

- [http://localhost:8000/v1/markets](http://localhost:8000/v1/markets) - assuming 01-flask runs locally on default port without SSL enabled

<!-- - [https://api.01-flask.dev/v1/markets](https://api.01-flask.dev/v1/markets) - hosted 01-flask server endpoint -->

<br/>

### Response format

```ts
{
  "name": string,
  "baseMintAddress": string,
  "quoteMintAddress": string,
  "address": string,
  "programId": string,
  "tickSize": number,
  "minOrderSize": number,
}[]
```

#### sample response

```json
[
  {
    "name": "SOL-PERP",
    "baseCurrency": "SOL",
    "quoteCurrency": "USDC",
    "address": "EqZrg5VzrJdBs9EnUBURXJMyhHZ5A4YeX57g62Uufk8w",
    "programId": "ZDx8a8jBqGmJyxi1whFxxCo5vG6Q9t4hTzW2GSixMKK",
    "tickSize": 0.1,
    "minOrderSize": 0.0001
  }
]
```

<br/>
<br/>

<!-- ## Architecture

![architecture diagram](https://user-images.githubusercontent.com/51779538/112750634-f4037d80-8fc9-11eb-8ce3-a0798b6790e8.png)

<br/>
<br/> -->

## Credits

##### This project was possible thanks to [01 Exchange Grant](https://01exchange.notion.site/01-Exchange-Grants-Program-ecbab6fde93843caa6924fb5cda3b79e).

<br/>
<br/>

## References

- tardis-dev [Mango-bowl](https://github.com/tardis-dev/mango-bowl)
- tardis-dev [Serum-vial](https://github.com/tardis-dev/serum-vial)
