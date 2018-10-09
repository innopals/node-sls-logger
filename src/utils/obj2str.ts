function obj2str(item: any): string {
  if ((Array.isArray(item))) {
    return '[' + item.map(obj2str).join(', ') + ']';
  }
  if (item instanceof Error) {
    return item.stack || item.message || String(item);
  }
  if (typeof item === 'string') {
    return JSON.stringify(item);
  }
  if (item === null || item instanceof Date || typeof item !== 'object') {
    return String(item);
  }
  const keys = Object.keys(item);
  if (keys.length === 0) { return "{}"; }
  else {
    return '{ ' + keys.map(
      k => `${k}: ${typeof item[k] === 'string' ? JSON.stringify(item[k]) : String(item[k])}`
    ).join(", ") + ' }';
  }
}

export default obj2str;
