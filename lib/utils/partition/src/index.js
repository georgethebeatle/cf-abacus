'use strict';

// Small utility that distributes read/write operations on time-based versions
// of keys over a set of partitions

const _ = require('underscore');
const murmurhash = require('murmurhash');
const transform = require('abacus-transform');

const sample = _.sample;
const map = _.map;
const range = _.range;
const uniq = _.uniq;

// Setup debug log
const debug = require('abacus-debug')('abacus-partition');

// Convert a key to a bucket
const bucket = (k) => {
  // Hash the key using mumur3 32 bit with a seed of 42, then distribute
  // over 4000 buckets
  const b = murmurhash.v3(k, 42) % 4000;
  debug('Mapped key %s to bucket %d', k, b);
  return b;
};

// Convert a time to a period
const period = (t) => {
  // Use one period per day in the UTC timezone, # of days since Jan 1, 1970
  const per = Math.floor(parseInt(t) / 86400000)
  debug('Mapped time %s to period %d', t, per);
  return per;
};

// Forward a bucket, period and read/write operation to a list of (partition,
// epoch) pairs, takes a callback as the forwarding logic may need to be async
const forward = (b, p, rw, cb) => {
  // Convert the period (# of days since Jan 1, 1970) to a YYYYMM date
  const t = new Date(p * 86400000);
  const m = t.getUTCFullYear() * 100 + t.getUTCMonth() + 1;

  // Allocate 1000 buckets per partition, one epoch per month, assume that
  // each partition supports all operations, and a single replica per
  // partition (no replication)
  const pars = [[Math.floor(b / 1000), m]];

  debug(
    'Forwarded bucket %d, period %d, operation %s to partitions %o',
    b, p, rw, pars);
  return cb(undefined, pars);
};

// Randomly balance read/write perations over a list of partitions, takes a
// callback as the balancing logic may need to be async
const balance = (pars, rw, cb) => {
  const par = sample(pars);
  debug('Assigned operation %s to partition %o out of %o', rw, par, pars);
  return cb(undefined, par);
};

// Return a function that will use the given buckets, period, forward and
// and balance conversion functions to convert a key, time and operation to
// a (partition, epoch) pair, takes a callback as the partitioning logic may
// need to be async
const partitioner = (bucket, period, forward, balance) => {
  return (k, t, rw, cb) => {
    if(Array.isArray(t)) {
      // Use the range of periods between a start time and end time given
      // passed in an array
      debug('Partitioning key %s, time range %o, operation %s', k, t, rw);
      const bounds = map(t, period);
      const periods = range(
          bounds[0], bounds[1] + 1, bounds[1] < bounds[0] ? -1 : 1);

      // Apply the partition forward function to the given key bucket and
      // all the periods in the range
      const buck = bucket(k);
      transform.map(periods, (per, i, l, cb) => {
        forward(buck, per, rw,
          (err, par) => err ? cb(err) : cb(undefined, par));
      }, (err, fpars) => {
        if(err) {
          debug('Partition forwarding error %o', err);
          return cb(err);
        }

        // Apply the balance function to the list of unique
        // computed partitions
        const upars = uniq(fpars, (par) => par.join(','));
        debug('Unique forwarded partition range %o', upars);
        transform.map(upars, (par, i, l, cb) => {
          balance(par, rw, (err, bpar) => err ? cb(err) : cb(undefined, bpar));
        }, (err, bpars) => {
          if(err) {
            debug('Partition balancing error %o', err);
            return cb(err);
          }

          // Return the final list of partitions
          // selected by the balance function
          debug('Assigned partition range %o', bpars);
          cb(undefined, bpars);
        });
      });
    }
    else {
      // Apply the forward and balance functions to the given key bucket
      // and a single given time period
      debug('Partitioning key %s, time %s, operation %s', k, t, rw);
      return forward(bucket(k), period(t), rw, (err, fpar) => {
        if(err) {
          debug('Partition forwarding error %o', err);
          return cb(err);
        }
        balance(fpar, rw, (err, bpar) => {
          if(err) {
            debug('Partition balancing error %o', err);
            return cb(err);
          }
          debug('Assigned partition %o', bpar);
          cb(undefined, bpar);
        });
      });
    }
  };
};

// A default partitioning function which can be used as a good starting point
const partition = partitioner(bucket, period, forward, balance);

// Export our public functions
module.exports = partition;
module.exports.partition = partition;
module.exports.partitioner = partitioner;
module.exports.bucket = bucket;
module.exports.period = period;
module.exports.forward = forward;
module.exports.balance = balance;

