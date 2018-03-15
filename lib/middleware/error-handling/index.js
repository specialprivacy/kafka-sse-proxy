const path = require('path')

module.exports = {
  APIError: require(path.join(__dirname, 'api-error')),
  errorHandler: require(path.join(__dirname, 'error-handler.js')),
  notFoundHandler: require(path.join(__dirname, 'not-found-handler.js'))
}
