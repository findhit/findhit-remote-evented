# Remote Evented ![test-badge](http://strider.findhit.com/findhit/findhit-remote-evented/badge)

javascript remote evented driven with engine.io built on top of findhit-evented

Instalation
-----------

```bash

	npm install findhit-remote-evented --save

```

Usage
-----

```js

// We need an already stablished engine.io socket connection!
// so i will suppose that you already have one
var socket;

var RemoteEvented = require('findhit-remote-evented');

var Call = RemoteEvented.extend({

  // you can specify methods as `findhit-class`
  initialize: function ( my, cool, params ) {
    // ...
  },

  ring: function () {
    // ...
    this.fire('ring');
  },

  // You can bind events directly from extend as `findhit-evented`
  $on: {
    ring: function () {
      // ...
    },
  },

  // And now from remote party.
  $onRemote: {

    answer: function ( e ) {
      this.stopRing();
    },

  },

});

// We could extend it to a new class and setup it with a specific socket.
// In this case we will setup directly on current class `.setup( namespace, socket )`
Call.setup( 'VideoCall', socket );

// When you create an instance, another party will create one also
var bruno = new Call();

// You can bind or fire events as `findhit-evented`
bruno.fire('ring');
bruno.on('ring ring-stopped', function () {
  // ...
});
bruno.once('answered', function () {
  // ...
});

// And now from remote party
bruno.fireOnRemote( 'ring' );
bruno.onRemote( 'ring ring-stopped', function () {
  // ...
});
bruno.onceRemote('answered', function () {
  // ...
});

// Thats it, take a look at `test` and `example` folders for more cases.
// You don't see them? Pull Request them :)
```
