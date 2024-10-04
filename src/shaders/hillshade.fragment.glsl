uniform sampler2D u_image;
uniform sampler2D u_image_elev;
in vec2 v_pos;

uniform vec2 u_latrange;
uniform vec2 u_light;
uniform vec4 u_shadow;
uniform vec4 u_highlight;
uniform vec4 u_accent;

uniform vec4 u_ramp[99];

uniform float u_exag;
uniform float u_zenith;
uniform float u_azimuth;

uniform float u_mixshade;
uniform float u_mixslope;
uniform float u_mixcolor;

uniform float u_brightness;
uniform float u_contrast;
uniform float u_exposure;

uniform float u_saturation;
uniform float u_vibrance;
uniform float u_hue;

uniform int u_debugclass;

uniform int u_autoscale;
uniform float u_elevmin;
uniform float u_elevmax;

#define PI 3.141592653589793

float zenithRad = (90.0 - u_zenith) * PI / 180.0;
float azimuthRad = radians(360.0 - u_azimuth + 90.0);

vec3 rgbToHsv(vec3 color) {
    float minVal = min(min(color.r, color.g), color.b);
    float maxVal = max(max(color.r, color.g), color.b);
    float delta = maxVal - minVal;

    float hue = 0.0;
    if (delta != 0.0) {
        if (maxVal == color.r) {
            hue = mod((color.g - color.b) / delta, 6.0);
        } else if (maxVal == color.g) {
            hue = ((color.b - color.r) / delta) + 2.0;
        } else {
            hue = ((color.r - color.g) / delta) + 4.0;
        }
    }

    hue = hue * 60.0;
    if (hue < 0.0) {
        hue += 360.0;
    }

    float saturation = (maxVal == 0.0) ? 0.0 : (delta / maxVal);
    float value = maxVal;

    return vec3(hue, saturation, value);
}

vec3 hsvToRgb(vec3 color) {
    float c = color.z * color.y;
    float x = c * (1.0 - abs(mod(color.x / 60.0, 2.0) - 1.0));
    float m = color.z - c;

    vec3 rgbColor;
    if (color.x >= 0.0 && color.x < 60.0) {
        rgbColor = vec3(c, x, 0.0);
    } else if (color.x >= 60.0 && color.x < 120.0) {
        rgbColor = vec3(x, c, 0.0);
    } else if (color.x >= 120.0 && color.x < 180.0) {
        rgbColor = vec3(0.0, c, x);
    } else if (color.x >= 180.0 && color.x < 240.0) {
        rgbColor = vec3(0.0, x, c);
    } else if (color.x >= 240.0 && color.x < 300.0) {
        rgbColor = vec3(x, 0.0, c);
    } else {
        rgbColor = vec3(c, 0.0, x);
    }

    return rgbColor + m;
}

vec3 adjustHue(vec3 color, float hueShift) {
    vec3 hsvColor = rgbToHsv(color);

    hsvColor.x = mod(hsvColor.x + hueShift, 360.0);
    return hsvToRgb(hsvColor);
}


vec3 blendMultiply(vec3 base, vec3 blend) {
    return base * blend;
}

vec3 blendMultiply(vec3 base, vec3 blend, float opacity) {
    return (blendMultiply(base, blend) * opacity + base * (1.0 - opacity));
}

float tanh(float x) {
    return smoothstep(0.0, 1.0, x) * smoothstep(-1.0, 0.0, -x);
}

vec3 adjustBrightness(vec3 color, float value) {
    return color + value;
}

vec3 adjustContrast(vec3 color, float value) {
    return 0.5 + (1.0 + value) * (color - 0.5);
}

vec3 adjustExposure(vec3 color, float value) {
    return (1.0 + value) * color;
}

vec3 adjustSaturation(vec3 color, float value) {
    const vec3 luminosityFactor = vec3(0.2126, 0.7152, 0.0722);
    vec3 grayscale = vec3(dot(color, luminosityFactor));
    return mix(grayscale, color, 1.0 + value);
}

