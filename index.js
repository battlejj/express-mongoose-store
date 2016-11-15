const debug = require('debug')('mongoose-store');

const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

module.exports = (session, mongoose) => class MongooseStore extends session.Store {
  constructor (options = { modelName: 'Session', ttl: DAY }) {
    super(options);

    this.ttl = options.ttl || DAY;

    if (options.cache) {
      this.cache = options.cache;
    }

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

  _get (sid, fn = () => {}) {
    this.Session.findOne({ sid }).exec((err, data) => {
      if (err) {
        debug('GET error: %s', err);
        return fn(err);
      }
      else if (!data) {
        debug('GET no session found.');
        return fn();
      }

      debug('GET parse and return session %s', data.session);

      try {
        data = JSON.parse(data.session);
        return fn(null, data);
      }
      catch (ex) {
        debug('GET error: %s, %s', ex, data.session);
        return fn(ex);
      }
    });
  }

  get (sid, fn = () => {}) {
    debug('GET %s', sid);

    if (this.cache) {
      return this.cache.wrap(sid, fn => this._get(sid, fn), fn);
    }

    return this._get(sid, fn);
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

      debug('SET parse and return session %s', JSON.stringify(data));

      try {
        data = JSON.parse(data.session);

        if (this.cache) {
          this.cache.set(sid, data);
        }

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

      if (this.cache) {
        this.cache.del(sid);
      }

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

      if (this.cache) {
        this.cache.reset();
      }

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
