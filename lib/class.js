/*
 * RemoteEvented is based on Evented class, and uses engine.io for comunication between both ends.
 */

var Evented = require( 'findhit-evented' ),
	Util = require( 'findhit-util' );

var RemoteEvented = Evented.extend({

	statics: {
		TYPE_PREPEND: 'remote-',
		CONTEXT: {
			LOCAL: 0,
			REMOTE: 1,
		},
	},

	// Fires an event on this instance
	fire: function ( type, data ) {
		var NewClass = this.constructor;

		// Dont send when we are 'listening'
		if( ! type.match( 'listener' ) ) {

			// Send message to remote
			NewClass.handle( this, {
				context: NewClass.CONTEXT.LOCAL,

				type: type,
				data: data,
			});

		} else {
			// And continue with default Evented behavior
			return Evented.prototype.fire.call( this, type, data );
		}

	},

	// Fires an event on remote instance
	fireRemote: function ( type, data ) {
		var NewClass = this.constructor;

		// Send message to remote
		NewClass.handle( this, {
			context: NewClass.CONTEXT.REMOTE,

			type: type,
			data: data,
		});

	},

	onRemote: function ( types, fn, context ) {
		var NewClass = this.constructor;

		// types can be a map of types/handlers
		if (typeof types === 'object') {

			for (var type in types) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on( NewClass.TYPE_PREPEND+ type, types[type], fn);
			}

		} else {
			// types can be a string of space-separated words
			types = Util.String.splitWords( types );

			for (var i = 0, len = types.length; i < len; i++) {
				this._on( NewClass.TYPE_PREPEND+ types[i], fn, context);
			}
		}

		return this;
	},
	onceRemote: function ( types, fn, context ) {

		if (typeof types === 'object') {

			for (var type in types) {
				this.once(type, types[type], fn);
			}

			return this;
		}

		var handler = Util.Function.bind(function () {
			this
				.offRemote(types, fn, context)
				.offRemote(types, handler, context);
		}, this);

		// add a listener that's executed once and removed after that
		return this
			.onRemote(types, fn, context)
			.onRemote(types, handler, context);
	},

	// debinds an event that occurs on remote
	offRemote: function ( types, fn, context ) {
		var NewClass = this.constructor;

		if (!types) {
			// clear all listeners if called without arguments
			delete this._events;

		} else if (typeof types === 'object') {

			for (var type in types) {
				this._off( NewClass.TYPE_PREPEND+ type, types[type], fn);
			}

		} else {

			types = Util.String.splitWords( types );

			for (var i = 0, len = types.length; i < len; i++) {
				this._off( NewClass.TYPE_PREPEND+ types[i], fn, context);
			}

		}

		return this;
	},

});

RemoteEvented.addInitHook(function () {
	
	var instance = this,
		NewClass = this.constructor;

	if( this.$onRemote ) {
		Util.Object.each( this.$onRemote, function ( fn, event ) {
			if( Util.isnt.Function( fn ) ) return;
			instance.on( NewClass.TYPE_PREPEND + event, fn );
		});
	}

	if( this.$onceRemote ) {
		Util.Object.each( this.$onceRemote, function ( fn, event ) {
			if( Util.isnt.Function( fn ) ) return;
			instance.once( NewClass.TYPE_PREPEND + event, fn );
		});
	}

});

RemoteEvented.addInitHook(function () {

	var instance = this,
		NewClass = this.constructor,
		namespace = NewClass.NAMESPACE,
		socket = NewClass.SOCKET;

	// Listen for remote events
	socket.on( 'message', function ( msg ) {
		msg = RemoteEvented.MSG.parse( msg );
		if( ! msg ) return;

		if(
			msg.namespace !== namespace ||
			msg.id !== instance._id
		) return;

		// It seems that this message is for us :)
		RemoteEvented.fire( instance, msg, NewClass.CONTEXT.REMOTE );
	});

	// Wait for id, if we are the auto-constructed instance...
	process.nextTick(function () {

		if( ! instance._id ) {
			var id = instance._id = Util.uuid(), msg;

			msg = {
				namespace: namespace,
				id: id,
				context: NewClass.CONTEXT.LOCAL,

				type: 'sync',
			};

			msg = RemoteEvented.MSG.stringify( msg );
			socket.send( msg );

		}

		instance.fire( 'initialize' );

		setTimeout(function () {

			// handle instance events syncing
			RemoteEvented.handle( instance );

		}, 500);

	});

});

