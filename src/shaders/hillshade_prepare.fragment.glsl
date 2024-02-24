#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image;
in vec2 v_pos;

uniform vec2 u_dimension;
uniform float u_zoom;

varying float u_calcmin;
varying float u_calcmax;

// Decode RGB elevation to meters
float getElevation(vec2 coord) {
    vec4 data = texture(u_image, coord) * 255.0;
    // return data.r * 256.0 + data.g + data.b / 256.0 - 32768.0;

    return (mod(data.r * 65536.0 + data.g * 256.0 + data.b, 2000000.0) - 1100000.0) / 100.0;
}

void main() {
    vec2 epsilon = 1.0 / u_dimension;

    // queried pixels:
    // +-----------+
    // |   |   |   |
    // | a | b | c |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | d | e | f |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | g | h | i |
    // |   |   |   |
    // +-----------+

    // GEOS
    // Est-ce qu'on pourrait calculer ici l'elev min et max de la zone visible et stocker les valeurs pour hillshade.fragment ??
    // -> on ne peut pas modifier un uniform depuis le shader
    // -> mais on peut écrire dans une texture
    // cfr. https://webglfundamentals.org/webgl/lessons/webgl-qna-determine-min-max-values-for-the-entire-image.html

    float a = getElevation(v_pos + vec2(-epsilon.x, -epsilon.y));
    float b = getElevation(v_pos + vec2(0, -epsilon.y));
    float c = getElevation(v_pos + vec2(epsilon.x, -epsilon.y));
    float d = getElevation(v_pos + vec2(-epsilon.x, 0));
    // float e = getElevation(v_pos);
    float f = getElevation(v_pos + vec2(epsilon.x, 0));
    float g = getElevation(v_pos + vec2(-epsilon.x, epsilon.y));
    float h = getElevation(v_pos + vec2(0, epsilon.y));
    float i = getElevation(v_pos + vec2(epsilon.x, epsilon.y));

    // Here we divide the x and y slopes by 8 * pixel size
    // where pixel size (aka meters/pixel) is:
    // circumference of the world / (pixels per tile * number of tiles)
    // which is equivalent to: 8 * 40075016.6855785 / (512 * pow(2, u_zoom))
    // which can be reduced to: pow(2, 19.25619978527 - u_zoom).
    // We want to vertically exaggerate the hillshading because otherwise
    // it is barely noticeable at low zooms. To do this, we multiply this by
    // a scale factor that is a function of zooms below 15, which is an arbitrary
    // that corresponds to the max zoom level of Mapbox terrain-RGB tiles.
    // See nickidlugash's awesome breakdown for more info:
    // https://github.com/mapbox/mapbox-gl-js/pull/5286#discussion_r148419556

    float exagFactor = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;
    float exag = u_zoom < 15.0 ? (u_zoom - 15.0) * exagFactor : 0.0;

    vec2 deriv = vec2(
        (c + f + f + i) - (a + d + d + g),
        (g + h + h + i) - (a + b + b + c)
    ) / pow(2.0, exag + (19.2562 - u_zoom));

    fragColor = clamp(vec4(
        deriv.x / 2.0 + 0.5,
        deriv.y / 2.0 + 0.5,
        1.0,
        1.0), 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
