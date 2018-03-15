'use strict'
const log = require('lib/utils/log')

function validatePort (port) {
  port = Number.parseInt(port)
  // Coerce into a integer
  if (isNaN(port)) {
    log.fatal({port}, `Port number must be an integer. Received: ${port}`)
    process.exit(2)
  }
  // Check if the port is in the valid range
  if (port < 0 || port > 65535) {
    log.fatal({port}, `Port number must be between 0 and 65535. Received: ${port}`)
    process.exit(2)
  }
  log.info({port}, `Using portnumber ${port}`)
  return port
}

function getPort () {
  return validatePort(process.env.PORT || 80)
}

function validateBrokers (brokers) {
  // TODO: actually validate the input
  return brokers
}

function getBrokers (defaultValue) {
  return validateBrokers(process.env.BROKERS || defaultValue)
}

function validateTopic (topic) {
  // TODO: actually validate the input
  return topic
}

function getTopic (defaultValue) {
  return validateTopic(process.env.TOPIC || defaultValue)
}

module.exports = {
  PORT: getPort(),
  BROKERS: getBrokers('localhost:9092'),
  TOPIC: getTopic('test')
}
