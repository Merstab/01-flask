import os from 'os'
import path from 'path'
import { Worker } from 'worker_threads'
import { cleanupChannel, minionReadyChannel, zoProducerReadyChannel, wait } from './helpers'
import { logger } from './logger'
import { ZoMarketInfo } from './types' //Replace with ZoMarketInfo

export async function bootServer({
  port,
  nodeEndpoint,
  wsEndpointPort,
  minionsCount,
  markets, // ZoMarketInfo[]
  commitment,
  bootDelay
}: // cluster
BootOptions) {
  // multi core support is linux only feature which allows multiple threads to bind to the same port
  // see https://github.com/uNetworking/uWebSockets.js/issues/304 and https://lwn.net/Articles/542629/
  const MINIONS_COUNT = os.platform() === 'linux' ? minionsCount : 1
  let readyMinionsCount = 0

  logger.log(
    'info',
    MINIONS_COUNT === 1 ? 'Starting single minion worker...' : `Starting ${MINIONS_COUNT} minion workers...`
  )
  minionReadyChannel.onmessage = () => readyMinionsCount++

  // start minions workers and wait until all are ready

  for (let i = 0; i < MINIONS_COUNT; i++) {
    const minionWorker = new Worker(path.resolve(__dirname, 'minion.js'), {
      workerData: { nodeEndpoint, port, markets, minionNumber: i }
    })

    minionWorker.on('error', (err) => {
      logger.log('error', `Minion worker ${minionWorker.threadId} error occurred: ${err.message} ${err.stack}`)
      throw err
    })
    minionWorker.on('exit', (code) => {
      logger.log('error', `Minion worker: ${minionWorker.threadId} died with code: ${code}`)
    })
  }

  await new Promise<void>(async (resolve) => {
    while (true) {
      if (readyMinionsCount === MINIONS_COUNT) {
        break
      }
      await wait(100)
    }

    resolve()
  })

  logger.log('info', `Starting 01 producers for ${markets.length} markets, rpc endpoint: ${nodeEndpoint}`)

  let readyProducersCount = 0

  zoProducerReadyChannel.onmessage = () => readyProducersCount++

  for (const market of markets) {
    const zoProducerWorker = new Worker(path.resolve(__dirname, 'zo_producer.js'), {
      workerData: { market, nodeEndpoint, commitment, wsEndpointPort }
    })

    zoProducerWorker.on('error', (err) => {
      logger.log('error', `01 producer worker ${zoProducerWorker.threadId} error occurred: ${err.message} ${err.stack}`)
      throw err
    })

    zoProducerWorker.on('exit', (code) => {
      logger.log('error', `01 producer worker: ${zoProducerWorker.threadId} died with code: ${code}`)
    })

    // just in case to not get hit by serum RPC node rate limits...
    await wait(bootDelay)
  }

  await new Promise<void>(async (resolve) => {
    while (true) {
      if (readyProducersCount === markets.length) {
        break
      }
      await wait(100)
    }

    resolve()
  })
}

export async function stopServer() {
  cleanupChannel.postMessage('cleanup')

  await wait(10 * 1000)
}

type BootOptions = {
  port: number
  nodeEndpoint: string
  wsEndpointPort: number | undefined
  minionsCount: number
  commitment: string
  markets: ZoMarketInfo[] // ZoMarketInfo []
  bootDelay: number
  // cluster: string
}
