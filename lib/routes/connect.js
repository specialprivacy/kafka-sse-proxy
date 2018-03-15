'use strict'
const {NOT_ACCEPTABLE, OK} = require('http-status-codes')
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
    if (clients.clientId) {
      if (clients.clientId.consumer) clients.clientId.consumer.end()
      clients.clientId = null
    }
    return next(err)
  }
  if (mime !== EVENT_STREAM_MIME) return res.status(NOT_ACCEPTABLE).end()

  const clientId = req.query.clientId
  const partition = Number.parseInt(req.query.partition) || 0
  const offset = req.headers['last-event-id'] && !isNaN(Number.parseInt)
    ? {offset: Number.parseInt(req.headers['last-event-id']) + 1}
    : {time: kafka.EARLIEST_OFFSET}

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
