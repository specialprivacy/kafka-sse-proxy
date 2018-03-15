
const {Readable} = require('stream')
const kafka = require('no-kafka')

class KafkaConsumerStream extends Readable {
  constructor (kafkaOpts, topicOpts, log = console.log) {
    super({ objectMode: true })
    this._consumer = new kafka.SimpleConsumer(kafkaOpts)
    this._log = log
    this._topicOpts = topicOpts
    this._pushing = false
    this._initialized = false
    this._buffer = []
    this._unPauseKafka = () => {}
  }

  dataHandler (messageSet, topic, partition) {
    this._log(`Received ${messageSet.length} messages`)
    if (this._buffer.length !== 0) this._log(`Receiving data before previous buffer has been flushed. This should not happen! (Can lead to a deadlock)`)
    return new Promise(resolve => {
      this._buffer = this._buffer.concat(messageSet)
      this._unPauseKafka = resolve
      this.flushBuffer()
    })
  }

  flushBuffer () {
    this._log(`Pushing buffered messages onto the stream`)
    let shouldContinue = true
    this._pushing = true
    while (shouldContinue && this._buffer.length !== 0) {
      shouldContinue = this.push(this._buffer.shift())
    }
    if (shouldContinue) return this._unPauseKafka()
    this._pushing = false
  }

  _read (size) {
    if (!this._initialized) {
      this._initialized = true
      const {topic, partition, offset} = this._topicOpts

      this._log(`Connecting to kafka and subscribing to topic ${topic} at offset ${JSON.stringify(offset)}`)
      this._consumer.init().then(() => {
        this._consumer.subscribe(topic, partition, offset, this.dataHandler.bind(this))
      }).catch((err) => this.emit('error', err))
    } else if (!this._pushing) {
      this.flushBuffer()
    }
  }

  _destroy (foo, cb) {
    this._consumer.end().then(() => cb())
  }

  end () {
    this.push(null)
    this._consumer.end().then(() => {
      this._initialized = false
    })
  }
}

module.exports = KafkaConsumerStream
