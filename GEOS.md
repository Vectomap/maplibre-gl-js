## MapLibre GEOS


### Modified files

src/data/dem_data.test.ts (remove)
src/data/dem_data.ts

src/geo/transform.ts

src/render/program/hillshade_program.ts
src/render/draw_hillshade.ts
src/render/uniform_binding.ts

src/shaders/hillshade_prepare.fragment.glsl
src/shaders/hillshade.fragment.glsl

src/source/raster_dem_tile_source.ts
src/source/raster_dem_tile_worker_source.ts
src/source/source_cache.ts
src/source/worker_source.ts

src/ui/camera.ts

src/util/config.ts

build.sh
GEOS.md


### Changes

#### /src/render/program/hillshade_program.ts

- HillshadeUniformsType : add new types (uniforms)
- hillshadeUniformValues : add default values for new types


 src
 |
 -- render
  |
  -- program
   |
   | - hillshade_program.ts
   |

-- shaders
 |
 | - hillshade_prepare.fragment.glsl
 | - hillshade.fragment.glsl

