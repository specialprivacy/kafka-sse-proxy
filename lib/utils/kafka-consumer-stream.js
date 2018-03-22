'use strict'
/*
 * The implementation of this stream is a bit more convoluted than I would have
 * liked due to a combination of reasons:
 * - The kafka driver has no easy method for pausing the reading of messages (which we need to do when we receive backpressure from clients)
 * - Nodejs will call _read synchronously after a push (resolved in later versions, but unlikely to be backported: https://github.com/nodejs/node/issues/3203)
 *
 * The control flow goes roughly as follows:
 * - Stream gets created
 * - When the client calls `read` for the first time we connect to kafka (we might have nobody listen to error events if we do this earlier)
 * - We subscribe to a topic using the _dataHandler callback
 * - The _dataHandler callback pushes data into the internal buffer and sets the `resolve` function of the promise to _unPauseKafka
 * - The _dataHanlder calls _flushBuffer
 * - _flushBuffer will release the promise if the internal buffer is empty, cause the kafka driver to call _dataHandler with new data
 * - if the client gives backpressure, _read will call _flushBuffer to resume emitting data
 *
 * There is the potential for a deadlock if the promise somehow does not get resolved.
 * A potential improvement could be to save an array of promises and resolve them all when we've flushed the buffer
 *
 */
const {Readable} = require('stream')
const kafka = require('no-kafka')

/**
 * A kafka SimpleConsumer which emits data as a nodejs stream
 * It exposes the same options as a no-kafka SimpleConsumer
 * It will lazily connect to kafka (so only after read has been called for
 * the first time)
 * @extends Readable
 */
class KafkaConsumerStream extends Readable {
  /**
   * Creates a new instance of KafkaConsumerStream
   * @param {kafkaOpts} kafkaOpts         The global options for the kafka driver
   * @param {topicOpts} topicOpts         The options for the topic subscription
   * @param {function}  [log=console.log] An optional logging function
   */
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

  /**
   * The callback for the no-kafka subscription
   * This function will populate the internal buffer and dispatch to _flushBuffer
   * @private
   * @param  {array<KafkaMessage>} messageSet An array of kafka messages
   * @param  {string}              topic      The name of the topic the messageSet came from
   * @param  {number}              partition  The partitionId the messageSet came from
   * @return {Promise<undefined>}             A promise which resolves if all the data has been handled
   */
  _dataHandler (messageSet, topic, partition) {
    this._log(`Received ${messageSet.length} messages`)
    if (this._buffer.length !== 0) this._log(`Receiving data before previous buffer has been flushed. This should not happen! (Can lead to a deadlock)`)
    return new Promise(resolve => {
      this._buffer = this._buffer.concat(messageSet)
      this._unPauseKafka = resolve
      this._flushBuffer()
    })
  }

  /**
   * Private method which will flush the internal buffer to the stream
   * It will pause when the downstream consumers buffer gives backpressure
   * It will resolve the callback promise when the internal buffer is empty to
   * signal the kafka driver that it can deliver new data
   * @private
   * @return {undefined}
   */
  _flushBuffer () {
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
    // When _read is called for the first time, connect to kafka and subscribe to the topic
    if (!this._initialized) {
      this._initialized = true
      const {topic, partition, offset} = this._topicOpts

      this._log(`Connecting to kafka and subscribing to topic ${topic} at offset ${JSON.stringify(offset)}`)
      this._consumer.init().then(() => {
        this._consumer.subscribe(topic, partition, offset, this._dataHandler.bind(this))
      }).catch((err) => this.emit('error', err))
    } else if (!this._pushing) {
      // If _read gets called while we're not pushing, resume pushing the data to the client
      this._flushBuffer()
    }
  }

  _destroy (foo, cb) {
    this._consumer.end().then(() => cb())
  }

  /**
  * A cleanup function which will close the stream and release the internal
  * kafka connection
  * @return {undefined}
  */
  end () {
    this._consumer.end().then(() => {
      this._initialized = false
      this._initializing = false
      this.push(null)
    })
  }
}

module.exports = KafkaConsumerStream
