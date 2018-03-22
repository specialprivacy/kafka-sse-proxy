'use strict'
let {Readable} = require('stream')

class KafkaStreamMock extends Readable {
  constructor (values = []) {
    super({ objectMode: true })
    this._values = values
    this._emitError = -1
    this._endCallback = () => {}
    this._keepOpen = false
  }

  emitError (index) {
    this._emitError = index
  }

  endCallback (func) {
    this._endCallback = func
  }

  keepOpen (keep) {
    this._keepOpen = keep
  }

  _read () {
    if (this._keepOpen) return
    this._values.forEach((v, index) => {
      if (this._emitError !== -1 && index >= this._emitError) {
        return this.emit('error', 'KafkaTestError')
      }
      this.push(v)
    })
    if (this._emitError === 0) return this.emit('error', 'KafkaTestError')
    this.push(null)
  }

  end () {
    this._endCallback()
    process.nextTick(() => this.push(null))
    return Promise.resolve()
  }
}

module.exports = KafkaStreamMock
