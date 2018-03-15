'use strict'
require('app-module-path').addPath(`${__dirname}/../`)
let chai = require('chai')
let chaiAsPromised = require('chai-as-promised')
let chaiHttp = require('chai-http')

chai.use(chaiHttp)
chai.use(chaiAsPromised)
