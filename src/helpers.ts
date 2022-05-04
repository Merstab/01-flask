import { Connection } from '@solana/web3.js'
import {
  Cluster,
  createProgram,
  createProvider,
  State,
  ZO_DEVNET_STATE_KEY,
  ZO_DEX_DEVNET_PROGRAM_ID,
  ZO_DEX_MAINNET_PROGRAM_ID,
  ZO_MAINNET_STATE_KEY
} from '@zero_one/client'
import didYouMean from 'didyoumean2'
import { ZoMarketInfo } from './types'

export const wait = (delayMS: number) => new Promise((resolve) => setTimeout(resolve, delayMS))

export function getDidYouMean(input: string, allowedValues: readonly string[]) {
  let tip = ''

  if (typeof input === 'string') {
    let result = didYouMean(input, allowedValues, {})
    if (result !== null) {
      tip = ` Did you mean '${result}'?`
    }
  }
  return tip
}

export function getAllowedValuesText(allowedValues: readonly string[]) {
  return `Allowed values: ${allowedValues.map((val) => `'${val}'`).join(', ')}.`
}

export function* batch<T>(items: T[], batchSize: number) {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize)
  }
}

// https://stackoverflow.com/questions/9539513/is-there-a-reliable-way-in-javascript-to-obtain-the-number-of-decimal-places-of?noredirect=1&lq=1

export function decimalPlaces(n: number) {
  // Make sure it is a number and use the builtin number -> string.
  var s = '' + +n
  // Pull out the fraction and the exponent.
  var match = /(?:\.(\d+))?(?:[eE]([+\-]?\d+))?$/.exec(s)
  // NaN or Infinity or integer.
  // We arbitrarily decide that Infinity is integral.
  if (!match) {
    return 0
  }
  // Count the number of digits in the fraction and subtract the
  // exponent to simulate moving the decimal point left by exponent places.
  // 1.234e+2 has 1 fraction digit and '234'.length -  2 == 1
  // 1.234e-2 has 5 fraction digit and '234'.length - -2 == 5

  return Math.max(
    0, // lower limit.
    (match[1] == '0' ? 0 : (match[1] || '').length) - // fraction length
      (+match[2]! || 0)
  ) // exponent
}

export class CircularBuffer<T> {
  private _buffer: T[] = []
  private _index: number = 0
  constructor(private readonly _bufferSize: number) {}

  append(value: T) {
    const isFull = this._buffer.length === this._bufferSize
    let poppedValue
    if (isFull) {
      poppedValue = this._buffer[this._index]
    }
    this._buffer[this._index] = value
    this._index = (this._index + 1) % this._bufferSize

    return poppedValue
  }

  *items() {
    for (let i = 0; i < this._buffer.length; i++) {
      const index = (this._index + i) % this._buffer.length
      yield this._buffer[index]!
    }
  }

  get count() {
    return this._buffer.length
  }

  clear() {
    this._buffer = []
    this._index = 0
  }
}

const { BroadcastChannel } = require('worker_threads')

export const minionReadyChannel = new BroadcastChannel('MinionReady') as BroadcastChannel
export const zoProducerReadyChannel = new BroadcastChannel('ZoProducerReady') as BroadcastChannel
export const zoDataChannel = new BroadcastChannel('ZoData') as BroadcastChannel
export const zoMarketsChannel = new BroadcastChannel('ZoMarkets') as BroadcastChannel
export const cleanupChannel = new BroadcastChannel('Cleanup') as BroadcastChannel

export async function executeAndRetry<T>(
  operation: (attempt: number) => Promise<T>,
  { maxRetries }: { maxRetries: number }
): Promise<T> {
  let attempts = 0
  while (true) {
    attempts++
    try {
      return await operation(attempts)
    } catch (err) {
      if (attempts > maxRetries) {
        throw err
      }

      await wait(500 * attempts * attempts)
    }
  }
}

// takes cluster and endpoint to read market info from sdk as there is no hard data
export async function getZoPerpMarkets(cluster: string, endpoint: string): Promise<ZoMarketInfo[]> {
  const connection = new Connection(endpoint)
  const provider = createProvider(connection, undefined!)

  const zoCluster = cluster === 'devnet' ? Cluster.Devnet : Cluster.Mainnet
  const zoStateKey = cluster === 'devnet' ? ZO_DEVNET_STATE_KEY : ZO_MAINNET_STATE_KEY
  const zoDexKey = cluster === 'devnet' ? ZO_DEX_DEVNET_PROGRAM_ID : ZO_DEX_MAINNET_PROGRAM_ID

  const zoProgram = createProgram(provider, zoCluster)
  const zoState = await State.load(zoProgram, zoStateKey)

  if (zoState !== undefined && Object.keys(zoState.markets).length === 0) {
    throw new Error(`Invalid Arguments`) // need better error message
  }

  return (
    Object.values(zoState.markets)
      // .filter((m) => m.marketType == 0) // there is a special perp market called Square with type 5
      .map((market) => {
        return {
          name: market.symbol,
          symbol: market.symbol,
          address: market.pubKey.toBase58(),
          programId: zoDexKey.toBase58()
        }
      })
  )
}
