# Kafka-SSE-proxy
This is a simple webserver which exposes a kafka topic as server sent events.
In order to keep access control concerns limited, the topic is set as configuration and cannot be set by the client.

A single server sent events stream maps onto a kafka topic partition. Clients can discover the available partitions through a dedicated endpoint.
In future versions we might add query parameters to this, so that clients can only subscribe to the partitions which make sense given the partitioning scheme used by kafka for this topic.

## Options
* **PORT**: The port on which the http server will bind (_default_: `80`)
* **BROKERS**: A list of kafka endpoints to try when connecting to the kafka cluster (_default_: `localhost:9092`)
* **TOPIC**: The topic to stream events off (_default_: `test`)
* **LOGGING_LEVEL**: The verbosity of the server logging (_default_: `info`, _anyOf_: [`trace`, `debug`, `info`, `warn`, `error`, `fatal`])

## Build
Using docker
```bash
docker build .
```

Native
```bash
npm install
npm start
```

A `docker-compose.yml` file with a test kafka cluster is provided in the repository as well
```bash
docker-compose up -d zookeeper kafka
npm install
PORT=12345 BROKERS=localhost:9094 TOPIC=test npm start
```

## TODO
* Improve validation of config variables (topic and brokers)
* Allow clients to set filters on the events using query parameters
* Allow clients to set filters when fetching the partitions
* Add tests
* Improve the handling of kafka errors (currently the values are not being set in the reply set to the client)
* Improve midstream error handling (right now the client will not receive an error event)
* See if the kafka-consumer-stream can be added to the no-kafka driver
