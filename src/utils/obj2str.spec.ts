import obj2str from './obj2str';
describe("Testing obj2str", () => {
  it(
    "Basic tests converting everything to log string",
    () => {
      expect(obj2str("Hello world!")).toEqual('"Hello world!"');
      expect(obj2str(2)).toEqual('2');
      expect(obj2str(NaN)).toEqual('NaN');
      expect(obj2str(true)).toEqual('true');
      expect(obj2str(Infinity)).toEqual('Infinity');
      expect(obj2str(null)).toEqual('null');
      expect(obj2str(undefined)).toEqual('undefined');
      expect(obj2str({})).toEqual("{}");
      expect(obj2str(Object.create(null))).toEqual("{}");
      expect(obj2str([])).toEqual("[]");
      expect(obj2str(new Date(1539043200000))).toEqual(new Date(1539043200000).toString());
      expect(obj2str(function () { "aaa"; })).toMatch(/^function \(\) \{\s+"aaa";\s+\}$/);
      expect(obj2str({ a: 1, b: { c: 1 }, d: "123", e: false })).toEqual("{ a: 1, b: [object Object], d: \"123\", e: false }");
      expect(obj2str([1, 2, 3, "ccc", false, null, undefined, new Error("test")])).toMatch(/^\[1, 2, 3, "ccc", false, null, undefined, Error: test\n/);
      expect(obj2str(new Error('test2'))).toMatch(/^Error: test2\n/);
    }
  );
});
