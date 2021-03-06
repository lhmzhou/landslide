/**
 * Test generator
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const debug = require('debug')('data:fetch:test');
const moment = require('moment-timezone');
const utils = require('../lib/utils.js');

// Default timezone
moment.tz.setDefault('America/New_York');

// Only for test, just in case
function generate(done) {
  var generated = [];
  var fetched = moment().unix();

  if (process.env.NODE_ENV === 'test') {
    const faker = require('faker');

    // Generate
    _.range(faker.random.number({ min: 500, max: 1000 })).forEach(function() {
      var t = {};

      faker.locale = 'en';
      if (Math.random() > 0.75) {
        faker.locale = 'es';
      }

      t.id = 'test-' + faker.random.number(1000);
      t.source = 'test';
      t.sourceName = 'Test';
      t.phone = faker.phone.phoneNumber();
      t.city = faker.address.city();
      t.state = faker.address.stateAbbr();
      t.zip = faker.address.zipCode();
      t.contactable = faker.random.boolean();

      if (Math.random() < 0.75) {
        t.wait = faker.random.arrayElement(['30 min', '2minutes', 'an hour', '20min', '5 hours!']);
        if (utils.parseMinutes(t.wait)) {
          t.waitMinutes = utils.parseMinutes(t.wait);
        }
      }
      if (Math.random() < 0.75) {
        t.report = faker.lorem.words();
      }

      if (Math.random() < 0.5) {
        t.lat = faker.address.latitude();
        t.lon = faker.address.longitude();
      }

      t.updated = moment.utc(faker.date.recent()).unix();
      t.fetched = fetched;

      if (Math.random() < 0.25) {
        t.inCheck = true;
      }

      //t.messages = [];

      generated.push(t);
    });
  }

  done(null, generated);
}

// Export
module.exports = generate;
