'use strict'
const {BAD_REQUEST, NOT_ACCEPTABLE, OK} = require('http-status-codes')
let {APIError} = require('lib/middleware/error-handling')
let kafka = require('no-kafka')
let KafkaConsumerStream = require('lib/utils/kafka-consumer-stream')
let {mapSync} = require('stream-util')
let router = require('express').Router()
let sse = require('sse-utils')

const {BROKERS, TOPIC} = require('lib/utils/config')
const EVENT_STREAM_MIME = 'text/event-stream'

// TODO: replace this with immutable.js to keep memory usage in check
let clients = {}

router.close = function () {
  Object.keys(clients).map(key => clients[key]).map(client => {
    if (client && client.consumer) {
      client.consumer.end()
    }
  })
}

router.get('/', (req, res, next) => {
  const mime = req.accepts(EVENT_STREAM_MIME)
  const errorHandler = (err) => {
    return next(new APIError({error: err}))
  }
  if (mime !== EVENT_STREAM_MIME) {
    return next(new APIError({
      statusCode: NOT_ACCEPTABLE,
      title: 'The requested mime type is not acceptable for endpoint',
      details: 'Only `text/event-stream` is supported for this endpoint'
    }))
  }

  const clientId = req.query.clientId
  const partition = Number.parseInt(req.query.partition) || 0
  const lastEventId = req.headers['last-event-id']
  const offset = lastEventId && !isNaN(Number.parseInt(lastEventId))
    ? {offset: Number.parseInt(lastEventId) + 1}
    : {time: kafka.EARLIEST_OFFSET}

  if (!clientId) {
    return next(new APIError({
      statusCode: BAD_REQUEST,
      title: 'ClientId query-parameter missing.',
      details: 'A unique clientId is required to identify and resume this session in the case of errors.'
    }))
  }

  if (clients.clientId) {
    if (clients.clientId.consumer) clients.clientId.consumer.end()
    clients.clientId = null
  }
  const consumer = new KafkaConsumerStream({
    groupId: clientId,
    connectionString: BROKERS,
    recoveryOffset: kafka.EARLIEST_OFFSET
  }, {
    topic: TOPIC,
    partition,
    offset
  }, req.log.info.bind(req.log))
  clients.clientId = {
    partition,
    offset,
    consumer
  }

  res.status(OK) // We are assuming the client wants to subscribe even if the topic is empty
  res.set('content-type', EVENT_STREAM_MIME)
  res.set('cache-control', 'no-cache')

  consumer.on('error', errorHandler)
    .pipe(mapSync((item) => sse.stringify({
      id: item.offset.toString(),
      data: item.message.value.toString()
    }))).on('error', errorHandler)
    .pipe(res)

  req.on('close', () => {
    req.log.info('Ending request')
    consumer.end() // Ending the consumer will close the readable and hence the response
    clients.clientId = null
  })

  req.on('end', () => {
    req.log.info('Terminating request')
    consumer.end()
    clients.clientId = null
  })
})

module.exports = router
