const debug = require('debug')('mongoose-store');
const Cache = require('node-cache');

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

module.exports = (session, mongoose) => class MongooseStore extends session.Store {
  constructor (options = { modelName: 'Session', ttl: DAY, ttlCache: HOUR }) {
    super(options);

    this.ttl = options.ttl || DAY;
    this.cache = new Cache({ stdTTL: options.ttlCache || HOUR });
    options.modelName = options.modelName || 'Session';

    try {
      this.Session = mongoose.model(options.modelName);
    }
    catch (ex) {
      this.Session = mongoose.model(options.modelName, new mongoose.Schema({
        _id: { type: mongoose.Schema.ObjectId, select: false },
        sid: { type: String, index: true },
        session: { type: String },
        created: { type: Date, default: Date.now, expires: parseInt(options.ttl / 1000, 10) }
      }, { strict: false }));
    }
  }

  get (sid, fn = () => {}) {
    debug('GET %s', sid);

    this.cache.get(sid, (err, data) => {
      if (!err && data) {
        debug('GET return session from cache');
        return fn(null, data);
      }

      this.Session.findOne({ sid }).exec((err, data) => {
        if (err) {
          debug('GET error: %s', err);
          return fn(err);
        }
        else if (!data) {
          debug('GET no session found.');
          return fn();
        }

        debug('GET set cache and return session %s', data.session);

        try {
          data = JSON.parse(data.session);
          this.cache.set(sid, data);
          return fn(null, data);
        }
        catch (ex) {
          debug('GET error: %s, %s', ex, data.session);
          return fn(ex);
        }
      });
    });
  }

  set (sid, session, fn = () => {}) {
    debug('SET %s', sid);

    const expires = new Date(Date.now() + this.ttl);
    session.cookie = Object.assign(session.cookie || { expires });

    const data = {
      session: JSON.stringify(session),
      created: Date.now()
    };

    debug('SET session %s', JSON.stringify(data));

    this.Session.findOneAndUpdate({ sid }, data, { upsert: true, new: true }).exec((err, data) => {
      if (err) {
        debug('SET database error %s', err);
        return fn(err);
      }

      debug('SET set cache and return session %s', JSON.stringify(data));

      try {
        data = JSON.parse(data.session);
        this.cache.set(sid, data);
        return fn(null, data);
      }
      catch (ex) {
        debug('GET error: %s, %s', ex, data.session);
        return fn(ex);
      }
    });
  }

  destroy (sid, fn = () => {}) {
    debug('DESTROY %s', sid);

    this.Session.findOneAndRemove({ sid }).exec((err) => {
      if (err) {
        debug('DESTROY error: %s', err);
        return fn(err);
      }

      debug('DESTROY success: %s', sid);
      this.cache.del(sid);
      fn();
    });
  }

  clearAll (fn = () => {}) {
    debug('CLEARALL');

    this.Session.remove({}).exec((err) => {
      if (err) {
        debug('CLEARALL error, %s', err);
        return fn(err);
      }

      debug('CLEARALL success');
      this.cache.flushAll();
      return fn();
    });
  }

  keepAlive () {
    debug('KEEPALIVE');

    this.Session.find({ noexits: true }, err => err ?
      debug('KEEPALIVE error: %s', err) :
      debug('KEEPALIVE success'));
  }
};
