import {RGBAImage} from '../util/image';

import {warnOnce} from '../util/util';
import {register} from '../util/web_worker_transfer';

/**
 * DEMData is a data structure for decoding, backfilling, and storing elevation data for processing in the hillshade shaders
 * data can be populated either from a pngraw image tile or from serliazed data sent back from a worker. When data is initially
 * loaded from a image tile, we decode the pixel values using the appropriate decoding formula, but we store the
 * elevation data as an Int32 value. we add 65536 (2^16) to eliminate negative values and enable the use of
 * integer overflow when creating the texture used in the hillshadePrepare step.
 *
 * DEMData also handles the backfilling of data from a tile's neighboring tiles. This is necessary because we use a pixel's 8
 * surrounding pixel values to compute the slope at that pixel, and we cannot accurately calculate the slope at pixels on a
 * tile's edge without backfilling from neighboring tiles.
 */

// GEOS TO DO:
// - done - Use of min/max values (déjà calculés), cfr. getMinMaxElevation(tileID)
// - Permettre de charger autre chose qu'un PNG, par ex. un fichier multi-couches
// - done - La tile source devrait déjà contenir le 1px border pour éviter de le calculer ici

export class DEMData {
    uid: string | number;
    data: Uint8Array | Uint8ClampedArray;
    stats: Uint8Array | Uint8ClampedArray;
    stride: number;
    dim: number;
    min: number;
    max: number;

    /**
     * Constructs a `DEMData` object
     * @param uid - the tile's unique id
     * @param data - RGBAImage data has uniform 1px padding on all sides: square tile edge size defines stride
     * @param stats - GEOS 1px band containing stats values (min, max, mean, etc..)
     * and dim is calculated as stride - 2.
     */
    constructor(uid: string | number, data: RGBAImage | ImageData, stats: RGBAImage | ImageData) {
        this.uid = uid;

        // On suppose que les tiles sont carrées, on ne fait plus la vérif
        // if (data.height !== data.width) throw new RangeError('DEM tiles must be square');

        this.stride = data.height;
        const dim = this.dim = data.height - 2;          // = 512

        // data.data = Uint8Array, pq passer par une conv en Uint32 ?? -> Uint8ClampedArray to Uint8Array ?
        // this.data = new Uint32Array(data.data.buffer);

        this.data = data.data
        this.stats = stats.data

        // in order to avoid flashing seams between tiles, here we are initially populating a 1px border of pixels around the image
        // with the data of the nearest pixel from the image. this data is eventually replaced when the tile's neighboring
        // tiles are loaded and the accurate data can be backfilled using DEMData#backfillBorder

        // GEOS - On n'a plus besoin de calculer les bordures avec les tiles 514
        // Faire un test, si on a 512 (anciennes tiles) il faudra la calculer

        /*
        for (let x = 0; x < dim; x++) {
            // left vertical border
            this.data[this._idx(-1, x)] = this.data[this._idx(0, x)];
            // right vertical border
            this.data[this._idx(dim, x)] = this.data[this._idx(dim - 1, x)];
            // left horizontal border
            this.data[this._idx(x, -1)] = this.data[this._idx(x, 0)];
            // right horizontal border
            this.data[this._idx(x, dim)] = this.data[this._idx(x, dim - 1)];
        }
        // corners
        this.data[this._idx(-1, -1)] = this.data[this._idx(0, 0)];
        this.data[this._idx(dim, -1)] = this.data[this._idx(dim - 1, 0)];
        this.data[this._idx(-1, dim)] = this.data[this._idx(0, dim - 1)];
        this.data[this._idx(dim, dim)] = this.data[this._idx(dim - 1, dim - 1)];
        */

        // calculate min/max values
        // on zappe pour l'instant pour la vitesse
        /*
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;

        for (let x = 0; x < dim; x++) {
            for (let y = 0; y < dim; y++) {
                const ele = this.get(x, y);
                if (ele > this.max) this.max = ele;
                if (ele < this.min) this.min = ele;
            }
        }
        */

        // GEOS - on récupère les min/max depuis la bande stats
        this.min = this.getstat(0);
        this.max = this.getstat(1);
    }

    // GEOS - lis une valeur de la bande stat
    getstat(y: number) {
        const index = y * 4;
        return (this.stats[index] * 65536.0 + this.stats[index + 1] * 256.0 + this.stats[index + 2] - 1100000.0) / 100.0;
    }

    // Semble ne servir que pour Terrain et le calc min/max
    get(x: number, y: number) {
        // const pixels = new Uint8Array(this.data.buffer);
        const index = this._idx(x, y) * 4;

        // return this.unpack(pixels[index], pixels[index + 1], pixels[index + 2]);
        // return pixels[index] * 256.0 + pixels[index+1] + pixels[index+2] / 256.0 - 32768.0;
        return this.data[index] * 256.0 + this.data[index+1] + this.data[index+2] / 256.0 - 32768.0;
    }

    getUnpackVector() {
        // On utilise que terrarium
        return [256.0, 1.0, 1.0 / 256.0, 32768.0];
    }

    _idx(x: number, y: number) {
        if (x < -1 || x >= this.dim + 1 ||  y < -1 || y >= this.dim + 1) throw new RangeError('out of range source coordinates for DEM data');
        return (y + 1) * this.stride + (x + 1);
    }

    // plus nécessaire
    /*
    unpack(r: number, g: number, b: number) {
        return r * 256.0 + g + b / 256.0 - 32768.0;
    }
    */

    getPixels() {
        // return new RGBAImage({width: this.stride, height: this.stride}, new Uint8Array(this.data.buffer));
        return new RGBAImage({width: this.stride, height: this.stride}, this.data);
    }

    // Pas nécessaire avec tiles 514
    /*
    backfillBorder(borderTile: DEMData, dx: number, dy: number) {
        if (this.dim !== borderTile.dim) throw new Error('dem dimension mismatch');

        let xMin = dx * this.dim,
            xMax = dx * this.dim + this.dim,
            yMin = dy * this.dim,
            yMax = dy * this.dim + this.dim;

        switch (dx) {
            case -1:
                xMin = xMax - 1;
                break;
            case 1:
                xMax = xMin + 1;
                break;
        }

        switch (dy) {
            case -1:
                yMin = yMax - 1;
                break;
            case 1:
                yMax = yMin + 1;
                break;
        }

        const ox = -dx * this.dim;
        const oy = -dy * this.dim;
        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                this.data[this._idx(x, y)] = borderTile.data[this._idx(x + ox, y + oy)];
            }
        }
    }
    */
}

register('DEMData', DEMData);
