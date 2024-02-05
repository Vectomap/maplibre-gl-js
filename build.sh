#! /bin/sh
echo "Building MapLibre GEOS.."

npm run codegen

npm run build-dev
# npm run build-dist

cp dist/maplibre-gl.css ../test/public
cp dist/maplibre-gl-dev.js ../test/public
# cp dist/maplibre-gl.js ../test/public
