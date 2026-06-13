// Node 22+ compatibility shim for buffer-equal-constant-time
// SlowBuffer was removed in Node 22; fall back to Buffer.
'use strict';
var Buffer = require('buffer').Buffer;
var SlowBuffer = require('buffer').SlowBuffer || Buffer;

module.exports = bufferEq;

function bufferEq(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  var c = 0;
  for (var i = 0; i < a.length; i++) {
    c |= a[i] ^ b[i];
  }
  return c === 0;
}

bufferEq.install = function () {
  Buffer.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
};

var origBufEqual = Buffer.prototype.equal;
var origSlowBufEqual = SlowBuffer.prototype.equal;
bufferEq.restore = function () {
  Buffer.prototype.equal = origBufEqual;
  SlowBuffer.prototype.equal = origSlowBufEqual;
};
