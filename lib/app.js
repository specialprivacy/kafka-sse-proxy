let app = require('express')()
let childLogger = require('lib/middleware/log')
let cors = require('cors')

let connect = require('lib/routes/connect')
let {errorHandler, notFoundHandler} = require('lib/middleware/error-handling')
let metrics = require('lib/routes/metrics')
let partitions = require('lib/routes/partitions')

app.disable('x-powered-by')
app.enable('trust proxy')
app.use(cors())
app.use(childLogger)

app.use('/metrics', metrics)
app.use('/connect', connect)
app.use('/partitions', partitions)

app.use(notFoundHandler)
app.use(errorHandler)

app.close = function () {
  connect.close()
}

module.exports = app
