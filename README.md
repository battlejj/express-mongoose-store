##Express Mongoose Store
express-mongoose is a MongoDB session store backed by [MongooseJS](http://mongoosejs.com/). It differs from other
MongoDB session stores because it accepts a current Mongoose connection, so you don't have to configure separate
connection for your session store if you are already using Mongoose for your backend. It is meant to give a MongoDB
session store with minimal config.

###express-mongoose only supports ````express > 4.0.0````

###Installation
````
$ npm install express-mongoose-store
````

###Options
```ttl``` - how long a session should last from last page view. Defaults to 1 day.

###Usage
````
var session        = require('express-session');
var mongoose       = require('mongoose');
var MS             = require('../ms')(session, mongoose);

app.use(session({ secret: 'keyboard cat', store: new MS({ttl: 600000}) }); //10 minute sessions
````

###Test
Running tests requires a MongoDB instance running on 127.0.0.1:27017 with no authentication. It will also
delete anything in a database called "test" in the collection called "sessions" so if that is not desired, you
need to modify the tests or not run them.

````
npm test
````