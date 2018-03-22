'use strict'
let chai = require('chai')
let expect = chai.expect
const {NOT_FOUND} = require('http-status-codes')
let request = (server) => chai.request(server, {badStatusCausesError: false})

let app = require('lib/app')

describe('/', () => {
  it('Should return NOT_FOUND', () => {
    let resp = request(app)
      .get('/')

    return expect(resp).to.eventually.have.status(NOT_FOUND)
      .and.be.html
  })
})
