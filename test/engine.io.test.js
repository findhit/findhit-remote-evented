var RemoteEvented = require( '../index' ),
	Util = require( 'findhit-util' ),

	EngineIO = require( 'engine.io' ),
	EngineIOClient = require( 'engine.io-client'),

	sinon = require('sinon'),
	chai = require('chai'),
	expect = chai.expect;

describe("RemoteEvented", function () {

	describe("EngineIO", function () {
		var port = Math.floor( ( Math.random() * 5000 ) + 15000 );

		before(function ( done ) {
			var self = this;

			// Lets create a server with engine.io :)
			this.server = EngineIO.listen( port );
			this.server.on('connection', function ( socket ) {
				self.ServerSideSocket = socket;
			});

			done();
		});

		before(function ( done ) {

			this.ClientSideSocket = EngineIOClient({
				host: 'localhost',
				port: port,
			});
			this.ClientSideSocket.on('open', function () {
				done();
			});

		});

		it("make sure that socket is working flawless", function ( done ) {

			var receives = 0,
				receive = function () {
					receives++;
				};

			this.ServerSideSocket.on( 'message', receive );
			this.ClientSideSocket.send( 'olaralili' );

			setTimeout(function () {
				try{
					expect( receives ).to.be.equal( 1 );
				} catch ( err ) {
					done( err );
					return;
				}

				done();
			}, 200);
		});

		it("Create a Call class, extend it on both multiple sockets", function ( done ) {

			var calls = [],
				Call = RemoteEvented.extend({ 

					$onRemote: {
						initialize: function () {
							calls.push( 'remote-initialize' ); // expect 2 calls
						},
						ring: function () {
							calls.push( 'remote-ring' ); // expect one call
						},
					},

				});

			var Caller = Call.extend({}).setup( 'Call', this.ClientSideSocket ),
				Callee = Call.extend({}).setup( 'Call', this.ServerSideSocket );

			//this.ClientSideSocket.on( 'message', console.log );
			//this.ServerSideSocket.on( 'message', console.log );

			// Init test
			var call = new Caller();

			call.caller = true;

			// Fire `ring` to check if other-party receives
			call.fire( 'ring' );

			setTimeout( function () {
				try{
					expect( calls ).to.have.length( 3 );
				} catch ( err ) {
					done( err );
					return;
				}

				done();
			}, 1000);
		});

		after(function () {

			// Close server
			this.server.close();

		});

	});

});