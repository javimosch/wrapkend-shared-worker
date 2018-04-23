const console = require('tracer').colorConsole();
var errToJSON = require('error-to-json')
var mongoose = require('mongoose')
var db = require('./libs/db')
var requireFromString = require('require-from-string', '', [
	//__dirname,
	//path.join(__dirname,'..')
	//process.cwd()
	//__dirname
	"/Users/javier/git/wrapkend-shared-worker"
]);
var socket = require('socket.io-client')('http://localhost:3002/wrapkend-rJqGIp_hf', {
	//timeout:1000*999999
	autoConnect: false
});

setInterval(() => {
	if (!socket.connected) {
		socket.open();
	}
}, 2000)

socket.on('connect', function() {
	console.log('connected')
});
socket.on('disconnect', function() {
	console.log('disconnect, waiting....')
});

socket.on('reconnect_attempt', () => {
	console.log('Trying to connect...')
});

socket.on('connect_error', () => {
	console.log('connect_error')
});

socket.on('connect_timeout', () => {
	console.log('connect_timeout')
});

socket.on('reconnecting', (attempt) => {
	console.log('reconnecting', attempt)
});

socket.on('reconnect_failed', () => {
	console.log('reconnect_failed')
});

socket.on('reconnect_error', () => {
	console.log('reconnect_error')
});

socket.on('pingi', (data) => socket.emit('pongi', {
	hash: data.hash
}));

let ids = {}



function createSchemaFromWraCollection(doc) {
	let fields = doc.fields.map(f => {
		let res = {};
		if (f.required) res.required = true
		if (f.unique) res.unique = true
		if (f.index) res.index = true
		if (f.type === 'String') res.type = String
		if (f.type === 'Number') res.type = Number
		if (f.type === 'Date') res.type = Date
		if (f.type === 'Boolean') res.type = Boolean
		if (f.type === 'Ref') {
			res.type = mongoose.Schema.Types.ObjectId
			res.ref = f.ref
		}
		return res
	})
	return new mongoose.Schema(fields, {
		timestamps: true,
		toObject: {}
	});
}

socket.on('configure', params => {
	try {
		console.log('CONFIGURE')
		let mongooseModels = params.models.map(modelDoc => {
			return {
				name: modelDoc.name,
				schema: createSchemaFromWraCollection(modelDoc)
			}
		})
		console.log('CONNECTING MONGO....')
		db.connect(params.dbURI, mongooseModels).then(() => {
			console.log('CONNECTING MONGO OK')
			socket.emit('configured');
		}).catch(err => {
			console.log('CONNECTING MONGO FAIL')
			socket.emit('configured_error', errToJSON(err));
		})
	} catch (err) {
		console.log('CONNECTING MONGO FAIL')
		socket.emit('configured_error', errToJSON(err));
	}
})

socket.on('exec', function(params) {
	if (ids[params.id]) {
		return console.log('Already processing', params.id)
	}

	try {
		var id = params.id;
		var name = params.n;
		var project = params.prj;
		var actionData = params.d;
		var code = params.c;
		var def = '';
		console.log('EXEC', name, id)

		try {
			def = requireFromString(code);
		} catch (err) {
			return reject(new Error(JSON.stringify({
				message: "ACTION_COMPILATION_FAIL",
				detail: errToJSON(err)
			}, null, 2)))
		}

		let actionPromise = def.default.apply({}, [actionData])

		actionPromise.then(result => {
			resolve(result);
		}).catch(reject)
	} catch (err) {
		console.error(err);
		reject(err);
	}

	function resolve(result) {
		if (!result) result = {}
		console.log('resolving', name, actionData, 'RESULT', result, 'ID ' + id)
		console.log('EXEC', 'THEN', name, id, result)
		socket.emit('then', {
			$id: id,
			$n: name,
			result: result
		})
		removeId(id)
	}

	function reject(err) {
		console.log('rejecting', name, actionData, 'ERROR', err.stack, 'ID ' + id)
		console.log('EXEC', 'CATCH', name, id, err)
		socket.emit('catch', {
			$id: id,
			$n: name,
			err: errToJSON(err)
		})
		removeId(id)
	}
});

function removeId(id) {
	setTimeout(() => delete ids[id], 10000);
}

socket.on('disconnect', function() {});