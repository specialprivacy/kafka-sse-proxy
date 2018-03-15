'use strict'
let cached = require('cached')
let kafka = require('no-kafka')
let router = require('express').Router()

const {OK} = require('http-status-codes')
const {BROKERS, TOPIC} = require('lib/utils/config')

const cache = cached('cache', {
  backend: {type: 'memory'},
  defaults: {
    freshFor: 3600,
    timeout: 5
  }
})

function fetchKafkaPartitions (req) {
  req.log.info({topic: TOPIC}, `Refreshing partition cache for topic ${TOPIC}`)
  const kafkaOpts = {
    groupId: 'sse-kafka-proxy',
    connectionString: BROKERS
  }
  const consumer = new kafka.SimpleConsumer(kafkaOpts)
  return consumer.init()
    .then(() => consumer.client.getTopicPartitions(TOPIC))
    .then((partitions) => partitions.map(item => item.partitionId))
    .finally(() => consumer.end())
}

router.get('/', (req, res, next) => {
  cache.getOrElse('partitions', fetchKafkaPartitions.bind(null, req))
    .then(partitions => res.status(OK).json(partitions))
    .catch(next)
})

module.exports = router
