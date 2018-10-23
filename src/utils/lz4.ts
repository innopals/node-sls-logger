export interface LZ4 {
  compress(src: Buffer): Buffer;
}
export default {
  compress(src) {
    const lz4 = require("../../vendor/lz4");
    const output = Buffer.alloc(lz4.compressBound(src.byteLength));
    const compressedSize = lz4.compress(src, output);
    return output.slice(0, compressedSize);
  },
} as LZ4;
