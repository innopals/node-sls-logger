// This file is a copy from https://github.com/pierrec/node-lz4/blob/master/lib/binding.js
/**
	Javascript version of the key LZ4 C functions
 */
if (!Math.imul) Math.imul = function imul(a, b) {
  var ah = a >>> 16;
  var al = a & 0xffff;
  var bh = b >>> 16;
  var bl = b & 0xffff;
  return (al * bl + ((ah * bl + al * bh) << 16)) | 0;
};

var
  maxInputSize = 0x7E000000
  , minMatch = 4
  // uint32() optimization
  , hashLog = 16
  , hashShift = (minMatch * 8) - hashLog
  , hashSize = 1 << hashLog

  , copyLength = 8
  , mfLimit = copyLength + minMatch
  , skipStrength = 6

  , mlBits = 4
  , mlMask = (1 << mlBits) - 1
  , runBits = 8 - mlBits
  , runMask = (1 << runBits) - 1

  , hasher = 2654435761

// CompressBound returns the maximum length of a lz4 block, given it's uncompressed length
exports.compressBound = function (isize) {
  return isize > maxInputSize
    ? 0
    : (isize + (isize / 255) + 16) | 0
}

exports.compress = function (src, dst, sIdx, eIdx) {
  // V8 optimization: non sparse array with integers
  var hashTable = new Array(hashSize)
  for (var i = 0; i < hashSize; i++) {
    hashTable[i] = 0
  }
  return compressBlock(src, dst, 0, hashTable, sIdx || 0, eIdx || dst.length)
}

function compressBlock(src, dst, pos, hashTable, sIdx, eIdx) {
  var dpos = sIdx
  var dlen = eIdx - sIdx
  var anchor = 0

  if (src.length >= maxInputSize) throw new Error("input too large")

  // Minimum of input bytes for compression (LZ4 specs)
  if (src.length > mfLimit) {
    var n = exports.compressBound(src.length)
    if (dlen < n) throw Error("output too small: " + dlen + " < " + n)

    var
      step = 1
      , findMatchAttempts = (1 << skipStrength) + 3
      // Keep last few bytes incompressible (LZ4 specs):
      // last 5 bytes must be literals
      , srcLength = src.length - mfLimit

    while (pos + minMatch < srcLength) {
      // Find a match
      // min match of 4 bytes aka sequence
      var sequenceLowBits = src[pos + 1] << 8 | src[pos]
      var sequenceHighBits = src[pos + 3] << 8 | src[pos + 2]
      // compute hash for the current sequence
      var hash = Math.imul(sequenceLowBits | (sequenceHighBits << 16), hasher) >>> hashShift
      // get the position of the sequence matching the hash
      // NB. since 2 different sequences may have the same hash
      // it is double-checked below
      // do -1 to distinguish between initialized and uninitialized values
      var ref = hashTable[hash] - 1
      // save position of current sequence in hash table
      hashTable[hash] = pos + 1

      // first reference or within 64k limit or current sequence !== hashed one: no match
      if (ref < 0 ||
        ((pos - ref) >>> 16) > 0 ||
        (
          ((src[ref + 3] << 8 | src[ref + 2]) != sequenceHighBits) ||
          ((src[ref + 1] << 8 | src[ref]) != sequenceLowBits)
        )
      ) {
        // increase step if nothing found within limit
        step = findMatchAttempts++ >> skipStrength
        pos += step
        continue
      }

      findMatchAttempts = (1 << skipStrength) + 3

      // got a match
      var literals_length = pos - anchor
      var offset = pos - ref

      // minMatch already verified
      pos += minMatch
      ref += minMatch

      // move to the end of the match (>=minMatch)
      var match_length = pos
      while (pos < srcLength && src[pos] == src[ref]) {
        pos++
        ref++
      }

      // match length
      match_length = pos - match_length

      // token
      var token = match_length < mlMask ? match_length : mlMask

      // encode literals length
      if (literals_length >= runMask) {
        // add match length to the token
        dst[dpos++] = (runMask << mlBits) + token
        for (var len = literals_length - runMask; len > 254; len -= 255) {
          dst[dpos++] = 255
        }
        dst[dpos++] = len
      } else {
        // add match length to the token
        dst[dpos++] = (literals_length << mlBits) + token
      }

      // write literals
      for (var i = 0; i < literals_length; i++) {
        dst[dpos++] = src[anchor + i]
      }

      // encode offset
      dst[dpos++] = offset
      dst[dpos++] = (offset >> 8)

      // encode match length
      if (match_length >= mlMask) {
        match_length -= mlMask
        while (match_length >= 255) {
          match_length -= 255
          dst[dpos++] = 255
        }

        dst[dpos++] = match_length
      }

      anchor = pos
    }
  }

  // cannot compress input
  if (anchor == 0) return 0

  // Write last literals
  // encode literals length
  literals_length = src.length - anchor
  if (literals_length >= runMask) {
    // add match length to the token
    dst[dpos++] = (runMask << mlBits)
    for (var ln = literals_length - runMask; ln > 254; ln -= 255) {
      dst[dpos++] = 255
    }
    dst[dpos++] = ln
  } else {
    // add match length to the token
    dst[dpos++] = (literals_length << mlBits)
  }

  // write literals
  pos = anchor
  while (pos < src.length) {
    dst[dpos++] = src[pos++]
  }

  return dpos
}
