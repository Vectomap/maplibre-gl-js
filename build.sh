#! /bin/sh
echo "----------------------"
echo "Building MapLibre GEOS"
echo "----------------------"

npm run codegen

npm run build-dev
cp dist/maplibre-gl.css ../test/public
cp dist/maplibre-gl-dev.js ../test/public

# npm run build-dist
# cp dist/maplibre-gl.js ../test/public

# cp dist/maplibre-gl.css /mnt/c/GITHUB/Elevation/public/lib/
# cp dist/maplibre-gl-dev.js /mnt/c/GITHUB/Elevation/public/lib/

echo "Done"
echo ""
