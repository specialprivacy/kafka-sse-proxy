const {INTERNAL_SERVER_ERROR} = require('http-status-codes')

function errorHandler (error, req, res, next) {
  let sc = error.statusCode || INTERNAL_SERVER_ERROR
  if (sc >= INTERNAL_SERVER_ERROR) req.log.error({err: error})
  res.status(sc)
  res.format({
    'html': () => res.send(`<html><head><title>${sc} ${error.title}</title></head><body><h1>${sc} ${error.title}</h1><h2>${req.request_id}</h2><p>${error.detail}</p><p><pre><code>${error.stack}</code></pre></p></body></html>`),
    'json': () => res.json(error),
    'default': () => res.send(`<html><head><title>${sc} ${error.title}</title></head><body><h1>${sc} ${error.title}</h1><h2>${req.request_id}</h2><p>${error.detail}</p><p><pre><code>${error.stack}</code></pre></p></body></html>`)
  })
}

module.exports = errorHandler
