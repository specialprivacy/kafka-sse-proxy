'use strict'
let chai = require('chai')
let expect = chai.expect
const {INTERNAL_SERVER_ERROR, OK} = require('http-status-codes')
let noKafkaMock = require('test/utils/no-kafka-mock')
let proxyquire = require('proxyquire').noPreserveCache()
let request = (server) => chai.request(server, {badStatusCausesError: false})

let partitionsMock = proxyquire('lib/routes/partitions', {
  'no-kafka': {
    'SimpleConsumer': noKafkaMock
  },
  cached: require('cached')
})
let app = proxyquire('lib/app', {
  'lib/routes/partitions': partitionsMock
})

describe('/partitions', () => {
  beforeEach(() => {
    noKafkaMock.resetMock()
    partitionsMock = proxyquire('lib/routes/partitions', {
      'no-kafka': {
        'SimpleConsumer': noKafkaMock
      },
      cached: require('cached') // Required to get proxyquire to flush the cache between instance tests
    })
    app = proxyquire('lib/app', {
      'lib/routes/partitions': partitionsMock
    })
  })

  it('Should return an array with partitionIds', () => {
    const partitions = [{partitionId: 0}, {partitionId: 1}, {partitionId: 2}, {partitionId: 3}]
    const expected = [0, 1, 2, 3]
    noKafkaMock.partitions = partitions

    let resp = request(app)
      .get('/partitions')

    return expect(resp).to.eventually.have.status(OK)
      .and.be.json
      .that.has.property('body')
      .that.deep.equals(expected)
  })

  it('Should cache the originally returned array', () => {
    const partitions1 = [{partitionId: 0}, {partitionId: 1}, {partitionId: 2}]
    const partitions2 = [{partitionId: 0}]
    const expected = [0, 1, 2]
    noKafkaMock.partitions = partitions1

    return request(app)
      .get('/partitions')
      .then(() => {
        noKafkaMock.partitions = partitions2

        let resp2 = request(app)
          .get('/partitions')

        return expect(resp2).to.eventually.have.status(OK)
          .and.be.json
          .that.has.property('body')
          .that.deep.equals(expected)
      })
  })

  // TODO: this should eventually be BAD_GATEWAY
  it('Should return INTERNAL_SERVER_ERROR if kafka could not be connected', () => {
    noKafkaMock.failInit = true

    let resp = request(app)
      .get('/partitions')
      .set('accept', 'application/json')

    // TODO: test the payload of the error once we're generating nice kafka errors
    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.json
  })

  it('Should return INTERNAL_SERVER_ERROR if the topic does not exist in kafka', () => {
    noKafkaMock.failTopic = true

    let resp = request(app)
      .get('/partitions')
      .set('accept', 'application/json')

    // TODO: test the payload of the error once we're generating nice kafka errors
    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.json
  })
})
