"use strict";
try {
  require('./inject_keys_from_json.cjs');
} catch (e) {
  require('fs').writeFileSync('clean_error.txt', e.stack, 'utf8');
}
