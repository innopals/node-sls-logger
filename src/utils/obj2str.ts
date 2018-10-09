export default function (item: any) {
  if (item === null) {
    return 'null';
  }
  if (item instanceof Error) {
    return item.stack || item.message;
  }
  if (typeof item === 'string') {
    return JSON.stringify(item);
  }
  if (typeof item !== 'object') {
    return String(item);
  }
  return '{ ' + Object.keys(item).map(k => `${k}: ${typeof item[k] === 'string' ? JSON.stringify(item[k]) : String(item[k])}`).join(", ") + ' }';
}
