'use strict'
let prom = require('prom-client')
let router = require('express').Router()
const {OK} = require('http-status-codes')

prom.collectDefaultMetrics({ timeout: 5000 })

router.get('/', (req, res) => {
  res.status(OK)
    .type('text')
    .send(prom.register.metrics())
})

module.exports = router
