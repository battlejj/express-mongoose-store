const expect = require('chai').expect;
const session = require('express-session');
const mongoose = require('mongoose');
const cache = require('cache-manager').caching({ store: 'memory', ttl: 300 });

let MongooseStore;
let store;

[true, false].forEach((withCache) => {
  describe(`Test sessions (cache ${withCache ? 'enabled' : 'disabled'})`, () => {
    before((done) => {
      const options = { cache: withCache && cache };

      MongooseStore = require('./index')(session, mongoose);
      store = new MongooseStore(options);

      if (mongoose.connection.readyState) {
        return done();
      }

      mongoose.connect('mongodb://127.0.0.1:27017/test');
      mongoose.connection.on('open', done);
    });

    describe('Check that sessions can be set', () => {

      it('should be able to set values for a session', (done) => {
        store.set('123', { cookie: { maxAge: 2000 }, handle: '@complexcarb' }, (err, ok) => {
          expect(err).to.not.exist;
          expect(ok).to.be.ok;
          done();
        });
      });

      it('should be able to get the value we just stored', (done) => {
        store.get('123', (err, ok) => {
          expect(err).to.not.exist;
          expect(ok).to.be.ok;
          expect(ok).to.have.property('cookie');
          expect(ok).to.have.deep.property('cookie.maxAge').and.to.eql(2000);
          expect(ok).to.have.property('handle').and.to.eql('@complexcarb');

          done();
        });
      });

      it('should remove the session we created', (done) => {
        store.destroy('123', () => {
          store.get('123', (err, ok) => {
            expect(err).to.not.exist;
            expect(ok).to.not.exist;
            done();
          });
        });
      });

      it('should add two sessions and clear them both', (done) => {
        store.set('123', { cookie: {} }, (err, ok) => {
          expect(err).to.not.exist;
          expect(ok).to.have.property('cookie');
          store.set('456', { cookie: {} }, (err, ok) => {
            expect(err).to.not.exist;
            expect(ok).to.have.property('cookie');
            store.clearAll(() => {
              store.get('123', (err, ok) => {
                expect(err).to.not.exist;
                expect(ok).to.not.exist;
                store.get('456', (err, ok) => {
                  expect(err).to.not.exist;
                  expect(ok).to.not.exist;
                  done();
                });
              });
            });
          });
        });
      });

    });

  });
});
