let {expect} = require('chai')
let rewire = require('rewire')

let config = rewire('lib/utils/config')

describe('config', () => {
  describe('exports', () => {
    it('Should export an object', () => {
      expect(config).to.be.an('object')
    })

    it('Should export a port property', () => {
      expect(config).to.have.property('PORT')
        .that.is.a('number')
    })

    it('Should export a BROKERS property', () => {
      expect(config).to.have.property('BROKERS')
        .that.is.a('string')
    })

    it('Should export a TOPIC property', () => {
      expect(config).to.have.property('TOPIC')
        .that.is.a('string')
    })
  })

  describe('getPort()', () => {
    let restore
    const getPort = config.__get__('getPort')

    beforeEach(() => {
      restore = () => {}
    })

    afterEach(() => {
      restore()
    })

    it('Should use a default value of 80', () => {
      restore = config.__set__('process.env.PORT', '')
      expect(getPort()).to.equal(80)
    })

    it('Should use environment variable PORT', () => {
      restore = config.__set__('process.env.PORT', '12345')
      const expected = 12345

      expect(getPort()).to.equal(expected)
    })

    it('Should terminate if environment variable PORT is not an integer', () => {
      let called = false
      restore = config.__set__({
        process: {
          env: {PORT: 'foo'},
          exit: (code) => {
            called = true
            expect(code).to.equal(2)
          }
        }
      })

      getPort()
      expect(called).to.be.true
    })

    it('Should terminate if environment variable PORT is negative', () => {
      let called = false
      restore = config.__set__({
        process: {
          env: {PORT: '-1'},
          exit: (code) => {
            called = true
            expect(code).to.equal(2)
          }
        }
      })

      getPort()
      expect(called).to.be.true
    })

    it('Should terminate if environment variable PORT is larger than the max allowed port number', () => {
      let called = false
      restore = config.__set__({
        process: {
          env: {PORT: '123456789'},
          exit: (code) => {
            called = true
            expect(code).to.equal(2)
          }
        }
      })

      getPort()
      expect(called).to.be.true
    })
  })

  // TODO: Add tests for the BROKERS and TOPIC validators
})
