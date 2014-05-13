module.exports = function(session, mongoose){

  var Schema  = mongoose.Schema
    , Store   = session.Store
    , debug   = require('debug')('mongoose-store')
    ;

  var session_schema = new Schema({
    sid:      String,
    session:  String,
    expires:  Number,
    _id: {
      type: Schema.ObjectId, select: false
    }
  }, { strict: false });

  session_schema.index({
    sid: 1
  })

  var Session = mongoose.model('Session', session_schema)
    , one_day = 1000 * 60 * 60 * 24
    ;

  function MongooseStore(options) {
    options = options || {};
    Store.call(this, options);
    this.ttl = options.ttl || one_day;
  };

  MongooseStore.prototype.__proto__ = Store.prototype;

  MongooseStore.prototype.get = function(sid, fn){
    debug('GET %s', sid);
    Session.findOne({ sid: sid })
      .exec(function(err, data){
        if(err){
          debug('GET error: %s', err);
          return fn(err);
        }

        if(!data){
          debug('GET no session found.');
          return fn();
        } else {

          var now = Date.now();
          var result = data.toString();
          debug('GOT %s', result);
          debug('Compare %s to %s', now, data.expires);
          if(now > data.expires){
            debug('Session past due, expire it.');
            data.remove(function(err, data){
              if(err) {
                debug('Error removing expired session. %s', err);
                return fn(err);
              }
              debug('Successfully removed expired session.');
              return fn();
            })
          } else {
            try {
              result = JSON.parse(data.session);
            } catch(err) {
              debug('Error on JSON Parse of %s', data.session);
              debug('Error was %s', err);
              return fn(err);
            }
            debug('Returning valid session.');
            return fn(null, result);
          }
        }
      });
  }

  MongooseStore.prototype.set = function(sid, sess, fn){
    debug('SET %s', sid);
    try {
      var expires = Date.now() + this.ttl;
      if(sess.cookie){
        sess.cookie.expires = new Date(expires);
      } else {
        sess.cookie = { expires: new Date(expires) };
      }

      var s = { session: JSON.stringify(sess), expires: expires };

      debug('Session record is: %s', JSON.stringify(s));

      Session.findOneAndUpdate({ sid: sid }, s, { upsert: true })
        .exec(function(err, data){
          if(err){
            debug('SET error in DB call %s', err);
            return fn(err);
          }
          debug('Session updated.');
          var result;
          try {
            debug('Try to JSON parse %s', data.session);
            result = JSON.parse(data.session);
          } catch(err){
            debug('Error after SET on JSON Parse %s', err);
            return fn(err);
          }
          debug('Return the session %s', data.session);
          return fn(null, result);
        });
    } catch (err){
      debug('SET error before query %s', err);
      return fn(err);
    }
  }

  MongooseStore.prototype.destroy = function(sid, fn){
    debug('DESTROY %s', sid);
    Session.findOneAndRemove({ sid: sid })
      .exec(function(err, data){
        if(err){
          debug('DESTROY error, %s', err);
          return fn(err);
        } else {
          debug('DESTROY success');
          return fn();
        }
      })
  }

  MongooseStore.prototype.clearAll = function(fn){
    debug('CLEARALL');
    Session.remove({})
      .exec(function(err, data){
        if(err){
          debug('CLEARALL error, %s', err);
          return fn(err);
        } else {
          debug('CLEARALL success');
          return fn();
        }
      })

  }


  return MongooseStore;
}

/*
 Session.find({})
 .exec(function(err, data){
 if(err){
 debug('The following error occurred in find(): %s', err)
 }
 if(data.length){
 debug('Found the following records in find(): %s', data)
 } else {
 debug('Found no records in find(): %s', data)
 }
 })
 */