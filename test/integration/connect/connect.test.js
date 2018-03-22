'use strict'
let Ajv = require('ajv')
let ajv = new Ajv()
let chai = require('chai')
let expect = chai.expect
let kafka = require('no-kafka')
let KafkaMockStream = require('test/utils/kafka-stream-mock')
let proxyquire = require('proxyquire')
let request = (server) => chai.request(server, {badStatusCausesError: false})
let rewire = require('rewire')
let schema = require('test/schemas/json-api-error.schema.json')
let schemaValidator = ajv.compile(schema)
let sse = require('sse-utils')

let {BAD_REQUEST, INTERNAL_SERVER_ERROR, OK, NOT_ACCEPTABLE} = require('http-status-codes')

let connect = rewire('lib/routes/connect')
let app = proxyquire('lib/app', {
  'lib/routes/connect': connect
})

describe('/connect', () => {
  let restore
  beforeEach(() => {
    restore = () => {}
  })
  afterEach(() => {
    restore()
  })

  it('Should return BAD_REQUEST if the clienId is missing', () => {
    let resp = request(app)
      .get('/connect')
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(BAD_REQUEST)
      .and.be.json
      .and.have.property('body')
      .which.satisfy(schemaValidator)
  })

  it('Should set the clientId to the kafka driver', () => {
    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts) {
      expect(kafkaOpts).to.have.property('groupId', 'clientId')
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.have.header('content-type', /text\/event-stream/)
  })

  it('Should return text/event-stream mime type', () => {
    restore = connect.__set__('KafkaConsumerStream', function () {
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.have.header('content-type', /text\/event-stream/)
  })

  it('Should set no-cache header', () => {
    restore = connect.__set__('KafkaConsumerStream', function () {
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.have.header('cache-control', 'no-cache')
  })

  it('Should by default stream partition 0 of the configured kafka topic', () => {
    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts, topicOpts) {
      expect(topicOpts).to.have.property('partition', 0)
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
  })

  it('Should stream the partition requested in the query string', () => {
    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts, topicOpts) {
      expect(topicOpts).to.have.property('partition', 1)
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId', partition: '1'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
  })

  it('Should request a stream from EARLIEST_OFFSET by default', () => {
    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts, topicOpts) {
      expect(topicOpts).to.have.property('offset').that.deep.equals({time: kafka.EARLIEST_OFFSET})
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
  })

  it('Should stream from EARLIEST_OFFSET if last-event-id could not be coerced into an int', () => {
    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts, topicOpts) {
      expect(topicOpts).to.have.property('offset').that.deep.equals({time: kafka.EARLIEST_OFFSET})
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')
      .set('last-event-id', 'not-a-number')

    return expect(resp).to.eventually.have.status(OK)
  })

  it('Should request a stream from the offset set in the `last-event-id` header', () => {
    const offset = 20
    const expected = {offset: offset + 1}

    restore = connect.__set__('KafkaConsumerStream', function (kafkaOpts, topicOpts) {
      expect(topicOpts).to.have.property('offset').that.deep.equals(expected)
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')
      .set('last-event-id', offset)

    return expect(resp).to.eventually.have.status(OK)
  })

  it('Should transform kafka messages into SSE messages', () => {
    const data = [{offset: 0, message: {value: 'message1'}}, {offset: 1, message: {value: 'message2'}}, {offset: 3, message: {value: 'message3'}}]
    const expected = [{
      id: '0',
      data: 'message1'
    }, {
      id: '1',
      data: 'message2'
    }, {
      id: '3',
      data: 'message3'
    }]

    restore = connect.__set__('KafkaConsumerStream', function () {
      return new KafkaMockStream(data)
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.have.header('content-type', /text\/event-stream/)
      .and.have.deep.property('text')
      .which.satisfy(text => {
        const data = sse.parseAll(text)
        return expect(data).to.deep.equal(expected)
      })
  })

  it('Should return INTERNAL_SERVER_ERROR if kafka emits an error before sending data', () => {
    restore = connect.__set__('KafkaConsumerStream', function () {
      const kafkaStream = new KafkaMockStream([])
      kafkaStream.emitError(0)
      return kafkaStream
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.json
      .and.have.deep.property('body')
      .which.satisfy(schemaValidator)
  })

  it('Should return INTERNAL_SERVER_ERROR if kafka emits badly formatted messages', () => {
    const data = [{foo: 'bar'}]
    restore = connect.__set__('KafkaConsumerStream', function () {
      return new KafkaMockStream(data)
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.json
      .and.have.deep.property('body')
      .which.satisfy(schemaValidator)
  })

  it('Should stop the stream if kafka has an issue midway streaming', () => {
    const data = [{offset: '1', message: {value: 'foo'}}, {offset: '2', message: {value: 'bar'}}]
    const expected = [{id: '1', data: 'foo'}]
    restore = connect.__set__('KafkaConsumerStream', function () {
      const kafkaStream = new KafkaMockStream(data)
      kafkaStream.emitError(1)
      return kafkaStream
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.have.header('content-type', /text\/event-stream/)
      .and.have.deep.property('text')
      .which.satisfy(text => {
        console.log(text)
        const data = sse.parseAll(text)
        return expect(data).to.deep.equal(expected)
      })
  })

  it('Should return NOT_ACCEPTABLE if the request mime type is not text/event-stream', () => {
    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'application/json')

    return expect(resp).to.eventually.have.status(NOT_ACCEPTABLE)
      .and.be.json
      .and.have.property('body')
      .which.satisfy(schemaValidator)
  })

  it('Should end the kafka stream when the client connection ends', () => {
    let called = false
    restore = connect.__set__('KafkaConsumerStream', function () {
      const kafkaStream = new KafkaMockStream([])
      kafkaStream.endCallback(() => {
        called = true
      })
      return kafkaStream
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    return expect(resp).to.eventually.have.status(OK)
      .and.satisfy(() => called)
  })

  it('Should close an existing kafka connection if the same client asks for a new one', () => {
    let firstConnection = true
    let called = false
    restore = connect.__set__('KafkaConsumerStream', function () {
      if (firstConnection) {
        const kafkaStream = new KafkaMockStream([])
        kafkaStream.keepOpen(true)
        kafkaStream.endCallback(() => {
          called = true
        })
        firstConnection = false
        return kafkaStream
      }
      return new KafkaMockStream([])
    })

    let resp = request(app)
      .get('/connect')
      .query({clientId: 'clientId'})
      .set('accept', 'text/event-stream')

    setTimeout(() => {
      request(app).get('/connect').query({clientId: 'clientId'}).set('accept', 'text/event-stream')
        .then(() => console.log('Second request completed'))
        .catch(() => console.log('Second request failed'))
    }, 1000)

    return expect(resp).to.eventually.have.status(OK)
      .and.satisfy(() => called)
  })
})
