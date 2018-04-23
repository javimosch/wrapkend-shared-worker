const console = require('tracer').colorConsole();
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

var mongodbUri = require('mongodb-uri');

if (process.env.NODE_ENV !== 'production') {
	mongoose.set('debug', true);
}

var URI = '';

var self = module.exports = {
	connections: {},
	connect: async (url, models) => {
		if(!url) throw new Error('MONGOOSE_URI_MISSING')
		URI = url;
		await connectMongoose({
			name: 'default',
			models: models
		});
	},
	conn: () => self.connections.default,
	get: (n) => self.connections[n] || null,
	connectMongoose,
	URI: URI
}

function connectMongoose(options = {}) {
	const {
		name,
		models,
		dbURI
	} = options

	return new Promise((resolve, reject) => {

		if (!name) return reject('NAME_REQUIRED')
		
		if (models) {
			console.log(`connectMongoose ${name} custom models`, models.map(m => m.name))
		}

		try {
			let uri = dbURI || URI;

			try {
				var uriObject = mongodbUri.parse(uri);
				if (!uriObject.database || !uriObject.username || !uriObject.password) {
					throw new Error('INVALID_DB_URI')
				}
			} catch (err) {
				throw new Error('INVALID_DB_URI')
			}

			//createConnection
			var conn = mongoose.connect(uri, {
				server: {
					// sets how many times to try reconnecting
					reconnectTries: Number.MAX_VALUE,
					// sets the delay between every retry (milliseconds)
					reconnectInterval: 1000
				}
			});
			conn = mongoose.connection;

			if (!models) {
				throw new Error('MONGOOSE_MODELS_MISSING')
			} else {
				models.forEach(m => {
					mongoose.model(m.name, m.schema);
				})
			}

			conn.on('connected', () => {
				console.log('Connected');
				self.connections[name] = conn;
				resolve();
			});
			conn.on('error', (err) => {
				console.error(err);
				reject();
			});
			conn.on('disconnected', () => {});

		} catch (err) {
			console.error('connectMongoose ERROR', err)
			reject(err);
		}
	});
}


