'use strict';

module.exports = async () => {
  const response = await fetch('http://127.0.0.1:8877/__stop-fixture', { method: 'POST' });
  if (!response.ok) throw new Error(`Browser fixture cleanup failed (${response.status}).`);
};
