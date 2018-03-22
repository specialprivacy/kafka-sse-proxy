'use strict'

class NoKafkaMock {
  constructor () {
    this.client = {
      getTopicPartitions: () => this.constructor.failTopic
        ? Promise.reject(new Error('FailTopicError'))
        : Promise.resolve(this.constructor.partitions)
    }
  }

  init () {
    return this.constructor.failInit
      ? Promise.reject(new Error('FailInitError'))
      : Promise.resolve(this)
  }

  end () {
    return Promise.resolve()
  }
}

NoKafkaMock.resetMock = () => {
  NoKafkaMock.partitions = []
  NoKafkaMock.failInit = false
  NoKafkaMock.failTopic = false
}

module.exports = NoKafkaMock
