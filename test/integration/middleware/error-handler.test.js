let Ajv = require('ajv')
let ajv = new Ajv()
let {APIError} = require('lib/middleware/error-handling')
let chai = require('chai')
let expect = chai.expect
let proxyquire = require('proxyquire')

let {INTERNAL_SERVER_ERROR} = require('http-status-codes')
let request = (server) => chai.request(server, {badStatusCausesError: false})
let schema = require('test/schemas/json-api-error.schema.json')
let schemaValidator = ajv.compile(schema)

let partitions = proxyquire('lib/routes/partitions', {
  'cached': () => ({ getOrElse: () => Promise.reject(new APIError()) })
})
let app = proxyquire('lib/app.js', {
  'lib/routes/partitions': partitions
})

describe('error-handler', () => {
  it('Should return a json error if content-type json was request', () => {
    let resp = request(app)
      .get('/partitions')
      .set('accept', 'application/json')

    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.json
      .and.have.property('body')
      .which.satisfy(schemaValidator)
  })

  it('Should return an html error if content-type html was requested', () => {
    let resp = request(app)
      .get('/partitions')
      .set('accept', 'text/html')

    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.html
  })

  it('Should return an html error if a random content type was requested', () => {
    let resp = request(app)
      .get('/partitions')
      .set('accept', 'application/xml')

    return expect(resp).to.eventually.have.status(INTERNAL_SERVER_ERROR)
      .and.be.html
  })
})
