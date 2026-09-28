#!/bin/sh
# Apply pending database migrations, then start the server.
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node server.js
