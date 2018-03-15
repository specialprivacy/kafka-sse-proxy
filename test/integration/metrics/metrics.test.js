let chai = require('chai')
let expect = chai.expect
let {OK} = require('http-status-codes')
let request = (server) => chai.request(server, {badStatusCausesError: false})

let app = require('lib/app.js')

describe('/metrics', () => {
  it('Should return status code 200', () => {
    let resp = request(app)
      .get('/metrics')

    return expect(resp).to.eventually.have.status(OK)
      .and.be.text
  })
})
