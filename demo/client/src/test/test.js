'use strict';

// Simulate a test service provider that submits usage for a resource and
// verifies the submission by retrieving a usage report.

const _ = require('underscore');

const request = require('abacus-request');
const util = require('util');
const commander = require('commander');

const map = _.map;
const omit = _.omit;
const clone = _.clone;
const range = _.range;

// Parse command line options
const argv = clone(process.argv);
argv.splice(1, 1, 'demo');
commander
  .option('-c, --collector <uri>',
    'usage collector URL or domain name [http://localhost:9080]',
    'http://localhost:9080')
  .option('-r, --reporting <uri>',
    'usage reporting URL or domain name [http://localhost:9088]',
    'http://localhost:9088')
  .option(
    '-d, --delta <d>', 'usage time window shift in milli-seconds', parseInt)
  .allowUnknownOption(true)
  .parse(argv);

// Collector service URL
const collector = /:/.test(commander.collector) ? commander.collector :
  'https://abacus-usage-collector.' + commander.collector;

// Reporting service URL
const reporting = /:/.test(commander.reporting) ? commander.reporting :
  'https://abacus-usage-reporting.' + commander.reporting;

// Usage time window shift in milli-seconds
const delta = commander.delta || 0;

// The current time + 1 hour into the future
const now = new Date(Date.now() + 3600000);

// The current slack configuration
const slack = /^[0-9]+[MDhms]$/.test(process.env.SLACK) ? {
  scale : process.env.SLACK.charAt(process.env.SLACK.length - 1),
  width : process.env.SLACK.match(/[0-9]+/)[0]
} : {};

// Calculates the max number of slack windows in a given time window
const maxSlack = (w) => {
  const slackscale = {
    M: { 4: 1 },
    D: { 4: 28, 3: 1 },
    h: { 4: 672, 3: 24, 2: 1 },
    m: { 4: 40320, 3: 1440, 2: 60, 1: 1 },
    s: { 4: 2419200, 3: 86400, 2: 3600, 1: 60, 0: 1 }
  };
  if(slack.scale && slackscale[slack.scale][w])
    return map(Array(Math.ceil(1 / slackscale[slack.scale][w] * slack.width)
      + 1), () => 0);
  return [0];
};

// Builds the expected window value based upon the
// charge summary, quantity, cost, and window
const buildWindow = (ch, s, q, c) => {
  const windows = [];
  map(range(5), (i) => {
    const w = {};
    // Adds the key value pair to o
    // sets the value to zero if z is set
    const addProperty = (k, v, o, z) => {
      if(typeof v !== 'undefined')
        o[k] = z ? 0 : v;
    };
    addProperty('charge', ch, w);
    addProperty('summary', s, w);
    addProperty('quantity', q, w);
    addProperty('cost', c, w);
    const ws = map(maxSlack(i), () => {
      const wi = {};
      addProperty('charge', ch, wi, true);
      addProperty('summary', s, wi, true);
      addProperty('quantity', q, wi, true);
      addProperty('cost', c, wi, true);
      return wi;
    });
    ws[0] = w;
    windows.push(ws);
  });
  return windows;
}