void main() {

    /* Original hillshade

    vec4 pixel = texture(u_image, v_pos);
    vec2 deriv = ((pixel.rg * 2.0) - 1.0);

    // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
    // to account for mercator projection distortion. see #4807 for details
    float scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1]));

    // We also multiply the slope by an arbitrary z-factor of 1.25
    float slope = atan(1.25 * length(deriv) / scaleFactor);
    float aspect = deriv.x != 0.0 ? atan(deriv.y, -deriv.x) : PI / 2.0 * (deriv.y > 0.0 ? 1.0 : -1.0);

    float intensity = u_light.x;

    // We add PI to make this property match the global light object, which adds PI/2 to the light's azimuthal
    // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
    // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
    float azimuth = u_light.y + PI;

    // We scale the slope exponentially based on intensity, using a calculation similar to
    // the exponential interpolation function in the style spec:
    // src/style-spec/expression/definitions/interpolate.js#L217-L228
    // so that higher intensity values create more opaque hillshading.
    float base = 1.875 - intensity * 1.75;
    float maxValue = 0.5 * PI;
    float scaledSlope = intensity != 0.5 ? ((pow(base, slope) - 1.0) / (pow(base, maxValue) - 1.0)) * maxValue : slope;

    // The accent color is calculated with the cosine of the slope while the shade color is calculated with the sine
    // so that the accent color's rate of change eases in while the shade color's eases out.
    float accent = cos(scaledSlope);

    // We multiply both the accent and shade color by a clamped intensity value
    // so that intensities >= 0.5 do not additionally affect the color values
    // while intensity values < 0.5 make the overall color more transparent.
    vec4 accent_color = (1.0 - accent) * u_accent * clamp(intensity * 2.0, 0.0, 1.0);
    float shade = abs(mod((aspect + azimuth) / PI + 0.5, 2.0) - 1.0);
    vec4 shade_color = mix(u_shadow, u_highlight, shade) * sin(scaledSlope) * clamp(intensity * 2.0, 0.0, 1.0);
    fragColor = accent_color * (1.0 - shade_color.a) + shade_color;

    */


    /* GEOS Hillshade */

    vec4 pix = texture(u_image, v_pos);
    vec2 deriv = ((pix.rg * 2.0) - 1.0) * u_exag;

    float scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1.0 - v_pos.y) + u_latrange[1]));

    // float slopeRad = atan(sqrt(pow(deriv.x, 2.0) + pow(deriv.y, 2.0)));
    float slopeRad = atan(1.25 * length(deriv) / scaleFactor);

    float aspectRad = 9.0;
    if (deriv.x != 0.0) {
        aspectRad = atan(deriv.y, -(deriv.x));
        if (aspectRad < 0.0)
            aspectRad = (2.0 * PI) + aspectRad;
      }
    else if (deriv.y > 0.0)
        aspectRad = PI / 2.0;
    else if (deriv.y < 0.0)
        aspectRad = (2.0 * PI) - (PI / 2.0);

    float hillshade = (cos(zenithRad) * cos(slopeRad)) + (sin(zenithRad) * sin(slopeRad) * cos(azimuthRad - aspectRad));

    slopeRad = 1.0 - slopeRad;

    float mixa = mix(1.0, slopeRad, u_mixslope);
    float mixb = mix(1.0, hillshade, u_mixshade);
    float mixc = mixa * mixb;

    vec3 final = vec3(mixc, mixc, mixc);

    // Height

    vec4 data = texture(u_image_elev, v_pos) * 255.0;
    highp float v = (data.r * 65536.0 + data.g * 256.0 + data.b);
    highp float height = (mod(v, 2000000.0) - 1100000.0) / 100.0;
    int classe = int(v / 2000000.0);

    // Debug - render classes
    vec3 color;

    if (u_debugclass != 0) {
        if (classe == 0)                                                // ground
            color = vec3(0.8588, 0.8275, 0.7098);
        else if (classe == 1)                                           // ocean
            color = vec3(0.07, 0.51, 0.65);
        else if (classe == 2)                                           // lake
            color = vec3(0.1, 0.1, 0.8);
        else if (classe == 3)                                           // river
            color = vec3(0.81, 0.11, 0.54);
        else if (classe == 4)                                           // vegetation
            color = vec3(0.28, 0.46, 0.05);
        else if (classe == 5)                                           // building
            color = vec3(0.9, 0.6, 0.0);
        else if (classe == 8)                                           // no data
            color = vec3(0.99, 0.99, 0.99);
        else                                                            // unknown/error
            color = vec3(0.0, 0.0, 0.0);

        final = blendMultiply(final, color, 1.0);
    }

    // Color ramp
    else if (u_mixcolor != 0.0) {
        highp float rampmin = u_ramp[0].a;
        highp float rampmax = 3500.0;

        highp float range = rampmax - rampmin;
        highp float newrange = u_elevmax - u_elevmin;
        highp float coef = newrange / range;
        highp float newmin = u_elevmin - rampmin;

        color = u_ramp[0].rgb;

        // Warning: dynamic indexing arr[i] not allowed in GLSL, we use this trick

        int rampsize = int(u_ramp[0].r);
        for (int n = 0; n < 99; n++) {
            if (n < rampsize) {

                if (u_autoscale != 0) {
                    color = mix(
                        color,
                        u_ramp[n+1].rgb,
                        smoothstep(
                            (u_ramp[n].a + newmin - u_elevmin) * coef + u_elevmin,
                            (u_ramp[n+1].a + newmin - u_elevmin) * coef + u_elevmin,
                            height
                        )
                    );

                } else {
                    color = mix(
                        color, 
                        u_ramp[n+1].rgb, 
                        smoothstep(
                            u_ramp[n].a, 
                            u_ramp[n+1].a,
                            height
                        )
                    );
                }

            } else {
                break;
            }
        }

        // Color adjustments
        if (u_saturation != 0.0) color = adjustSaturation(color, u_saturation);
        if (u_hue != 0.0)        color = adjustHue(color, u_hue);
        if (classe == 8)         color = vec3(0.99, 0.99, 0.99);

        final = blendMultiply(final, color, u_mixcolor);
    }


    // Image adjustments
    if (u_brightness != 0.0) final = adjustBrightness(final, u_brightness);
    if (u_contrast != 0.0)   final = adjustContrast(final, u_contrast);
    if (u_exposure != 0.0)   final = adjustExposure(final, u_exposure);

    fragColor = vec4(final, 1.0);


#ifdef OVERDRAW_INSPECTOR
    fragColor = vec4(1.0);
#endif
}
