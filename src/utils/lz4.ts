export interface LZ4 {
  compress(src: Buffer): Buffer;
}
export default {
  compress(src) {
    const LZ4 = require('../../vendor/lz4');
    let output = Buffer.alloc(LZ4.compressBound(src.byteLength));
    const compressedSize = LZ4.compress(src, output);
    output = output.slice(0, compressedSize);
    return output;
  }
} as LZ4;