describe('abacus-demo-client', () => {
  it('submits usage for a sample resource and retrieves an aggregated ' +
    'usage report', function(done) {
      // Configure the test timeout
      const timeout = 20000;
      this.timeout(timeout + 5000);
      const giveup = now.getTime() + timeout;

      // Test usage to be submitted by the client
      const start = now.getTime() + delta;
      const end = now.getTime() + delta;
      const usage = [
        {
          message:
            'Submitting 10 GB, 1000 light API calls, 100 heavy API calls',
          usage: {
            usage: [{
              start: start,
              end: end,
              region: 'us',
              organization_id: 'a3d7fe4d-3cb1-4cc3-a831-ffe98e20cf27',
              space_id: 'aaeae239-f3f8-483c-9dd0-de5d41c38b6a',
              consumer_id: 'external:bbeae239-f3f8-483c-9dd0-de6781c38bab',
              resource_id: 'object-storage',
              plan_id: 'basic',
              resource_instance_id: '0b39fa70-a65f-4183-bae8-385633ca5c87',
              measured_usage: [{
                measure: 'storage',
                quantity: 1073741824
              }, {
                measure: 'light_api_calls',
                quantity: 1000
              }, {
                measure: 'heavy_api_calls',
                quantity: 100
              }]
            }]
          }
        },
        {
          message:
            'Submitting 10 GB, 1000 light API calls, 100 heavy API calls',
          usage: {
            usage: [{
              start: start + 1,
              end: end + 1,
              region: 'us',
              organization_id: 'a3d7fe4d-3cb1-4cc3-a831-ffe98e20cf27',
              space_id: 'aaeae239-f3f8-483c-9dd0-de5d41c38b6a',
              consumer_id: 'external:bbeae239-f3f8-483c-9dd0-de6781c38bab',
              resource_id: 'object-storage',
              plan_id: 'basic',
              resource_instance_id: '0b39fa70-a65f-4183-bae8-385633ca5c87',
              measured_usage: [{
                measure: 'storage',
                quantity: 1073741824
              }, {
                measure: 'light_api_calls',
                quantity: 1000
              }, {
                measure: 'heavy_api_calls',
                quantity: 100
              }]
            }]
          }
        },
        {
          message:
            'Submitting 10 GB, 1000 light API calls, 100 heavy API calls',
          usage: {
            usage: [{
              start: start + 2,
              end: end + 2,
              region: 'us',
              organization_id: 'a3d7fe4d-3cb1-4cc3-a831-ffe98e20cf27',
              space_id: 'aaeae239-f3f8-483c-9dd0-de5d41c38b6a',
              consumer_id: 'external:bbeae239-f3f8-483c-9dd0-de6781c38bab',
              resource_id: 'object-storage',
              plan_id: 'basic',
              resource_instance_id: '0b39fa70-a65f-4183-bae8-385633ca5c87',
              measured_usage: [{
                measure: 'storage',
                quantity: 1073741824
              }, {
                measure: 'light_api_calls',
                quantity: 1000
              }, {
                measure: 'heavy_api_calls',
                quantity: 100
              }]
            }]
          }
        }];

      // Expected usage report for the test organization
      const report = {
        organization_id: 'a3d7fe4d-3cb1-4cc3-a831-ffe98e20cf27',
        region: 'us',
        windows: buildWindow(46.09),
        resources: [{
          resource_id: 'object-storage',
          windows: buildWindow(46.09),
          aggregated_usage: [{
            metric: 'storage',
            windows: buildWindow(1, 1, 1)
          }, {
            metric: 'thousand_light_api_calls',
            windows: buildWindow(0.09, 3, 3)
          }, {
            metric: 'heavy_api_calls',
            windows: buildWindow(45, 300, 300)
          }],
          plans: [{
            plan_id: 'basic',
            windows: buildWindow(46.09),
            aggregated_usage: [{
              metric: 'storage',
              windows: buildWindow(1, 1, 1, 1)
            }, {
              metric: 'thousand_light_api_calls',
              windows: buildWindow(0.09, 3, 3, 0.09)
            }, {
              metric: 'heavy_api_calls',
              windows: buildWindow(45, 300, 300, 45)
            }]
          }]
        }],
        spaces: [{
          space_id: 'aaeae239-f3f8-483c-9dd0-de5d41c38b6a',
          windows: buildWindow(46.09),
          resources: [{
            resource_id: 'object-storage',
            windows: buildWindow(46.09),
            aggregated_usage: [{
              metric: 'storage',
              windows: buildWindow(1, 1, 1)
            }, {
              metric: 'thousand_light_api_calls',
              windows: buildWindow(0.09, 3, 3)
            }, {
              metric: 'heavy_api_calls',
              windows: buildWindow(45, 300, 300)
            }],
            plans: [{
              plan_id: 'basic',
              windows: buildWindow(46.09),
              aggregated_usage: [{
                metric: 'storage',
                windows: buildWindow(1, 1, 1, 1)
              }, {
                metric: 'thousand_light_api_calls',
                windows: buildWindow(0.09, 3, 3, 0.09)
              }, {
                metric: 'heavy_api_calls',
                windows: buildWindow(45, 300, 300, 45)
              }]
            }]
          }],
          consumers: [{
            consumer_id: 'external:bbeae239-f3f8-483c-9dd0-de6781c38bab',
            windows: buildWindow(46.09),
            resources: [{
              resource_id: 'object-storage',
              windows: buildWindow(46.09),
              aggregated_usage: [{
                metric: 'storage',
                windows: buildWindow(1, 1, 1)
              }, {
                metric: 'thousand_light_api_calls',
                windows: buildWindow(0.09, 3, 3)
              }, {
                metric: 'heavy_api_calls',
                windows: buildWindow(45, 300, 300)
              }],
              plans: [{
                plan_id: 'basic',
                windows: buildWindow(46.09),
                aggregated_usage: [{
                  metric: 'storage',
                  windows: buildWindow(1, 1, 1, 1)
                }, {
                  metric: 'thousand_light_api_calls',
                  windows: buildWindow(0.09, 3, 3, 0.09)
                }, {
                  metric: 'heavy_api_calls',
                  windows: buildWindow(45, 300, 300, 45)
                }]
              }]
            }]
          }]
        }]
      };

      // Submit usage for sample resource with 10 GB, 1000 light API calls,
      // and 100 heavy API calls
      let posts = 0;
      const post = (u, done) => {
        console.log(u.message);

        const cb = () => {
          if(++posts === usage.length) done();
        };

        request.post(collector + '/v1/metering/collected/usage', {
          body: u.usage
        }, (err, val) => {
          expect(err).to.equal(undefined);

          // Expect a 201 with the location of the accumulated usage
          expect(val.statusCode).to.equal(201);
          expect(val.headers.location).to.not.equal(undefined);
          cb();
        });
      };

      // Print the number of usage docs already processed given a get report
      // response, determined from the aggregated usage quantity found in the
      // report for our test resource
      const processed = (val) => {
        try {
          return val.body.resources[0].aggregated_usage[1].windows[6].summary;
        }
        catch (e) {
          // The response doesn't contain a valid report
          return 0;
        }
      };

      // Get a usage report for the test organization
      const get = (done) => {
        request.get(reporting + '/v1/metering/organizations' +
          '/:organization_id/aggregated/usage', {
            organization_id: 'a3d7fe4d-3cb1-4cc3-a831-ffe98e20cf27'
          }, (err, val) => {
            expect(err).to.equal(undefined);
            expect(val.statusCode).to.equal(200);

            // Compare the usage report we got with the expected report
            console.log('Processed %d usage docs', processed(val));
            try {
              expect(omit(val.body,
                'id', 'processed', 'start', 'end')).to.deep.equal(report);
              console.log('\n', util.inspect(val.body, {
                depth: 10
              }), '\n');
              done();
            }
            catch (e) {
              // If the comparison fails we'll be called again to retry
              // after 250 msec, give up after the configured timeout as
              // if we're still not getting the expected report then
              // the processing of the submitted usage must have failed
              if(Date.now() >= giveup) {
                console.log('All submitted usage still not processed\n');
                expect(omit(val.body,
                  'id', 'processed', 'start', 'end')).to.deep.equal(report);
              }
              else
                setTimeout(() => get(done), 250);
            }
          });
      };

      // Wait for the expected usage report, get a report every 250 msec until
      // we get the expected values indicating that all submitted usage has
      // been processed
      const wait = (done) => {
        console.log('\nRetrieving usage report');
        get(done);
      };

      // Wait for usage reporter to start
      request.waitFor(reporting + '/batch', {}, (err, value) => {
        // Failed to ping usage reporter before timing out
        if (err) throw err;

        // Run the above steps
        map(usage, (u) => post(u, () => wait(done)));
      });
    });
});

