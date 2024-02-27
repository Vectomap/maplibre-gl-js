import {mat4} from 'gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformMatrix4f,
    UniformArray4f
} from '../uniform_binding';
import {EXTENT} from '../../data/extent';
import {MercatorCoordinate} from '../../geo/mercator_coordinate';

import type {Context} from '../../gl/context';
import type {UniformValues, UniformLocations} from '../uniform_binding';
import type {Tile} from '../../source/tile';
import type {Painter} from '../painter';
import type {HillshadeStyleLayer} from '../../style/style_layer/hillshade_style_layer';
import type {DEMData} from '../../data/dem_data';
import type {OverscaledTileID} from '../../source/tile_id';

export type HillshadeUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_image': Uniform1i;
    'u_latrange': Uniform2f;
    'u_light': Uniform2f;
    'u_shadow': UniformColor;
    'u_highlight': UniformColor;
    'u_accent': UniformColor;

    'u_ramp': UniformArray4f;

    'u_image_elev': Uniform1i;

    'u_exag': Uniform1f;
    'u_zenith': Uniform1f;
    'u_azimuth': Uniform1f;

    'u_mixslope': Uniform1f;
    'u_mixshade': Uniform1f;
    'u_mixcolor': Uniform1f;

    'u_brightness': Uniform1f;
    'u_contrast': Uniform1f;
    'u_exposure': Uniform1f;

    'u_saturation': Uniform1f;
    'u_vibrance': Uniform1f;
    'u_hue': Uniform1f;

    'u_debugclass': Uniform1i;
    'u_autoscale': Uniform1i;
    'u_elevmin': Uniform1f;
    'u_elevmax': Uniform1f;
};

export type HillshadePrepareUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_image': Uniform1i;
    'u_dimension': Uniform2f;
    'u_zoom': Uniform1f;
};

const hillshadeUniforms = (context: Context, locations: UniformLocations): HillshadeUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_latrange': new Uniform2f(context, locations.u_latrange),
    'u_light': new Uniform2f(context, locations.u_light),
    'u_shadow': new UniformColor(context, locations.u_shadow),
    'u_highlight': new UniformColor(context, locations.u_highlight),
    'u_accent': new UniformColor(context, locations.u_accent),

    'u_image_elev': new Uniform1i(context, locations.u_image_elev),

    'u_ramp': new UniformArray4f(context, locations.u_ramp),

    'u_exag': new Uniform1f(context, locations.u_exag),
    'u_zenith': new Uniform1f(context, locations.u_zenith),
    'u_azimuth': new Uniform1f(context, locations.u_azimuth),

    'u_mixslope': new Uniform1f(context, locations.u_mixslope),
    'u_mixshade': new Uniform1f(context, locations.u_mixshade),
    'u_mixcolor': new Uniform1f(context, locations.u_mixcolor),

    'u_brightness': new Uniform1f(context, locations.u_brightness),
    'u_contrast': new Uniform1f(context, locations.u_contrast),
    'u_exposure': new Uniform1f(context, locations.u_exposure),

    'u_saturation': new Uniform1f(context, locations.u_saturation),
    'u_vibrance': new Uniform1f(context, locations.u_vibrance),
    'u_hue': new Uniform1f(context, locations.u_hue),

    'u_debugclass': new Uniform1i(context, locations.u_debugclass),
    'u_autoscale': new Uniform1i(context, locations.u_autoscale),
    'u_elevmin': new Uniform1f(context, locations.u_elevmin),
    'u_elevmax': new Uniform1f(context, locations.u_elevmax)
});

const hillshadePrepareUniforms = (context: Context, locations: UniformLocations): HillshadePrepareUniformsType => ({
    'u_matrix': new UniformMatrix4f(context, locations.u_matrix),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_dimension': new Uniform2f(context, locations.u_dimension),
    'u_zoom': new Uniform1f(context, locations.u_zoom)
});

// GEOS - Render

// Passe ici des milliers de fois par seconde
// -> A OPTIMISER: Ne pas faire de calculs, tester s'il y a eu du changement, passer le min de variables

// console.log('Init render')


const hillshadeUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: HillshadeStyleLayer,
    coord: OverscaledTileID
): UniformValues<HillshadeUniformsType> => {

    const shadow = layer.paint.get('hillshade-shadow-color');
    const highlight = layer.paint.get('hillshade-highlight-color');
    const accent = layer.paint.get('hillshade-accent-color');

    // const ramp = [0.1, 0.1, 0.5, -5000.0, 0.607, 0.937, 0.949, 0.0, 0.4, 0.55, 0.3, 1.0, 0.9,  0.9, 0.6, 300.0, 0.6,  0.4, 0.3, 2000.0,1.0,  1.0, 1.0, 4000.0, 1.0, 1.0, 1.0, 20000.0];
    const ramp = layer.paint.get('geos-ramp')['value']['value'];
    // console.log('geos-ramp', ramp);

    let azimuthal = layer.paint.get('hillshade-illumination-direction') * (Math.PI / 180);
    // modify azimuthal angle by map rotation if light is anchored at the viewport
    if (layer.paint.get('hillshade-illumination-anchor') === 'viewport') {
        azimuthal -= painter.transform.angle;
    }
    const align = !painter.options.moving;

    return {
        'u_matrix': coord ? coord.posMatrix : painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped(), align),
        'u_image': 0,
        'u_latrange': getTileLatRange(painter, tile.tileID),
        'u_light': [layer.paint.get('hillshade-exaggeration'), azimuthal],
        'u_shadow': shadow,
        'u_highlight': highlight,
        'u_accent': accent,

        'u_image_elev': 1,

        'u_ramp': ramp,

        'u_exag': layer.paint.get('geos-exag'),
        'u_zenith': layer.paint.get('geos-zenith'),
        'u_azimuth': layer.paint.get('geos-azimuth'),

        'u_mixslope': layer.paint.get('geos-mix-slope'),
        'u_mixshade': layer.paint.get('geos-mix-shade'),
        'u_mixcolor': layer.paint.get('geos-mix-color'),

        'u_brightness': layer.paint.get('geos-brightness'),
        'u_contrast': layer.paint.get('geos-contrast'),
        'u_exposure': layer.paint.get('geos-exposure'),

        'u_saturation': layer.paint.get('geos-saturation'),
        'u_vibrance': layer.paint.get('geos-vibrance'),
        'u_hue': layer.paint.get('geos-hue'),

        'u_debugclass': layer.paint.get('geos-debugclass'),
        'u_autoscale': layer.paint.get('geos-autoscale'),
        'u_elevmin': painter.transform.elevMin,
        'u_elevmax': painter.transform.elevMax
    };
};


// Prepare
// Passe moins souvent que hillshadeUniformValues mais qd même conséquent

const hillshadeUniformPrepareValues = (tileID: OverscaledTileID, dem: DEMData): UniformValues<HillshadePrepareUniformsType> => {

    const stride = dem.stride;
    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    return {
        'u_matrix': matrix,
        'u_image': 1,
        'u_dimension': [stride, stride],
        'u_zoom': tileID.overscaledZ
    };
};

function getTileLatRange(painter: Painter, tileID: OverscaledTileID) {
    // for scaling the magnitude of a points slope by its latitude
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const y = tileID.canonical.y;
    return [
        new MercatorCoordinate(0, y / tilesAtZoom).toLngLat().lat,
        new MercatorCoordinate(0, (y + 1) / tilesAtZoom).toLngLat().lat];
}

export {
    hillshadeUniforms,
    hillshadePrepareUniforms,
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
};
