try {
  require('./add_keys.cjs');
} catch (e) {
  require('fs').writeFileSync('err.log', e.stack || e.message);
}