RemoteEvented.handle = function ( instance, msg ) {

	var queue = instance._msg_queue = Util.is.Array( instance._msg_queue ) && instance._msg_queue || [],
		synced = !! instance._id,

		NewClass = instance.constructor,
		namespace = NewClass.NAMESPACE,
		socket = NewClass.SOCKET;

	// If message is specified, lets handle that specific message
	if( msg ) {

		if( synced ) {

			// Send it
			RemoteEvented.send( instance, msg );

		} else {

			// Add to queue
			queue.push( msg );

		}

		return true;
	}

	// If no message is specified, we must try to handle pending messages
	Util.each( queue, function ( msg ) {
		RemoteEvented.send( instance, msg );
	});

	// Instead of deleting array, i will gonna to remove all messages (better memory management)
	// TODO: Change it by Util.Array.empty() after [issue completation](https://github.com/findhit/findhit-util/issues/8)
	queue.splice( 0, queue.length );
};

RemoteEvented.send = function ( instance, msg ) {

	var NewClass = instance.constructor,
		namespace = NewClass.NAMESPACE,
		socket = NewClass.SOCKET;

	// Add things to msg
	msg.id = instance._id;
	msg.namespace = namespace;

	RemoteEvented.fire( instance, msg, NewClass.CONTEXT.LOCAL );

	msg = RemoteEvented.MSG.stringify( msg );
	socket.send( msg );
},

RemoteEvented.fire = function ( instance, msg, context ) {
	var NewClass = instance.constructor;

	var type = context === NewClass.CONTEXT.REMOTE ? (
			// Message is Remote
			msg.context === NewClass.CONTEXT.LOCAL ? NewClass.TYPE_PREPEND + msg.type : msg.type
		) : (
			// Message is Local
			msg.context !== NewClass.CONTEXT.LOCAL ? NewClass.TYPE_PREPEND + msg.type : msg.type
		),
		data = msg.data;

	return Evented.prototype.fire.call( instance, type, data );
};

RemoteEvented.setup = function ( namespace, socket ) {
	var NewClass = this;

	NewClass.SOCKET = socket;
	NewClass.NAMESPACE = namespace;

	socket.on( 'message', function ( msg ) {
		msg = RemoteEvented.MSG.parse( msg );
		if( ! msg ) return;

		if(
			msg.namespace !== namespace ||
			msg.type !== 'sync'
		) return;

		var instance = new NewClass();
		instance._id = msg.id;

	});

	return this;
};

RemoteEvented.destroy = function () {
	var NewClass = this,
		socket = NewClass.SOCKET;

	if( ! socket ) return;

};

// MSG handling
RemoteEvented.MSG = {};

RemoteEvented.MSG.stringify = function ( msg ) {
	if( Util.isnt.Object( msg ) ) {
		return false;
	}

	return [
		msg.namespace,
		msg.id,
		msg.context,
		msg.type,
		Util.is.Object( msg.data ) && JSON.stringify( msg.data ) || '{}',
	].join(':');

};

RemoteEvented.MSG.parse = function ( msg ) {
	if( Util.isnt.String( msg ) ) {
		return false;
	}

	var amsg = msg.split(':');

	if( amsg.length !== 5 ) {
		return false;
	}

	return {
		namespace: amsg[0],
		id: amsg[1],
		context: parseInt( amsg[2] ) || 0,
		type: amsg[3],
		stringify: JSON.parse( amsg[4] ),
	};
};

// aliases; we should ditch those eventually
var proto = RemoteEvented.prototype;

proto.addRemoteEventListener = proto.onRemote;
proto.removeRemoteEventListener = proto.clearAllRemoteEventListeners = proto.offRemote;
proto.addOneTimeRemoteEventListener = proto.onceRemote;
proto.fireRemoteEvent = proto.fireRemote;
proto.fireRemoteEventOn = proto.fireRemoteOn;
proto.hasRemoteEventListeners = proto.listensRemote;

// Export it
module.exports = RemoteEvented;